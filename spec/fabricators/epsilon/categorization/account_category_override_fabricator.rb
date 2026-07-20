# frozen_string_literal: true

Fabricator(:epsilon_account_category_override, class_name: 'Epsilon::Categorization::AccountCategoryOverride') do
  account
  category_master(fabricator: :epsilon_category_master)
end
