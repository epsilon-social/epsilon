# frozen_string_literal: true

module Epsilon
  # Drains the fail-open backlog: statuses published without a verdict during an
  # AI outage. Runs on a timer (and on demand via the admin "re-moderate now"
  # button). Self-gating and throttled so it never hammers a still-dead API nor
  # saturates Mistral:
  #   * skips entirely if there is nothing to re-check or the kill-switch is off;
  #   * a single cheap probe confirms the API is back before enqueuing anything;
  #   * only RECHECK_BATCH oldest statuses are enqueued per run.
  # The heavy lifting (per-status re-analysis + verdict) is in AiRemoderationWorker.
  class AiRemoderationScheduler
    include Sidekiq::Worker
    include Epsilon::MistralAnalysis

    sidekiq_options queue: 'scheduler', retry: 0

    RECHECK_BATCH = 50
    PROBE_TEXT = 'ping'

    def perform
      setting = ::Epsilon::AiModerationSetting.current
      return unless setting.ai_enabled?

      status_ids = backlog.limit(RECHECK_BATCH).pluck(:status_id)
      return if status_ids.empty?
      return unless api_healthy?(setting)

      Rails.logger.info("[EPSILON AI REMODERATION] Re-checking #{status_ids.size} fail-open status(es)")

      status_ids.each { |id| ::Epsilon::AiRemoderationWorker.perform_async(id) }
    end

    private

    # Oldest fail-opens first, only for statuses still present (kept). A discarded
    # status (author-deleted) is cleared by the worker itself if it ever slips in.
    def backlog
      ::Epsilon::AiStatusModeration
        .failed_open
        .joins(:status)
        .order(updated_at: :asc)
    end

    # One cheap probe so we don't enqueue a batch against a still-dead API (which
    # would just burn retries). A failure aborts this run; the next tick retries.
    def api_healthy?(setting)
      @setting = setting
      analyze_with_mistral(PROBE_TEXT)
      true
    rescue => e
      Rails.logger.warn("[EPSILON AI REMODERATION] API probe failed, skipping run: #{e.class} #{e.message}")
      false
    end
  end
end
