# frozen_string_literal: true

module Epsilon::Categorization::UnmergeWorkerExtension
  private

  # After the native unmerge wipes the unfollowed account's statuses from the
  # home feed, re-enqueue the category backfills: statuses matching one of the
  # user's category subscriptions belong in the feed whether the author is
  # followed or not. The backfill worker re-applies the home filters
  # (blocks/mutes), so the other unmerge flows stay safe.
  def unmerge_from_home!(into_account_id)
    super

    account = @into_account
    return unless account&.local?

    account.category_subscriptions.pluck(:category_master_id).each do |category_master_id|
      Epsilon::Categorization::SubscribeBackfillWorker.perform_async(account.id, category_master_id)
    end
  end
end
