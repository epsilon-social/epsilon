# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::HashtagMapping do
  describe 'validations' do
    it 'is valid with a hashtag and a category' do
      expect(Fabricate.build(:epsilon_hashtag_mapping)).to be_valid
    end

    it 'requires a hashtag' do
      expect(Fabricate.build(:epsilon_hashtag_mapping, hashtag: nil)).to_not be_valid
    end

    it 'rejects a hashtag already mapped to the same category (case-insensitive)' do
      category = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_hashtag_mapping, category_master: category, hashtag: 'science')
      duplicate = Fabricate.build(:epsilon_hashtag_mapping, category_master: category, hashtag: 'SCIENCE')

      expect(duplicate).to_not be_valid
      expect(duplicate.errors[:hashtag]).to include('has already been taken')
    end

    it 'allows the same hashtag in a different category' do
      Fabricate(:epsilon_hashtag_mapping, hashtag: 'science')
      other = Fabricate.build(:epsilon_hashtag_mapping, hashtag: 'science')

      expect(other).to be_valid
    end
  end

  describe '.preview_per_category' do
    it 'returns at most `limit` hashtags per category, ordered by hashtag' do
      category = Fabricate(:epsilon_category_master)
      %w(delta alpha charlie bravo).each do |hashtag|
        Fabricate(:epsilon_hashtag_mapping, category_master: category, hashtag: hashtag)
      end

      preview = described_class.preview_per_category([category.id], 2)

      expect(preview.map(&:hashtag)).to eq(%w(alpha bravo))
    end

    it 'scopes the limit to each category independently' do
      first = Fabricate(:epsilon_category_master)
      second = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_hashtag_mapping, category_master: first, hashtag: 'alpha')
      Fabricate(:epsilon_hashtag_mapping, category_master: second, hashtag: 'beta')

      preview = described_class.preview_per_category([first.id, second.id], 5)

      expect(preview.map(&:hashtag)).to contain_exactly('alpha', 'beta')
    end

    it 'returns none for blank category ids' do
      expect(described_class.preview_per_category([], 5)).to eq([])
    end
  end
end
