# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API Epsilon Categorization Feed Language Preference' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/epsilon/categorization/feed_language_preference' do
    it 'requires an authenticated user' do
      get '/api/v1/epsilon/categorization/feed_language_preference'

      expect(response).to have_http_status(422)
    end

    it 'returns null languages when no preference is set' do
      get '/api/v1/epsilon/categorization/feed_language_preference', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['languages']).to be_nil
    end

    it 'returns the saved languages' do
      Fabricate(:epsilon_feed_language_preference, account: user.account, languages: ['fr'])

      get '/api/v1/epsilon/categorization/feed_language_preference', headers: headers

      expect(response.parsed_body['languages']).to eq(['fr'])
    end
  end

  describe 'PUT /api/v1/epsilon/categorization/feed_language_preference' do
    it 'saves the preference and cleans the home feed inline' do
      cleanup = instance_double(Epsilon::Categorization::FeedLanguageCleanupWorker, perform: nil)
      allow(Epsilon::Categorization::FeedLanguageCleanupWorker).to receive(:new).and_return(cleanup)

      put '/api/v1/epsilon/categorization/feed_language_preference', params: { languages: ['fr'] }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['languages']).to eq(['fr'])
      expect(user.account.reload.epsilon_feed_language_preference.languages).to eq(['fr'])
      expect(cleanup).to have_received(:perform).with(user.account.id)
    end

    it 'treats an empty list as no restriction and skips the cleanup' do
      Fabricate(:epsilon_feed_language_preference, account: user.account, languages: ['fr'])
      allow(Epsilon::Categorization::FeedLanguageCleanupWorker).to receive(:new)

      put '/api/v1/epsilon/categorization/feed_language_preference', params: { languages: [] }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['languages']).to be_nil
      expect(Epsilon::Categorization::FeedLanguageCleanupWorker).to_not have_received(:new)
    end

    it 'backfills each subscribed category inline so the client refetch sees the refilled feed' do
      category = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_category_subscription, account: user.account, category_master: category)
      backfill = instance_double(Epsilon::Categorization::SubscribeBackfillWorker, perform: nil)
      allow(Epsilon::Categorization::SubscribeBackfillWorker).to receive(:new).and_return(backfill)

      put '/api/v1/epsilon/categorization/feed_language_preference', params: { languages: [] }, headers: headers

      expect(backfill).to have_received(:perform).with(user.account.id, category.id)
    end

    it 'rejects invalid locale codes' do
      put '/api/v1/epsilon/categorization/feed_language_preference', params: { languages: ['klingon'] }, headers: headers

      expect(response).to have_http_status(422)
    end
  end
end
