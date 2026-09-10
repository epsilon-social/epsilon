# frozen_string_literal: true

# Shared Mistral analysis + score-to-verdict mapping, used by both the live
# moderation worker (Epsilon::MistralModerationWorker) and the re-moderation
# backlog worker (Epsilon::AiRemoderationWorker).
#
# Pure by design: it calls the API and maps scores to a verdict, with *no*
# side effects on the status. The including worker must set +@setting+ (an
# Epsilon::AiModerationSetting, e.g. via `AiModerationSetting.current`) before
# calling #analyze_with_mistral.
module Epsilon::MistralAnalysis
  extend ActiveSupport::Concern

  def analyze_with_mistral(text)
    if @setting.use_native_moderation?
      analyze_with_native_moderation(text)
    else
      analyze_with_llm(text)
    end
  end

  private

  def analyze_with_native_moderation(text)
    api_key = ENV.fetch('MISTRAL_API_KEY', nil)
    url = 'https://api.mistral.ai/v1/moderations'

    payload = {
      model: 'mistral-moderation-latest',
      input: text,
    }

    response = HTTP.timeout(5).auth("Bearer #{api_key}").post(url, json: payload)
    unless response.status.success?
      error_details = response.body.to_s.truncate(200)
      raise StandardError, "Mistral API Error: #{response.code} - #{error_details}"
    end

    native_scores = response.parse.dig('results', 0, 'category_scores') || {}

    {
      'violence_score' => native_scores['violence_and_threats'].to_f,
      'vulgarity_score' => native_scores['hate_and_discrimination'].to_f,
      'sexual_score' => native_scores['sexual'].to_f,
      'category' => 'Modération Native',
      'reasoning' => 'Analyse via l\'API de modération standard',
    }
  end

  def analyze_with_llm(text)
    api_key = ENV.fetch('MISTRAL_API_KEY', nil)
    url = 'https://api.mistral.ai/v1/chat/completions'

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
  end

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
end
