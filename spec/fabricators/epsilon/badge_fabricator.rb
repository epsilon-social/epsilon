# frozen_string_literal: true

Fabricator('Epsilon::Badge') do
  slug { sequence(:epsilon_badge_slug) { |i| "badge-#{i}" } }
  name 'Ambassador'
  name_translations { { 'en' => 'Ambassador', 'fr' => 'Ambassadeur' } }
  description_translations { { 'en' => 'Founding member.', 'fr' => 'Membre fondateur.' } }
  color '#800082'
  icon 'license-fill'
end
