# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::UnsubscribeCleanupWorker do
  subject(:worker) { described_class.new }

  let(:account) { Fabricate(:account) }
  let(:category) { Fabricate(:epsilon_category_master) }

  def home_key(target = account)
    FeedManager.instance.key(:home, target.id)
  end

  def add_to_home(status, target = account)
    redis.zadd(home_key(target), status.id, status.id)
  end

  def home_feed_ids(target = account)
    redis.zrange(home_key(target), 0, -1).map(&:to_i)
  end

  describe '#perform' do
    it 'leaves the feed untouched for a remote account' do
      remote = Fabricate(:account, domain: 'remote.example', username: 'remote')
      status = Fabricate(:status)
      Fabricate(:epsilon_local_post_categorization, status: status, category_master: category)
      add_to_home(status, remote)

      worker.perform(remote.id, category.id)

      expect(home_feed_ids(remote)).to include(status.id)
    end

    it 'removes statuses categorized in the unsubscribed category from the home feed' do
      status = Fabricate(:status)
      Fabricate(:epsilon_local_post_categorization, status: status, category_master: category)
      add_to_home(status)

      worker.perform(account.id, category.id)

      expect(home_feed_ids).to_not include(status.id)
    end

    it 'keeps statuses whose author the account follows' do
      author = Fabricate(:account)
      Fabricate(:follow, account: account, target_account: author)
      status = Fabricate(:status, account: author)
      Fabricate(:epsilon_local_post_categorization, status: status, category_master: category)
      add_to_home(status)

      worker.perform(account.id, category.id)

      expect(home_feed_ids).to include(status.id)
    end

    it 'keeps statuses still categorized in another subscribed category' do
      other_category = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_category_subscription, account: account, category_master: other_category)
      status = Fabricate(:status)
      Fabricate(:epsilon_local_post_categorization, status: status, category_master: category)
      Fabricate(:epsilon_local_post_categorization, status: status, category_master: other_category)
      add_to_home(status)

      worker.perform(account.id, category.id)

      expect(home_feed_ids).to include(status.id)
    end
  end
end
