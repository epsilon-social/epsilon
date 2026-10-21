# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::CategorizeStatusWorker do
  subject(:worker) { described_class.new }

  let(:category) { Fabricate(:epsilon_category_master) }

  def tagged_status(name, text: 'A neutral post')
    status = Fabricate(:status, text: text)
    status.tags << Fabricate(:tag, name: name)
    status
  end

  describe '#perform' do
    it 'does nothing when the status does not exist' do
      expect { worker.perform(-1) }
        .to_not change(Epsilon::Categorization::LocalPostCategorization, :count)
    end

    it 'skips reblogs' do
      reblog = Fabricate(:status, reblog: Fabricate(:status))

      expect { worker.perform(reblog.id) }
        .to_not change(Epsilon::Categorization::LocalPostCategorization, :count)
    end

    context 'when a hashtag maps to a category' do
      before { Fabricate(:epsilon_hashtag_mapping, category_master: category, hashtag: 'science') }

      it 'categorizes the status by hashtag and validates it' do
        status = tagged_status('science')

        worker.perform(status.id)

        categorization = Epsilon::Categorization::LocalPostCategorization.find_by(status_id: status.id, category_master_id: category.id)
        expect(categorization).to be_present
        expect(categorization.source).to eq('NLP_CLUSTER')
        expect(categorization.is_validated).to be(true)
      end
    end

    context 'when only a content word matches, below the minimum score' do
      before { Fabricate(:epsilon_hashtag_mapping, category_master: category, hashtag: 'science') }

      it 'does not categorize the status' do
        status = Fabricate(:status, text: 'I love science')
        status.tags << Fabricate(:tag, name: 'unmapped')

        worker.perform(status.id)

        expect(Epsilon::Categorization::LocalPostCategorization.where(status_id: status.id)).to be_empty
      end
    end

    context 'when there are no hashtags but the author has an override' do
      it 'categorizes the status by author' do
        status = Fabricate(:status)
        Fabricate(:epsilon_account_category_override, account: status.account, category_master: category)

        worker.perform(status.id)

        categorization = Epsilon::Categorization::LocalPostCategorization.find_by(status_id: status.id, category_master_id: category.id)
        expect(categorization).to be_present
        expect(categorization.source).to eq('AUTHOR')
      end
    end

    describe 'distribution to subscribers' do
      before { Fabricate(:epsilon_hashtag_mapping, category_master: category, hashtag: 'science') }

      it 'pushes the status to a local subscriber home feed' do
        subscriber = Fabricate(:account)
        Fabricate(:epsilon_category_subscription, account: subscriber, category_master: category)
        status = tagged_status('science')

        allow(FeedInsertWorker).to receive(:push_bulk)

        worker.perform(status.id)

        expect(FeedInsertWorker).to have_received(:push_bulk).with([subscriber.id])
      end

      it 'does not push the status back to its own author' do
        status = tagged_status('science')
        Fabricate(:epsilon_category_subscription, account: status.account, category_master: category)

        allow(FeedInsertWorker).to receive(:push_bulk)

        worker.perform(status.id)

        expect(FeedInsertWorker).to_not have_received(:push_bulk)
      end
    end

    describe 'hourly distribution cap' do
      let(:author) { Fabricate(:account) }
      let(:subscriber) { Fabricate(:account) }

      def author_tagged_status
        status = Fabricate(:status, account: author, text: 'A neutral post')
        status.tags << Tag.find_or_create_by_names('science').first
        status
      end

      before do
        Fabricate(:epsilon_hashtag_mapping, category_master: category, hashtag: 'science')
        Fabricate(:epsilon_category_subscription, account: subscriber, category_master: category)
        allow(FeedInsertWorker).to receive(:push_bulk)
      end

      it 'distributes only the first posts of the clock hour' do
        statuses = Array.new(4) { author_tagged_status }

        statuses.each { |status| described_class.new.perform(status.id) }

        expect(FeedInsertWorker).to have_received(:push_bulk).exactly(described_class::MAX_HOURLY_DISTRIBUTIONS).times
      end

      it 'still categorizes posts beyond the cap' do
        statuses = Array.new(described_class::MAX_HOURLY_DISTRIBUTIONS + 1) { author_tagged_status }

        statuses.each { |status| described_class.new.perform(status.id) }

        over_cap = statuses.last
        expect(Epsilon::Categorization::LocalPostCategorization.find_by(status_id: over_cap.id, category_master_id: category.id)).to be_present
      end

      it 'counts the cap per author' do
        other_author = Fabricate(:account)

        described_class::MAX_HOURLY_DISTRIBUTIONS.times { described_class.new.perform(author_tagged_status.id) }

        other_status = Fabricate(:status, account: other_author, text: 'A neutral post')
        other_status.tags << Tag.find_or_create_by_names('science').first
        described_class.new.perform(other_status.id)

        expect(FeedInsertWorker).to have_received(:push_bulk).exactly(described_class::MAX_HOURLY_DISTRIBUTIONS + 1).times
      end
    end
  end
end
