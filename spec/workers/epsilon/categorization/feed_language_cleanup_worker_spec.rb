# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::FeedLanguageCleanupWorker do
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

  def categorized_status(language:, author: Fabricate(:account))
    status = Fabricate(:status, account: author, language: language)
    Fabricate(:epsilon_local_post_categorization, status: status, category_master: category)
    status
  end

  describe '#perform' do
    it 'does nothing without a language preference' do
      status = categorized_status(language: 'en')
      add_to_home(status)

      worker.perform(account.id)

      expect(home_feed_ids).to include(status.id)
    end

    context 'when the account restricts its feed to French' do
      before { Fabricate(:epsilon_feed_language_preference, account: account, languages: ['fr']) }

      it 'removes category-injected statuses in other languages' do
        status = categorized_status(language: 'en')
        add_to_home(status)

        worker.perform(account.id)

        expect(home_feed_ids).to_not include(status.id)
      end

      it 'keeps category-injected statuses in the chosen language' do
        status = categorized_status(language: 'fr')
        add_to_home(status)

        worker.perform(account.id)

        expect(home_feed_ids).to include(status.id)
      end

      it 'removes category-injected statuses without a detected language (fail-closed)' do
        status = categorized_status(language: nil)
        add_to_home(status)

        worker.perform(account.id)

        expect(home_feed_ids).to_not include(status.id)
      end

      it 'keeps statuses whose author the account follows, whatever the language' do
        author = Fabricate(:account)
        Fabricate(:follow, account: account, target_account: author)
        status = categorized_status(language: 'en', author: author)
        add_to_home(status)

        worker.perform(account.id)

        expect(home_feed_ids).to include(status.id)
      end

      it 'keeps uncategorized statuses, whatever the language' do
        status = Fabricate(:status, language: 'en')
        add_to_home(status)

        worker.perform(account.id)

        expect(home_feed_ids).to include(status.id)
      end

      it 'leaves the feed untouched for a remote account' do
        remote = Fabricate(:account, domain: 'remote.example', username: 'remote')
        Fabricate(:epsilon_feed_language_preference, account: remote, languages: ['fr'])
        status = categorized_status(language: 'en')
        add_to_home(status, remote)

        worker.perform(remote.id)

        expect(home_feed_ids(remote)).to include(status.id)
      end
    end
  end
end
