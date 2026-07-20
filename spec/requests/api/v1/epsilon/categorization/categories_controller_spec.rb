# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API Epsilon Categorization Categories' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/epsilon/categorization/categories' do
    it 'returns active categories with their translations' do
      active   = Fabricate(:epsilon_category_master, name_translations: { 'en' => 'Science', 'fr' => 'Sciences' })
      inactive = Fabricate(:epsilon_category_master, is_active: false)

      get '/api/v1/epsilon/categorization/categories'

      expect(response).to have_http_status(200)

      slugs = response.parsed_body.pluck('slug')
      expect(slugs).to include(active.slug)
      expect(slugs).to_not include(inactive.slug)

      payload = response.parsed_body.find { |category| category['slug'] == active.slug }
      expect(payload['name_translations']).to eq('en' => 'Science', 'fr' => 'Sciences')
    end
  end

  describe 'GET /api/v1/epsilon/categorization/categories/suggested' do
    it 'requires an authenticated user' do
      get '/api/v1/epsilon/categorization/categories/suggested'

      expect(response).to have_http_status(422)
    end

    it 'excludes categories the user is already subscribed to' do
      subscribed = Fabricate(:epsilon_category_master)
      suggested  = Fabricate(:epsilon_category_master)
      user.account.category_subscriptions.create!(category_master_id: subscribed.id)

      get '/api/v1/epsilon/categorization/categories/suggested', headers: headers

      expect(response).to have_http_status(200)

      slugs = response.parsed_body.pluck('slug')
      expect(slugs).to include(suggested.slug)
      expect(slugs).to_not include(subscribed.slug)
    end
  end
end
