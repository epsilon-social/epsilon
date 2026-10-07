# frozen_string_literal: true

# Parent feeds aggregate their children: `WHERE curated_feed_id IN (…) ORDER
# BY position DESC LIMIT n` cannot be served in order by the per-feed index
# (leading on curated_feed_id), forcing a full sort of the union on every
# page. This global (state, position DESC) index lets Postgres walk positions
# in order and stop at the first n matching rows — and serves the global
# MAX(position) used at publication time.
class AddGlobalTimelineIndexToEpsilonCuratedFeedItems < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_index :epsilon_curated_feed_items, [:state, :position, :curated_feed_id],
              order: { position: :desc },
              name: 'idx_epsilon_curated_feed_items_global_timeline',
              algorithm: :concurrently
  end
end
