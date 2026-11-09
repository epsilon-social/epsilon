# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::FeedLanguagePreference do
  describe 'validations and normalization' do
    it 'accepts a list of valid locales' do
      preference = Fabricate.build(:epsilon_feed_language_preference, languages: %w(fr en))

      expect(preference).to be_valid
    end

    it 'rejects invalid locale codes' do
      preference = Fabricate.build(:epsilon_feed_language_preference, languages: ['klingon'])

      expect(preference).to_not be_valid
    end

    it 'normalizes an empty list to nil (no restriction)' do
      preference = Fabricate(:epsilon_feed_language_preference, languages: [])

      expect(preference.languages).to be_nil
    end

    it 'allows a single preference per account' do
      existing = Fabricate(:epsilon_feed_language_preference)
      duplicate = Fabricate.build(:epsilon_feed_language_preference, account: existing.account)

      expect(duplicate).to_not be_valid
    end
  end
end
