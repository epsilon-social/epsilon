# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::StatusExtension do
  let(:category) { Fabricate(:epsilon_category_master) }

  describe '.with_category' do
    it 'returns only statuses validated in the category' do
      validated = Fabricate(:status)
      Fabricate(:epsilon_local_post_categorization, status: validated, category_master: category, is_validated: true)

      unvalidated = Fabricate(:status)
      Fabricate(:epsilon_local_post_categorization, status: unvalidated, category_master: category, is_validated: false)

      Fabricate(:status)

      expect(Status.with_category(category.id)).to contain_exactly(validated)
    end
  end

  describe '.without_category' do
    it 'excludes statuses categorized in the category' do
      categorized = Fabricate(:status)
      Fabricate(:epsilon_local_post_categorization, status: categorized, category_master: category, is_validated: true)
      other = Fabricate(:status)

      result = Status.without_category(category.id)

      expect(result).to include(other)
      expect(result).to_not include(categorized)
    end
  end

  describe 'categorization enqueuing' do
    it 'enqueues the categorization worker when a status is created' do
      allow(Epsilon::Categorization::CategorizeStatusWorker).to receive(:perform_async)

      status = Fabricate(:status)

      expect(Epsilon::Categorization::CategorizeStatusWorker).to have_received(:perform_async).with(status.id)
    end
  end
end
