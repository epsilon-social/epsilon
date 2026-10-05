# frozen_string_literal: true

# Keeps statuses held for AI moderation (pending_ai) out of the pushed home and
# list feeds on every DB-backed (re)build path: feed regeneration after
# inactivity (populate_home), merge on follow (merge_into_home/merge_into_list)
# and the category subscription backfill, which all funnel through these
# filters. Live fan-out is already held upstream by FanOutOnWriteServiceExtension.
module Epsilon::AiModerationFeedManagerExtension
  private

  def filter_from_home(status, receiver_id, crutches, timeline_type = :home)
    return :filter if epsilon_held?(status)

    super
  end

  def filter_from_list?(status, list)
    return true if epsilon_held?(status)

    super
  end

  # Also covers boosts of a held target (edit re-moderation window).
  def epsilon_held?(status)
    status.pending_ai? || (status.reblog? && status.reblog.pending_ai?)
  end
end
