# frozen_string_literal: true

module Epsilon
  class MistralModerationWorker
    include Sidekiq::Worker

    sidekiq_options queue: 'epsilon_ai_moderation', retry: 3

    def perform(status_id)
      status = Status.find_by(id: status_id)
      return if status.nil? || !status.pending_ai?

      @setting = ::Epsilon::AiModerationSetting.current

      clean_content = ActionView::Base.full_sanitizer.sanitize(status.text)
      results = analyze_with_mistral(clean_content)

      violence_score = results['violence_score'].to_f
      vulg_score     = results['vulgarity_score'].to_f
      sex_score      = results['sexual_score'].to_f
      category       = results['category'] || 'Autre'
      reasoning      = results['reasoning'] || 'Aucune explication fournie'

      new_state         = determine_moderation_state(violence_score, vulg_score, sex_score)
      must_be_sensitive = determine_if_sensitive(violence_score, vulg_score, sex_score)
      trigger_reason    = determine_trigger_reason(violence_score, vulg_score, sex_score)
      highest_score     = [violence_score, vulg_score, sex_score].max

      ApplicationRecord.transaction do
        moderation = status.epsilon_ai_status_moderation_or_default
        moderation.state = new_state
        moderation.save!

        if must_be_sensitive
          status.sensitive = true
          status.spoiler_text = "Contenu sensible : #{trigger_reason.capitalize}" if status.spoiler_text.blank?
        end

        status.save! if status.changed?

        Epsilon::AiMetadata.find_or_create_by!(status: status) do |metadata|
          metadata.violence_score  = violence_score
          metadata.categories_raw  = results
          metadata.mistral_payload = {
            vulgarity_score: vulg_score,
            sexual_score: sex_score,
            category: category,
            trigger: trigger_reason,
          }
        end
      end

      sentinel = Account.find_by(username: 'EpsilonSafety') || Account.representative

      case new_state
      when :approved, :manual_review
        status.reload

        ::FanOutOnWriteService.new.call(status)

        ::UpdateStatusService.new.call(status, status.account.id, sensitive: status.sensitive) if must_be_sensitive
        trigger_system_report!(status, trigger_reason, highest_score, reasoning) if status.manual_review?

      when :rejected
        if status.account.local?
          send_explanation_dm(status, sentinel, :reject, trigger_reason, highest_score, category, clean_content)
          create_strike_and_delete!(status, trigger_reason, highest_score, sentinel, category)
        else
          ::RemoveStatusService.new.call(status)
        end
      end
    end

    private

    def analyze_with_mistral(text)
      if @setting.use_native_moderation?
        analyze_with_native_moderation(text)
      else
        analyze_with_llm(text)
      end
    end

    # ==========================================
    # EPSILON : MISTRAL MODERATION
    # ==========================================

    def analyze_with_native_moderation(text)
      api_key = ENV.fetch('MISTRAL_API_KEY', nil)
      url = 'https://api.mistral.ai/v1/moderations'

      payload = {
        model: 'mistral-moderation-latest',
        input: text,
      }

      response = HTTP.timeout(5).auth("Bearer #{api_key}").post(url, json: payload)
      raise StandardError, "Mistral API Error: #{response.code}" unless response.status.success?

      native_scores = response.parse.dig('results', 0, 'category_scores') || {}

      {
        'violence_score' => native_scores['violence_and_threats'].to_f,
        'vulgarity_score' => native_scores['hate_and_discrimination'].to_f,
        'sexual_score' => native_scores['sexual'].to_f,
        'category' => 'Modération Native',
        'reasoning' => 'Analyse via l\'API de modération standard',
      }
    rescue JSON::ParserError
      default_error_response('json_parse_error')
    rescue
      default_error_response('api_error')
    end
    # ==========================================

    # ==========================================
    # EPSILON : MISTRAL CHAT COMPLETION
    # ==========================================

    def analyze_with_llm(text)
      api_key = ENV.fetch('MISTRAL_API_KEY', nil)
      url = 'https://api.mistral.ai/v1/chat/completions'

      # ==========================================
      # EPSILON : AI MODERATION SETTINGS
      # rubocop:disable I18n/RailsI18n/DecorateString
      mandatory_footer = <<~FOOTER

        SCORING SCALE (0.0 to 1.0)

        MANDATORY RESPONSE FORMAT:
        Return ONLY a valid JSON object containing "violence_score", "vulgarity_score", "sexual_score", "category", and "reasoning".
      FOOTER

      system_prompt = @setting.custom_prompt + mandatory_footer
      # rubocop:enable I18n/RailsI18n/DecorateString

      payload = {
        model: 'mistral-small-latest',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system_prompt },
          { role: 'user', content: text },
        ],
      }

      response = HTTP.timeout(5).auth("Bearer #{api_key}").post(url, json: payload)
      raise StandardError, "Mistral API Error: #{response.code}" unless response.status.success?

      raw_json = response.parse.dig('choices', 0, 'message', 'content')
      JSON.parse(raw_json)
    rescue JSON::ParserError
      default_error_response('json_parse_error')
    rescue
      default_error_response('api_error')
    end
    # ==========================================

    def determine_moderation_state(violence, vulg, sex)
      if violence >= @setting.ban_violence || vulg >= @setting.ban_vulgarity || sex >= @setting.ban_sexual
        :rejected
      elsif violence >= @setting.review_threshold || vulg >= @setting.review_threshold || sex >= @setting.review_threshold
        :manual_review
      else
        :approved
      end
    end

    def determine_if_sensitive(violence, vulg, sex)
      violence >= @setting.sensitive_violence || vulg >= @setting.sensitive_vulgarity || sex >= @setting.sensitive_sexual
    end

    def determine_trigger_reason(violence, vulg, sex)
      scores = { 'violence' => violence, 'vulgarité' => vulg, 'contenu sexuel' => sex }
      highest = scores.max_by { |_, score| score }
      highest[0]
    end

    def trigger_system_report!(status, reason, score, reasoning)
      comment = I18n.t('epsilon.moderation.system.report',
                       reason: reason.upcase,
                       score: score.round(3),
                       details: "Analyse IA : #{reasoning}")

      ReportService.new.call(Account.representative, status.account, status_ids: [status.id], comment: comment)
    end

    def create_strike_and_delete!(status, reason, score, sentinel, category)
      warning_text = I18n.t('epsilon.moderation.message.deleted.reason',
                            reason: reason.upcase,
                            score: score.round(3),
                            content: status.text)

      source_tag = category == 'Modération Native' ? '[API NATIVE]' : '[LLM MISTRAL]'
      final_text = "#{warning_text}\n\nScore: #{score.round(3)}\nSource: #{source_tag} - #{category}"

      AccountWarning.create!(
        target_account: status.account,
        account: sentinel,
        action: :delete_statuses,
        text: final_text
      )

      RemoveStatusService.new.call(status)
    end

    def send_explanation_dm(target_status, sender, type, reason, score, category, message)
      author = target_status.account

      recipient_locale = author.user&.locale || I18n.default_locale

      text = I18n.with_locale(recipient_locale) do
        if type == :review
          I18n.t('epsilon.moderation.message.review',
                 username: author.username,
                 reason: reason)
        else
          I18n.t('epsilon.moderation.message.deleted.dm',
                 username: author.username,
                 reason: reason.upcase)
        end
      end

      safe_message = message.to_s.gsub('@', '[at]')
      source_tag = category == 'Modération Native' ? '[API NATIVE]' : '[LLM MISTRAL]'
      final_text = "#{text}\n\nScore: #{score.round(3)}\nSource: #{source_tag} - #{category}\nMessage: #{safe_message}"

      PostStatusService.new.call(
        sender,
        text: final_text,
        visibility: :direct
      )
    end

    # ==========================================
    # HELPERS
    # ==========================================
    def default_error_response(reasoning)
      {
        'violence_score' => 0.0,
        'vulgarity_score' => 0.0,
        'sexual_score' => 0.0,
        'category' => 'Autre',
        'reasoning' => reasoning,
      }
    end
  end
end
