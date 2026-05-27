# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_ai_status_moderations
#
#  id         :bigint(8)        not null, primary key
#  state      :integer          default("unmoderated"), not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  status_id  :bigint(8)        not null
#
class Epsilon::AiStatusModeration < ApplicationRecord
  belongs_to :status

  self.table_name = 'epsilon_ai_status_moderations'

  enum :state, {
    unmoderated: 0,
    pending_ai: 1,
    approved: 2,
    manual_review: 3,
    rejected: 4,
  }
end
