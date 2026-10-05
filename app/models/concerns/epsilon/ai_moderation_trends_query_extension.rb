# frozen_string_literal: true

# Trending statuses are read straight from status_trends with no per-item
# authorization. A held (pending_ai) status is unlikely to trend -- it cannot
# be favourited or reblogged by regular users anymore -- but the author can
# still interact with their own held post, so keep the held set out of the
# trends query as defence in depth.
module Epsilon::AiModerationTrendsQueryExtension
  def to_arel
    # unscoped: merging a relation that carries the Status default scope would
    # replace the trends' ORDER BY score with the default chronological order.
    super.merge(Status.unscoped.epsilon_without_pending_ai)
  end
end
