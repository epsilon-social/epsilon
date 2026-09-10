# frozen_string_literal: true

# Append-only audit log of AI moderation decisions. One row per verdict, kept
# independently of the status/account lifecycle so history and trends survive
# deletion and retention purges. Written from MistralModerationWorker (every
# verdict) and AiModerationReaperScheduler (fail-open releases).
# == Schema Information
#
# Table name: epsilon_moderation_events
#
#  id              :bigint(8)        not null, primary key
#  acct            :string
#  category        :string
#  decision        :integer          default("approved"), not null
#  sensitive       :boolean          default(FALSE), not null
#  sexual_score    :decimal(4, 3)
#  source          :integer          default("llm"), not null
#  trigger         :string
#  violence_score  :decimal(4, 3)
#  vulgarity_score :decimal(4, 3)
#  created_at      :datetime         not null
#  account_id      :bigint(8)
#  status_id       :bigint(8)
#
class Epsilon::ModerationEvent < ApplicationRecord
  self.table_name = 'epsilon_moderation_events'

  enum :decision, {
    approved: 0,
    manual_review: 1,
    rejected: 2,
    reaper_released: 3,
    fail_open: 4,
  }

  enum :source, {
    llm: 0,
    native: 1,
    reaper: 2,
    remoderation: 3,
  }, prefix: :source

  scope :search_acct, lambda { |query|
    escaped = query.to_s.gsub(/[\\%_]/) { |char| "\\#{char}" }
    where('acct ILIKE ?', "%#{escaped}%")
  }

  # The worst score across the three criteria (violence / vulgarity / sexual) --
  # this is what actually drives the verdict, so it is the meaningful single
  # "severity" figure rather than any one axis. Nil when no scores were recorded
  # (e.g. a fail_open or reaper_released event).
  def peak_score
    [violence_score, vulgarity_score, sexual_score].compact.max
  end

  def self.record!(status:, decision:, source:, sensitive: false, scores: {}, category: nil, trigger: nil)
    create!(
      account_id: status.account_id,
      acct: status.account.acct,
      status_id: status.id,
      decision: decision,
      sensitive: sensitive,
      source: source,
      violence_score: scores[:violence],
      vulgarity_score: scores[:vulgarity],
      sexual_score: scores[:sexual],
      category: category,
      trigger: trigger
    )
  end
end
