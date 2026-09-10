# frozen_string_literal: true

module Epsilon
  # Re-moderates a single status that was published *without* a verdict during an
  # AI outage (fail-open, flagged +ai_failed_open+). Unlike the live worker, the
  # post is already public, so the verdict is applied *in place*: no fresh
  # fan-out. Enqueued in throttled batches by Epsilon::AiRemoderationScheduler.
  #
  # If the API is still down the job just raises and Sidekiq retries; once retries
  # are exhausted the flag is left set (no fail-open handler), so the scheduler
  # picks the status up again on a later, healthier cycle.
  class AiRemoderationWorker
    include Sidekiq::Worker
    include Epsilon::MistralAnalysis
    include Epsilon::ModerationVerdictActions

    sidekiq_options queue: 'epsilon_ai_remoderation', retry: 2

    def perform(status_id)
      moderation = ::Epsilon::AiStatusModeration.find_by(status_id: status_id)
      return if moderation.nil? || !moderation.ai_failed_open?

      status = Status.find_by(id: status_id)

      # Author deleted it (or it was otherwise discarded) meanwhile: nothing left
      # to moderate, just clear the backlog flag.
      if status.nil? || status.discarded?
        moderation.update!(ai_failed_open: false)
        return
      end

      @setting = ::Epsilon::AiModerationSetting.current
      return unless @setting.ai_enabled? # kill-switch: leave the flag, retry later

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

      persist_verdict!(status, moderation, new_state, must_be_sensitive, results, category, trigger_reason, violence_score, vulg_score, sex_score)

      apply_verdict_in_place!(status, new_state, must_be_sensitive, trigger_reason, highest_score, category, reasoning, clean_content)
    end

    private

    def persist_verdict!(status, moderation, new_state, must_be_sensitive, results, category, trigger_reason, violence_score, vulg_score, sex_score)
      ApplicationRecord.transaction do
        moderation.state = new_state
        moderation.ai_content_warning = must_be_sensitive
        moderation.ai_failed_open = false
        moderation.save!

        ::Epsilon::AiMetadata.find_or_create_by!(status: status) do |metadata|
          metadata.violence_score  = violence_score
          metadata.categories_raw  = results
          metadata.mistral_payload = {
            vulgarity_score: vulg_score,
            sexual_score: sex_score,
            category: category,
            trigger: trigger_reason,
          }
        end

        ::Epsilon::ModerationEvent.record!(
          status: status,
          decision: new_state,
          source: :remoderation,
          sensitive: must_be_sensitive,
          scores: { violence: violence_score, vulgarity: vulg_score, sexual: sex_score },
          category: category,
          trigger: trigger_reason
        )
      end
    end

    # The post is already public, so we only *react* to the verdict: a rejection
    # takes it down retroactively (preserved, restorable), a review files a
    # report, and a sensitive flag adds a content warning propagated as an edit.
    # An "approved" needs nothing -- it stays up.
    def apply_verdict_in_place!(status, new_state, must_be_sensitive, trigger_reason, highest_score, category, reasoning, clean_content)
      sentinel = Account.find_by(username: 'EpsilonSafety') || Account.representative

      case new_state
      when :rejected
        if status.account.local?
          send_explanation_dm(status, sentinel, :reject, trigger_reason, highest_score, category, clean_content)
          create_strike_and_preserve!(status, trigger_reason, highest_score, sentinel, category)
        else
          ::RemoveStatusService.new.call(status)
        end
      when :approved, :manual_review
        apply_content_warning!(status, trigger_reason) if must_be_sensitive
        trigger_system_report!(status, trigger_reason, highest_score, reasoning) if new_state == :manual_review
      end
    end
  end
end
