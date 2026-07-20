# frozen_string_literal: true

Fabricator(:epsilon_local_post_categorization, class_name: 'Epsilon::Categorization::LocalPostCategorization') do
  status
  category_master(fabricator: :epsilon_category_master)
  source 'HASHTAG'
  confidence_score 100
  is_validated true
end
