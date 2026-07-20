# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API Epsilon Categorization Subscriptions' do
  let(:user)     { Fabricate(:user) }
  let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers)  { { 'Authorization' => "Bearer #{token.token}" } }
  let(:category) { Fabricate(:epsilon_category_master) }

  before do
    allow(Epsilon::Categorization::SubscribeBackfillWorker).to receive(:new)
      .and_return(instance_double(Epsilon::Categorization::SubscribeBackfillWorker, perform: nil))
    allow(Epsilon::Categorization::UnsubscribeCleanupWorker).to receive(:new)
      .and_return(instance_double(Epsilon::Categorization::UnsubscribeCleanupWorker, perform: nil))
  end

  describe 'GET /api/v1/epsilon/categorization/subscriptions' do
    it 'requires an authenticated user' do
      get '/api/v1/epsilon/categorization/subscriptions'

      expect(response).to have_http_status(422)
    end

    it 'returns the subscribed category ids' do
      user.account.category_subscriptions.create!(category_master_id: category.id)

      get '/api/v1/epsilon/categorization/subscriptions', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to eq([category.id])
    end
  end

  describe 'POST /api/v1/epsilon/categorization/subscriptions/:category_id' do
    it 'subscribes the user to the category' do
      expect { post "/api/v1/epsilon/categorization/subscriptions/#{category.id}", headers: headers }
        .to change { user.account.subscribed_categories.count }.by(1)

      expect(response).to have_http_status(200)
      expect(response.parsed_body['subscribed_ids']).to include(category.id)
    end
  end

  describe 'PUT /api/v1/epsilon/categorization/subscriptions' do
    it 'replaces the whole set of subscriptions' do
      previous = Fabricate(:epsilon_category_master)
      user.account.category_subscriptions.create!(category_master_id: previous.id)

      put '/api/v1/epsilon/categorization/subscriptions', params: { category_ids: [category.id] }, headers: headers

      expect(response).to have_http_status(200)
      expect(user.account.reload.subscribed_categories.pluck(:id)).to eq([category.id])
    end
  end

  describe 'DELETE /api/v1/epsilon/categorization/subscriptions/:category_id' do
    it 'unsubscribes the user from the category' do
      user.account.category_subscriptions.create!(category_master_id: category.id)

      expect { delete "/api/v1/epsilon/categorization/subscriptions/#{category.id}", headers: headers }
        .to change { user.account.subscribed_categories.count }.by(-1)

      expect(response).to have_http_status(200)
    end
  end
end
