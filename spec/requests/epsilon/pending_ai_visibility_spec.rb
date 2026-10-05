# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Epsilon : Pending AI moderation visibility' do
  let(:author) { Fabricate(:user) }
  let(:viewer) { Fabricate(:user) }
  let(:staff)  { Fabricate(:user, role: UserRole.find_by(name: 'Moderator')) }

  let!(:held_status)      { Fabricate(:status, account: author.account, text: 'held for moderation') }
  let!(:published_status) { Fabricate(:status, account: author.account, text: 'already published') }

  before do
    Fabricate(:epsilon_ai_status_moderation, status: held_status, state: :pending_ai)
    Fabricate(:epsilon_ai_status_moderation, status: published_status, state: :approved)
  end

  def auth_headers(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def response_ids
    response.parsed_body.pluck(:id)
  end

  describe 'GET /api/v1/timelines/public' do
    it 'hides held statuses from regular users', :aggregate_failures do
      get '/api/v1/timelines/public', headers: auth_headers(viewer)

      expect(response).to have_http_status(200)
      expect(response_ids).to include(published_status.id.to_s)
      expect(response_ids).to_not include(held_status.id.to_s)
    end

    it 'keeps held statuses visible to staff' do
      get '/api/v1/timelines/public', headers: auth_headers(staff)

      expect(response_ids).to include(held_status.id.to_s)
    end
  end

  describe 'GET /api/v1/accounts/:id/statuses' do
    it 'hides held statuses from other users', :aggregate_failures do
      get "/api/v1/accounts/#{author.account.id}/statuses", headers: auth_headers(viewer)

      expect(response_ids).to include(published_status.id.to_s)
      expect(response_ids).to_not include(held_status.id.to_s)
    end

    it 'keeps held statuses visible to their author' do
      get "/api/v1/accounts/#{author.account.id}/statuses", headers: auth_headers(author)

      expect(response_ids).to include(held_status.id.to_s)
    end

    it 'keeps held statuses visible to staff' do
      get "/api/v1/accounts/#{author.account.id}/statuses", headers: auth_headers(staff)

      expect(response_ids).to include(held_status.id.to_s)
    end
  end

  describe 'GET /api/v1/statuses/:id' do
    it 'returns 404 to other users' do
      get "/api/v1/statuses/#{held_status.id}", headers: auth_headers(viewer)

      expect(response).to have_http_status(404)
    end

    it 'stays accessible to the author' do
      get "/api/v1/statuses/#{held_status.id}", headers: auth_headers(author)

      expect(response).to have_http_status(200)
    end

    it 'stays accessible to staff' do
      get "/api/v1/statuses/#{held_status.id}", headers: auth_headers(staff)

      expect(response).to have_http_status(200)
    end
  end

  describe 'GET /api/v1/timelines/home' do
    it 'filters a held id that leaked into the home feed before the guards', :aggregate_failures do
      redis_key = FeedManager.instance.key(:home, viewer.account.id)
      redis.zadd(redis_key, held_status.id, held_status.id)
      redis.zadd(redis_key, published_status.id, published_status.id)

      get '/api/v1/timelines/home', headers: auth_headers(viewer)

      expect(response).to have_http_status(200)
      expect(response_ids).to include(published_status.id.to_s)
      expect(response_ids).to_not include(held_status.id.to_s)
    end
  end

  describe 'bypass vectors' do
    describe 'a boost of a status that went back to pending_ai (edit re-moderation)' do
      let(:booster) { Fabricate(:user) }
      let!(:boost)  { Fabricate(:status, account: booster.account, reblog: published_status) }

      before { Epsilon::AiStatusModeration.find_by(status_id: published_status.id).update!(state: :pending_ai) }

      it 'hides the boost from the booster profile for other users' do
        get "/api/v1/accounts/#{booster.account.id}/statuses", headers: auth_headers(viewer)

        expect(response_ids).to_not include(boost.id.to_s)
      end

      it 'returns 404 when fetching the boost directly' do
        get "/api/v1/statuses/#{boost.id}", headers: auth_headers(viewer)

        expect(response).to have_http_status(404)
      end

      it 'filters the boost out of a home feed that already contained it' do
        redis.zadd(FeedManager.instance.key(:home, viewer.account.id), boost.id, boost.id)

        get '/api/v1/timelines/home', headers: auth_headers(viewer)

        expect(response_ids).to_not include(boost.id.to_s)
      end
    end

    describe 'GET /api/oembed' do
      it 'returns 404 for a held status' do
        get '/api/oembed', params: { url: short_account_status_url(author.account.username, held_status) }

        expect(response).to have_http_status(404)
      end

      it 'still serves a published status' do
        get '/api/oembed', params: { url: short_account_status_url(author.account.username, published_status) }

        expect(response).to have_http_status(200)
      end
    end

    describe 'GET /users/:username/collections/featured' do
      before do
        StatusPin.create!(account: author.account, status: held_status)
        StatusPin.create!(account: author.account, status: published_status)
      end

      it 'drops held pinned statuses from the featured collection', :aggregate_failures do
        get "/users/#{author.account.username}/collections/featured", headers: { 'Accept' => 'application/activity+json' }

        expect(response).to have_http_status(200)
        expect(response.body).to include(published_status.text)
        expect(response.body).to_not include(held_status.text)
      end
    end

    describe 'GET /api/v1/statuses/:id/quotes' do
      let(:quoting_status) { Fabricate(:status, text: 'held quote content') }

      before do
        Fabricate(:quote, status: quoting_status, quoted_status: published_status, state: :accepted)
        Fabricate(:epsilon_ai_status_moderation, status: quoting_status, state: :pending_ai)
      end

      it 'hides a held quote even from the quoted status author' do
        get "/api/v1/statuses/#{published_status.id}/quotes", headers: auth_headers(author)

        expect(response_ids).to_not include(quoting_status.id.to_s)
      end
    end
  end
end
