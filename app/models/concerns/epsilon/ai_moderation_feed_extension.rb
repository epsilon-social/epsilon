# frozen_string_literal: true

# Filters held (pending_ai) statuses out at Redis feed hydration time. Fan-out
# never inserts held statuses, but DB-backed feed rebuilds (populate_home,
# category backfill) historically leaked their ids into home/list zsets -- and
# any id already present from before the guards were added would otherwise
# still be served. No staff bypass here: a held status never belongs in a
# pushed feed, it only becomes visible there once released.
module Epsilon::AiModerationFeedExtension
  protected

  def from_redis(limit, max_id, since_id, min_id)
    super.epsilon_without_pending_ai
  end
end
