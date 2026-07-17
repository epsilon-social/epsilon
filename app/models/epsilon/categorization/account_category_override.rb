# frozen_string_literal: true

# == Schema Information
#
# Table name: account_category_overrides
#
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint(8)        not null, primary key
#  category_master_id :bigint(8)
#
class Epsilon::Categorization::AccountCategoryOverride < ApplicationRecord
  self.primary_key = 'account_id'

  belongs_to :account
  belongs_to :category_master
end
