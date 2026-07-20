# frozen_string_literal: true

Fabricator(:epsilon_hashtag_mapping, class_name: 'Epsilon::Categorization::HashtagMapping') do
  hashtag { sequence(:epsilon_hashtag_mapping_hashtag) { |i| "hashtag#{i}" } }
  category_master(fabricator: :epsilon_category_master)
end
