# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_review_list_entries
#
#  id         :bigint(8)        not null, primary key
#  hits       :integer          default(0), not null
#  kind       :string           not null
#  payload    :jsonb            not null
#  status     :integer          default("candidate"), not null
#  value      :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
module Epsilon
  class ReviewListEntry < ApplicationRecord
    self.table_name = 'epsilon_review_list_entries'

    enum :status, { candidate: 0, confirmed: 1 }

    validates :kind, presence: true
    validates :value, presence: true, uniqueness: { scope: :kind }

    scope :recent, -> { order(updated_at: :desc) }
  end
end
