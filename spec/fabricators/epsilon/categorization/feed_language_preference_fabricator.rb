# frozen_string_literal: true

Fabricator(:epsilon_feed_language_preference, class_name: 'Epsilon::Categorization::FeedLanguagePreference') do
  account
  languages ['fr']
end
