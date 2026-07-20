# frozen_string_literal: true

Fabricator(:epsilon_category_master, class_name: 'Epsilon::Categorization::CategoryMaster') do
  name 'Science'
  slug { sequence(:epsilon_category_master_slug) { |i| "science-#{i}" } }
  name_translations { { 'en' => 'Science', 'fr' => 'Sciences' } }
  is_active true
end
