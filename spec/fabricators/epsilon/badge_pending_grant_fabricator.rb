# frozen_string_literal: true

Fabricator('Epsilon::BadgePendingGrant') do
  badge { Fabricate('Epsilon::Badge') }
  email { sequence(:epsilon_pending_email) { |i| "pending#{i}@example.com" } }
end
