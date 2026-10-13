# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_review_runs
#
#  id          :bigint(8)        not null, primary key
#  finished_at :datetime
#  started_at  :datetime
#  stats       :jsonb            not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#
module Epsilon
  class ReviewRun < ApplicationRecord
    self.table_name = 'epsilon_review_runs'

    scope :recent, -> { order(id: :desc) }
  end
end
