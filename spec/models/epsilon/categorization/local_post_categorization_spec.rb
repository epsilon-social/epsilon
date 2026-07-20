# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::LocalPostCategorization do
  describe 'validations' do
    it 'is valid with a status, a category and a source' do
      expect(Fabricate.build(:epsilon_local_post_categorization)).to be_valid
    end

    it 'requires a source' do
      expect(Fabricate.build(:epsilon_local_post_categorization, source: nil)).to_not be_valid
    end

    it 'rejects an unknown source' do
      expect(Fabricate.build(:epsilon_local_post_categorization, source: 'MAGIC')).to_not be_valid
    end

    it 'accepts every known source' do
      %w(HASHTAG AUTHOR NLP_CLUSTER CROWDSOURCING).each do |source|
        expect(Fabricate.build(:epsilon_local_post_categorization, source: source)).to be_valid
      end
    end

    it 'prevents categorizing the same status twice in one category' do
      status = Fabricate(:status)
      category = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_local_post_categorization, status: status, category_master: category)
      duplicate = Fabricate.build(:epsilon_local_post_categorization, status: status, category_master: category)

      expect(duplicate).to_not be_valid
    end
  end

  describe '.validated' do
    it 'returns only validated categorizations' do
      validated = Fabricate(:epsilon_local_post_categorization, is_validated: true)
      Fabricate(:epsilon_local_post_categorization, is_validated: false)

      expect(described_class.validated).to eq([validated])
    end
  end
end
