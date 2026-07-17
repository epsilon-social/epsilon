# frozen_string_literal: true

# == Schema Information
#
# Table name: category_masters
#
#  id                           :bigint(8)        not null, primary key
#  category_subscriptions_count :integer          default(0), not null
#  is_active                    :boolean          default(TRUE), not null
#  name                         :string(100)      not null
#  name_translations            :jsonb            not null
#  slug                         :string(50)       not null
#  created_at                   :datetime         not null
#  updated_at                   :datetime         not null
#
class Epsilon::Categorization::CategoryMaster < ApplicationRecord
  # Locales an admin can provide a translated name for. Add a locale here and it
  # shows up in the admin form + is served by the API — no migration needed.
  TRANSLATED_LOCALES = %w(en fr).freeze

  has_many :hashtag_mappings, dependent: :destroy
  has_many :account_category_overrides, dependent: :destroy
  has_many :category_votes, dependent: :destroy
  has_many :local_post_categorizations, dependent: :destroy
  has_many :category_subscriptions, dependent: :destroy

  validates :slug, presence: true, uniqueness: true
  validates :name, presence: true

  scope :active, -> { where(is_active: true) }

  # Localized name, falling back to English then the canonical `name`.
  def display_name(locale = I18n.locale)
    translations = name_translations || {}
    translations[locale.to_s].presence || translations['en'].presence || name
  end
end
