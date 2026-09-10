# frozen_string_literal: true

module Epsilon
  # Permanently deletes AI-rejected statuses once their review/appeal window has
  # elapsed. Until then a rejected post is only soft-deleted (preserved, hidden
  # everywhere but restorable from /admin/reports); this scheduler hard-deletes
  # it afterwards -- media included -- for privacy and storage.
  class RejectedContentPurgeScheduler
    include Sidekiq::Worker

    sidekiq_options queue: 'scheduler', retry: 0

    BATCH_SIZE = 500

    def perform
      retention_days = ::Epsilon::AiModerationSetting.current.rejected_retention_days.to_i
      return if retention_days <= 0

      cutoff = retention_days.days.ago

      # Rejected moderations whose (soft-deleted) status is older than the window.
      # Raw join because Status.kept default scope would hide the discarded rows.
      status_ids = ::Epsilon::AiStatusModeration
        .rejected
        .joins('INNER JOIN statuses ON statuses.id = epsilon_ai_status_moderations.status_id')
        .where('statuses.deleted_at IS NOT NULL AND statuses.deleted_at < ?', cutoff)
        .limit(BATCH_SIZE)
        .pluck(:status_id)

      return if status_ids.empty?

      Rails.logger.info("[EPSILON AI RETENTION] Purging #{status_ids.size} rejected status(es) past the #{retention_days}-day window")

      Status.unscoped.where(id: status_ids).find_each do |status|
        ::RemoveStatusService.new.call(status, immediate: true)
      rescue => e
        Rails.logger.error("[EPSILON AI RETENTION] Failed to purge ##{status.id}: #{e.class} #{e.message}")
      end
    end
  end
end
