# frozen_string_literal: true

Fabricator(:epsilon_category_subscription, class_name: 'Epsilon::Categorization::CategorySubscription') do
  account
  category_master(fabricator: :epsilon_category_master)
end
