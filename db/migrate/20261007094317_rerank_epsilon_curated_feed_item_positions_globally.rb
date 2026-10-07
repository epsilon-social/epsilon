# frozen_string_literal: true

# Parent feeds now aggregate their children, so published `position` values
# must be comparable ACROSS feeds (they were per-feed ranks). Re-rank every
# published item on a single global ordering; relative order inside each feed
# is preserved (sorted by its own ascending positions first).
class RerankEpsilonCuratedFeedItemPositionsGlobally < ActiveRecord::Migration[8.1]
  def up
    # Epsilon-only table, a handful of rows — safe to rewrite in one go.
    safety_assured do
      execute <<~SQL.squish
        UPDATE epsilon_curated_feed_items AS items
        SET position = ranked.global_rank
        FROM (
          SELECT id, row_number() OVER (ORDER BY position ASC, id ASC) AS global_rank
          FROM epsilon_curated_feed_items
          WHERE state = 1
        ) AS ranked
        WHERE items.id = ranked.id
      SQL
    end
  end

  def down
    # Per-feed ranks cannot be meaningfully restored; global ranks keep every
    # per-feed ordering valid, so this is a safe no-op.
  end
end
