# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_feed_language_preferences
#
#  id         :bigint(8)        not null, primary key
#  languages  :string           is an Array
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint(8)        not null
#
# Per-account language allowlist for category-injected home feed content.
# NULL languages means no restriction (all languages). Content from followed
# accounts is never filtered by this preference: following is the user's own
# editorial choice, only platform recommendations are scoped.
class Epsilon::Categorization::FeedLanguagePreference < ApplicationRecord
  self.table_name = 'epsilon_feed_language_preferences'

  belongs_to :account

  validates :languages, language: true
  validates :account_id, uniqueness: true

  normalizes :languages, with: ->(languages) { languages.compact_blank.presence }
end
