# frozen_string_literal: true

# == Schema Information
#
# Table name: category_votes
#
#  id                 :bigint(8)        not null, primary key
#  vote_points        :integer          default(10)
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint(8)        not null
#  category_master_id :bigint(8)
#  status_id          :bigint(8)        not null
#
class Epsilon::Categorization::CategoryVote < ApplicationRecord
  belongs_to :status
  belongs_to :account
  belongs_to :category_master
  validates :status_id, uniqueness: { scope: [:account_id, :category_master_id], message: I18n.t('epsilon_cat.vote.has_voted') }
end
