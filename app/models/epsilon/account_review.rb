# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_account_reviews
#
#  id                    :bigint(8)        not null, primary key
#  decided_at            :datetime
#  payload               :jsonb            not null
#  status                :integer          default("pending"), not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  account_id            :bigint(8)        not null
#  decided_by_account_id :bigint(8)
#
module Epsilon
  class AccountReview < ApplicationRecord
    self.table_name = 'epsilon_account_reviews'

    belongs_to :account
    belongs_to :decided_by_account, class_name: 'Account', optional: true

    enum :status, { pending: 0, kept: 1, rejected: 2, review: 3, watch: 4 }

    scope :recent, -> { order(updated_at: :desc) }
  end
end
