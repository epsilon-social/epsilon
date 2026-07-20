# frozen_string_literal: true

Fabricator(:epsilon_category_vote, class_name: 'Epsilon::Categorization::CategoryVote') do
  status
  account
  category_master(fabricator: :epsilon_category_master)
end
