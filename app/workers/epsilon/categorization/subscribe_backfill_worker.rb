# frozen_string_literal: true

class Epsilon::Categorization::SubscribeBackfillWorker
  include Sidekiq::Worker
  include Redisable

  sidekiq_options queue: 'pull', retry: 3, lock: :until_executed

  BACKFILL_LIMIT = 200

  def perform(account_id, category_master_id)
    account = Account.find_by(id: account_id)

    return unless account&.local?

    statuses = backfill_statuses(account, category_master_id)
    return if statuses.empty?

    silent_merge_into_home(account, statuses)
  end

  private

  def backfill_statuses(account, category_master_id)
    status_ids = recent_status_ids(category_master_id)
    return [] if status_ids.empty?

    statuses = Status.where(id: status_ids).includes(:account, reblog: :account).to_a

    filter_home_statuses(account, statuses)
  end

  def recent_status_ids(category_master_id)
    Epsilon::Categorization::LocalPostCategorization
      .validated
      .where(category_master_id: category_master_id)
      .order(status_id: :desc)
      .limit(BACKFILL_LIMIT)
      .pluck(:status_id)
  end

  def filter_home_statuses(account, statuses)
    feed_manager = FeedManager.instance
    crutches = feed_manager.send(:build_crutches, account.id, statuses)

    statuses.reject do |status|
      feed_manager.send(:filter_from_home, status, account.id, crutches)
    end
  end

  def silent_merge_into_home(account, statuses)
    timeline_key = FeedManager.instance.key(:home, account.id)

    redis.pipelined do |pipeline|
      statuses.each do |status|
        pipeline.zadd(timeline_key, status.id, status.id)
      end
    end

    redis.zremrangebyrank(timeline_key, 0, -(FeedManager::MAX_ITEMS + 1))
  end
end
