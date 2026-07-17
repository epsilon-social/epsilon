# frozen_string_literal: true

class Epsilon::Categorization::UnsubscribeCleanupWorker
  include Sidekiq::Worker
  include Redisable

  sidekiq_options queue: 'pull', retry: 3, lock: :until_executed

  CLEANUP_LIMIT = 400

  def perform(account_id, category_master_id)
    account = Account.find_by(id: account_id)

    return unless account&.local?

    status_ids = removable_status_ids(account, category_master_id)
    return if status_ids.empty?

    redis.zrem(FeedManager.instance.key(:home, account.id), status_ids)
  end

  private

  def removable_status_ids(account, category_master_id)
    followed_author_ids = Follow.where(account_id: account.id).select(:target_account_id)

    Epsilon::Categorization::LocalPostCategorization
      .where(category_master_id: category_master_id)
      .joins(:status)
      .where.not(statuses: { account_id: followed_author_ids })
      .where.not(status_id: protected_status_ids(account, category_master_id))
      .order(status_id: :desc)
      .limit(CLEANUP_LIMIT)
      .pluck(:status_id)
  end

  def protected_status_ids(account, category_master_id)
    still_subscribed_ids = Epsilon::Categorization::CategorySubscription
      .where(account_id: account.id)
      .where.not(category_master_id: category_master_id)
      .select(:category_master_id)

    Epsilon::Categorization::LocalPostCategorization
      .where(category_master_id: still_subscribed_ids)
      .select(:status_id)
  end
end
