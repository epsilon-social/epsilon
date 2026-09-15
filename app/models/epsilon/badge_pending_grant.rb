# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_badge_pending_grants
#
#  id               :bigint(8)        not null, primary key
#  email            :string           not null
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  epsilon_badge_id :bigint(8)        not null
#
class Epsilon::BadgePendingGrant < ApplicationRecord
  self.table_name = 'epsilon_badge_pending_grants'

  belongs_to :badge, class_name: 'Epsilon::Badge', foreign_key: :epsilon_badge_id, inverse_of: :pending_grants

  normalizes :email, with: ->(email) { email.to_s.strip.delete_prefix('@').downcase }

  validates :email, presence: true
  validates :email, uniqueness: { scope: :epsilon_badge_id, case_sensitive: false }
end
