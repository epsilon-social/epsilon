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
  end
end
