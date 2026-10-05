# frozen_string_literal: true

# Hides statuses held for AI moderation (pending_ai) from the DB-backed public
# timelines. The fan-out hold (FanOutOnWriteServiceExtension) only covers the
# pushed Redis feeds; PublicFeed and TagFeed query the statuses table directly,
# so without this filter a held post was readable by anyone from the moment it
# was created. Staff keep seeing held posts (greyed in the UI) so moderators
# retain the signal. Prepended to PublicFeed; TagFeed inherits public_scope.
module Epsilon::AiModerationPublicFeedExtension
  private

  def public_scope
    scope = super
    return scope if account&.user&.can?(:manage_reports)

    scope.merge!(Status.epsilon_without_pending_ai)
    scope
  end
end
