# frozen_string_literal: true

module Epsilon
  # Safety net for the AI moderation pipeline.
  #
  # Fail-open normally happens through +MistralModerationWorker+'s
  # +sidekiq_retries_exhausted+ hook -- but that only fires if the job actually
  # ran and burned its retries. A job that is *lost* before ever running
  # (Sidekiq down at enqueue time, Redis flushed, a botched deploy) leaves its
  # status stuck in +pending_ai+ forever: held off every timeline, no verdict
  # ever coming. This scheduled sweep releases such orphans by applying the same
  # fail-open policy -- publish as +unmoderated+.
  class AiModerationReaperScheduler
    include Sidekiq::Worker

    sidekiq_options queue: 'scheduler', retry: 0

    # A verdict normally lands in seconds; even a full 3-retry exhaustion is done
    # well under 3 minutes. Anything still pending past this is a lost job.
    STALE_AFTER = 10.minutes
    BATCH_SIZE = 500
    # After this many failed release attempts a status is left alone (and flagged
    # for humans) rather than retried every minute forever -- something about it
    # is genuinely broken (e.g. fan-out keeps raising).
    MAX_ATTEMPTS = 5

    def perform
      cutoff = STALE_AFTER.ago

      moderation_ids = ::Epsilon::AiStatusModeration
        .where(state: :pending_ai)
        .where(updated_at: ..cutoff)
        .where(reaper_attempts: ...MAX_ATTEMPTS)
        .limit(BATCH_SIZE)
        .pluck(:id)

      return if moderation_ids.empty?

      Rails.logger.warn("[EPSILON AI REAPER] Releasing #{moderation_ids.size} stale pending_ai status(es) via fail-open")

      ::Epsilon::AiStatusModeration.where(id: moderation_ids).includes(:status).find_each do |moderation|
        release!(moderation)
      end
    end

    private

    # Isolated per status: one broken status must not abort the whole batch.
    # The synchronous local fan-out runs *before* the state flip so a fan-out
    # failure keeps the status pending (and retried, up to MAX_ATTEMPTS) rather
    # than marking it released without ever delivering it. Federation is enqueued
    # *after* the flip: ActivityPubDistributionWorkerExtension skips pending_ai,
    # so the async job must see the released state to actually go out.
    #
    # Orphans were never seen by the AI, so we release them to +manual_review+
    # (published, but flagged) rather than +unmoderated+ (published, trusted),
    # and file a system report so a human actually reviews them -- setting the
    # state alone surfaces nowhere.
    def release!(moderation)
      status = moderation.status
      return if status.nil?

      moderation.increment!(:reaper_attempts)

      ::FanOutOnWriteService.new.call(status)

      moderation.update!(state: :manual_review)
      status.update_column(:updated_at, Time.current)

      ::ActivityPub::DistributionWorker.perform_async(status.id)

      ::Epsilon::ModerationEvent.record!(status: status, decision: :reaper_released, source: :reaper, sensitive: status.sensitive?)

      flag_for_human_review!(status)

      Rails.logger.warn("[EPSILON AI REAPER] Released ##{status.id} to manual_review after #{moderation.reaper_attempts} attempt(s)")
    rescue => e
      level = moderation.reaper_attempts >= MAX_ATTEMPTS ? 'GIVING UP -- needs manual attention' : 'will retry'
      Rails.logger.error("[EPSILON AI REAPER] Failed to release ##{moderation.status_id} (attempt #{moderation.reaper_attempts}/#{MAX_ATTEMPTS}, #{level}): #{e.class} #{e.message}")
    end

    def flag_for_human_review!(status)
      ::ReportService.new.call(
        Account.representative,
        status.account,
        status_ids: [status.id],
        comment: I18n.t('epsilon.moderation.system.reaper_report')
      )
    end
  end
end
