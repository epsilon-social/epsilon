# frozen_string_literal: true

module Epsilon::Categorization::FollowServiceExtension
  private

  # Natively the home feed is flagged "partial" (the regeneration screen) when
  # a user who follows nobody starts following someone. With category
  # subscriptions the feed is already populated, so the screen would hide a
  # perfectly good feed -- and for a remote follow the flag may never clear:
  # MergeWorker (whose ensure block clears it) only runs once the remote
  # Accept arrives.
  def mark_home_feed_as_partial!
    return if @source_account.category_subscriptions.exists?

    super
  end
end
