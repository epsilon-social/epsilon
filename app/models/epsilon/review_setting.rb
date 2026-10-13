# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_review_settings
#
#  id         :bigint(8)        not null, primary key
#  key        :string           not null
#  value      :text
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
module Epsilon
  class ReviewSetting < ApplicationRecord
    self.table_name = 'epsilon_review_settings'

    validates :key, presence: true, uniqueness: true
  end
end
