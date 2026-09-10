# frozen_string_literal: true

module Epsilon
  class MistralModerationWorker
    include Sidekiq::Worker
    include Epsilon::MistralAnalysis
    include Epsilon::ModerationVerdictActions

    sidekiq_options queue: 'epsilon_ai_moderation', retry: 3

    sidekiq_retries_exhausted do |msg, exception|
      status_id = msg['args'][0]
      is_edit = msg['args'][1] || false
      status = Status.find_by(id: status_id)

      next if status.nil?

      ApplicationRecord.transaction do
        moderation = status.epsilon_ai_status_moderation_or_default

        if moderation.pending_ai?
          moderation.state = :unmoderated
          # Flag it as fail-open: it was published without ever being vetted, so
          # the re-moderation scheduler re-checks it once the API is healthy.
          moderation.ai_failed_open = true
          moderation.save!

          status.updated_at = Time.current
          status.save! if status.changed?

          setting = ::Epsilon::AiModerationSetting.current
          ::Epsilon::ModerationEvent.record!(
            status: status,
            decision: :fail_open,
            source: setting.use_native_moderation? ? :native : :llm,
            sensitive: status.sensitive?
          )
        end
      end

      status.reload

      # Fail-open: publish the held content, locally and to the fediverse. An
      # edit ships as an update so already-distributed copies are refreshed
      # rather than re-inserted.
      if is_edit
        ::DistributionWorker.perform_async(status.id, { 'update' => true })
        ::ActivityPub::StatusUpdateDistributionWorker.perform_async(status.id)
      else
        ::FanOutOnWriteService.new.call(status)
        ::ActivityPub::DistributionWorker.perform_async(status.id)
      end

      Rails.logger.error("[EPSILON AI CRITICAL] Échec définitif de la modération du statut #{status_id}. Erreur : #{exception.message}")
    end

    # rubocop:disable Style/OptionalBooleanParameter -- Sidekiq passes args positionally, not as kwargs
    def perform(status_id, is_edit = false)
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
        moderation.ai_content_warning = must_be_sensitive
        # A real verdict clears any earlier fail-open mark (e.g. a status that was
        # published during an outage and is now being re-checked, or re-moderated
        # after an edit).
        moderation.ai_failed_open = false
        moderation.save!

        if must_be_sensitive
          status.sensitive = true
          status.spoiler_text = "Contenu sensible : #{trigger_reason.capitalize}" if status.spoiler_text.blank?
          status.save! if status.changed?
        end

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

      ::Epsilon::ModerationEvent.record!(
        status: status,
        decision: new_state,
        source: @setting.use_native_moderation? ? :native : :llm,
        sensitive: must_be_sensitive,
        scores: { violence: violence_score, vulgarity: vulg_score, sexual: sex_score },
        category: category,
        trigger: trigger_reason
      )

      sentinel = Account.find_by(username: 'EpsilonSafety') || Account.representative

      case new_state
      when :approved, :manual_review
        status.reload

        if is_edit
          epsilon_distribute_edit!(status)
        else
          ::FanOutOnWriteService.new.call(status)
          ::ActivityPub::DistributionWorker.perform_async(status.id)
          ::UpdateStatusService.new.call(status, status.account.id, sensitive: true, bypass_ai_moderation: true) if must_be_sensitive
        end

        trigger_system_report!(status, trigger_reason, highest_score, reasoning) if status.manual_review?

      when :rejected
        if status.account.local?
          if is_edit
            epsilon_revert_rejected_edit!(status, sentinel, trigger_reason, highest_score, category, clean_content)
          else
            send_explanation_dm(status, sentinel, :reject, trigger_reason, highest_score, category, clean_content)
            create_strike_and_preserve!(status, trigger_reason, highest_score, sentinel, category)
          end
        else
          ::RemoveStatusService.new.call(status)
        end
      end
    end
    # rubocop:enable Style/OptionalBooleanParameter

    private

    # Distribute an approved edit as an *update* so copies already on timelines
    # are refreshed in place, matching native UpdateStatusService#broadcast_updates!.
    def epsilon_distribute_edit!(status)
      ::DistributionWorker.perform_async(status.id, { 'update' => true })
      ::ActivityPub::StatusUpdateDistributionWorker.perform_async(status.id)
    end

    # A rejected edit never gets published: we restore the previous, already-
    # approved revision from the edit history (non-destructive -- nothing bad was
    # ever made public). But the *attempt* is still recorded (strike + report,
    # with the offending edit content), so editing a post into banned content is
    # not consequence-free and stays visible to moderators.
    def epsilon_revert_rejected_edit!(status, sentinel, reason, score, category, clean_content)
      previous = status.edits.reorder(id: :desc).second

      if previous.nil?
        send_explanation_dm(status, sentinel, :reject, reason, score, category, clean_content)
        return create_strike_and_preserve!(status, reason, score, sentinel, category)
      end

      record_rejected_edit!(status, reason, score, sentinel, category, clean_content)

      status.epsilon_ai_status_moderation_or_default.update!(state: :approved)

      ::UpdateStatusService.new.call(
        status,
        status.account_id,
        text: previous.text,
        spoiler_text: previous.spoiler_text,
        sensitive: previous.sensitive,
        bypass_ai_moderation: true
      )

      send_explanation_dm(status, sentinel, :edit_reverted, reason, score, category, clean_content)
    end

    # Strike + report for a rejected edit. No deletion (the post is reverted, not
    # removed), so the report comment carries the offending edit content and
    # states the visible post is the safe, reverted version.
    def record_rejected_edit!(status, reason, score, sentinel, category, offending_content)
      source_tag = category == 'Modération Native' ? '[API NATIVE]' : '[LLM MISTRAL]'

      warning_text = I18n.t('epsilon.moderation.message.edit_reverted.reason',
                            reason: reason.upcase,
                            score: score.round(3),
                            content: offending_content)
      final_text = "#{warning_text}\n\nScore: #{score.round(3)}\nSource: #{source_tag} - #{category}"

      AccountWarning.create!(
        target_account: status.account,
        account: sentinel,
        action: :none,
        text: final_text,
        status_ids: [status.id.to_s]
      )

      ReportService.new.call(
        Account.representative,
        status.account,
        status_ids: [status.id],
        comment: I18n.t('epsilon.moderation.system.edit_reject_report',
                        reason: reason.upcase,
                        score: score.round(3),
                        content: offending_content)
      )
    end
  end
end
