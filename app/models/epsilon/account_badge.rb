# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_account_badges
#
#  id               :bigint(8)        not null, primary key
#  granted_at       :datetime
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  account_id       :bigint(8)        not null
#  epsilon_badge_id :bigint(8)        not null
#
class Epsilon::AccountBadge < ApplicationRecord
  self.table_name = 'epsilon_account_badges'

  belongs_to :account, class_name: 'Account'
  belongs_to :badge, class_name: 'Epsilon::Badge', foreign_key: :epsilon_badge_id, inverse_of: :account_badges, counter_cache: :account_badges_count

  validates :epsilon_badge_id, uniqueness: { scope: :account_id }

  # Obtention date. Defaults to now, but can be back-dated (e.g. an ambassador's
  # pre-registration date). Used to gauge a badge's rarity/seniority.
  before_validation :set_granted_at, on: :create

  private

  def set_granted_at
    self.granted_at ||= Time.current
  end
end
