# frozen_string_literal: true

require 'sidekiq/api'

# Read-only snapshot of the AI moderation pipeline's health, for the admin
# settings page. Every metric is a cheap query -- the panel answers "is anything
# wrong right now?" at a glance. Thresholds are shared with the reaper so the
# panel and the safety net agree on what "stuck" and "given up" mean.
class Epsilon::AiModerationHealth
  STALE_AFTER = ::Epsilon::AiModerationReaperScheduler::STALE_AFTER
  GAVE_UP_AT  = ::Epsilon::AiModerationReaperScheduler::MAX_ATTEMPTS
  QUEUE       = 'epsilon_ai_moderation'

  # Held right now, awaiting a verdict (normally a handful, very transient).
  def pending_count
    moderations.pending_ai.count
  end

  def oldest_pending_at
    moderations.pending_ai.minimum(:updated_at)
  end

  # Pending past the reaper's grace window: with a healthy Sidekiq/scheduler
  # this hovers near zero (the reaper clears them within a minute). A non-zero
  # value means the reaper isn't keeping up (or isn't running).
  def stuck_count
    moderations.pending_ai.where(updated_at: ..STALE_AFTER.ago).count
  end

  # The reaper tried MAX_ATTEMPTS times and gave up: genuinely broken, a human
  # needs to look.
  def needs_attention_count
    moderations.pending_ai.where(reaper_attempts: GAVE_UP_AT..).count
  end

  # How much the safety net had to step in lately. A high number means the
  # normal Mistral path is failing (bad key, API down, lost jobs).
  def reaped_last_24h
    moderations.where(reaper_attempts: 1..).where(updated_at: 24.hours.ago..).count
  end

  # Published-during-an-outage backlog awaiting re-moderation (fail-open). Drained
  # by AiRemoderationScheduler once the API is healthy; can be flushed on demand.
  def failed_open_count
    moderations.failed_open.count
  end

  # Rejected posts currently preserved (soft-deleted, restorable) within the
  # retention window.
  def preserved_rejected_count
    moderations.rejected.count
  end

  # Published posts the AI flagged with a content warning (a moderator can lift
  # a false positive).
  def ai_content_warning_count
    moderations.with_ai_content_warning.count
  end

  def queue_size
    sidekiq_queue.size
  end

  def queue_latency
    sidekiq_queue.latency
  end

  def api_key_present?
    ENV['MISTRAL_API_KEY'].present?
  end

  def ai_enabled?
    ::Epsilon::AiModerationSetting.current.ai_enabled?
  end

  def healthy?
    stuck_count.zero? && needs_attention_count.zero?
  end

  private

  def moderations
    ::Epsilon::AiStatusModeration
  end

  def sidekiq_queue
    @sidekiq_queue ||= Sidekiq::Queue.new(QUEUE)
  end
end
