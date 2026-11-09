# frozen_string_literal: true

# Removes category-injected statuses in unwanted languages from the home
# zset after an account narrows its feed language preference. Only statuses
# whose author the account does not follow are eligible: followed content is
# the user's own editorial choice and is never language-filtered. Statuses
# without a detected language are removed too (fail-closed, consistent with
# the push-time filters).
class Epsilon::Categorization::FeedLanguageCleanupWorker
  include Sidekiq::Worker
  include Redisable

  sidekiq_options queue: 'pull', retry: 3, lock: :until_executed

  def perform(account_id)
    account = Account.find_by(id: account_id)

    return unless account&.local?

    languages = account.epsilon_feed_language_preference&.languages
    return if languages.blank?

    timeline_key = FeedManager.instance.key(:home, account.id)
    feed_ids = redis.zrange(timeline_key, 0, -1).map(&:to_i)
    return if feed_ids.empty?

    status_ids = removable_status_ids(account, feed_ids, languages)
    redis.zrem(timeline_key, status_ids) if status_ids.any?
  end

  private

  def removable_status_ids(account, feed_ids, languages)
    followed_author_ids = Follow.where(account_id: account.id).select(:target_account_id)
    categorized_ids = Epsilon::Categorization::LocalPostCategorization.where(status_id: feed_ids).select(:status_id)

    scope = Status
      .where(id: categorized_ids)
      .where.not(account_id: followed_author_ids)

    scope.where(language: nil).or(scope.where.not(language: languages)).pluck(:id)
  end
end
