# frozen_string_literal: true

# == Schema Information
#
# Table name: local_post_categorizations
#
#  id                 :bigint(8)        not null, primary key
#  confidence_score   :integer          default(100)
#  is_validated       :boolean          default(TRUE), not null
#  source             :string(20)       not null
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  category_master_id :bigint(8)
#  status_id          :bigint(8)        not null
#
class Epsilon::Categorization::LocalPostCategorization < ApplicationRecord
  belongs_to :status
  belongs_to :category_master

  validates :source, presence: true, inclusion: { in: %w(HASHTAG AUTHOR NLP_CLUSTER CROWDSOURCING) }
  validates :status_id, uniqueness: { scope: :category_master_id }

  scope :validated, -> { where(is_validated: true) }
end
