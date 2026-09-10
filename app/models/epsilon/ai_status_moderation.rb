# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_ai_status_moderations
#
#  id                 :bigint(8)        not null, primary key
#  ai_content_warning :boolean          default(FALSE), not null
#  ai_failed_open     :boolean          default(FALSE), not null
#  reaper_attempts    :integer          default(0), not null
#  state              :integer          default("unmoderated"), not null
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  status_id          :bigint(8)        not null
#
class Epsilon::AiStatusModeration < ApplicationRecord
  belongs_to :status

  self.table_name = 'epsilon_ai_status_moderations'

  enum :state, {
    unmoderated: 0,
    pending_ai: 1,
    approved: 2,
    manual_review: 3,
    rejected: 4,
  }

  # Prefix the moderation worker uses when it auto-adds a content warning
  # (mistral_moderation_worker.rb). Used only to decide *which* spoiler to clear
  # on removal (the AI's own vs one the author wrote).
  AI_CW_SPOILER_PREFIX = 'Contenu sensible'

  # Statuses the AI flagged sensitive (recorded at verdict time) that are still
  # sensitive -- the set a moderator can lift a wrongly-added CW from. Reliable
  # regardless of the spoiler text, and index-friendly.
  scope :with_ai_content_warning, lambda {
    where(ai_content_warning: true)
      .joins(:status)
      .where(statuses: { sensitive: true })
  }

  # The re-moderation backlog: statuses published without a verdict because the
  # Mistral call exhausted its retries (fail-open). Re-checked by
  # Epsilon::AiRemoderationScheduler once the API is healthy. Backed by the
  # partial index on ai_failed_open.
  scope :failed_open, -> { where(ai_failed_open: true) }
end
