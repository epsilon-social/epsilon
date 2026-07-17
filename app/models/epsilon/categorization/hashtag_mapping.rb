# frozen_string_literal: true

# == Schema Information
#
# Table name: hashtag_mappings
#
#  id                 :bigint(8)        not null, primary key
#  hashtag            :string(50)       not null
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  category_master_id :bigint(8)        not null
#
class Epsilon::Categorization::HashtagMapping < ApplicationRecord
  belongs_to :category_master

  validates :hashtag, presence: true, uniqueness: { scope: :category_master_id, case_sensitive: false }

  def self.preview_per_category(category_ids, limit)
    return none if category_ids.blank?

    ranked = where(category_master_id: category_ids)
      .select('hashtag_mappings.*, ROW_NUMBER() OVER (PARTITION BY category_master_id ORDER BY hashtag) AS epsilon_row_number')

    from(ranked, :hashtag_mappings)
      .where(epsilon_row_number: ..limit)
      .order(:category_master_id, :hashtag)
  end
end
