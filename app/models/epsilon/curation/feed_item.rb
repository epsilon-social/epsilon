# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_curated_feed_items
#
#  id                  :bigint(8)        not null, primary key
#  position            :integer          default(0), not null
#  state               :integer          default("draft"), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  added_by_account_id :bigint(8)
#  curated_feed_id     :bigint(8)        not null
#  status_id           :bigint(8)        not null
#
class Epsilon::Curation::FeedItem < ApplicationRecord
  self.table_name = 'epsilon_curated_feed_items'

  enum :state, { draft: 0, published: 1 }

  belongs_to :curated_feed, class_name: 'Epsilon::Curation::CuratedFeed', inverse_of: :items
  belongs_to :status
  belongs_to :added_by_account, class_name: 'Account', optional: true

  validates :status_id, uniqueness: { scope: :curated_feed_id }

  scope :drafts_ordered, -> { draft.order(position: :asc, id: :asc) }
  scope :published_ordered, -> { published.order(position: :desc) }

  # Published positions live on a single global counter so that parent feeds
  # can aggregate their children with a meaningful cross-feed order. The
  # advisory lock (transaction-scoped) serializes concurrent publications;
  # callers must already be inside a transaction (with_lock on the feed).
  def self.next_global_position
    connection.execute("SELECT pg_advisory_xact_lock(hashtext('epsilon_curated_feed_items_position'))")
    published.maximum(:position).to_i + 1
  end
end
