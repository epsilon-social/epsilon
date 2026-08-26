# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session bridge issuance' do
  subject { post '/api/v1/epsilon/session_bridge', headers: headers }

  let(:application) { Fabricate(:application) }
  let(:user)        { Fabricate(:user) }
  let(:token)       { Fabricate(:accessible_access_token, resource_owner_id: user.id, application: application, scopes: 'read') }
  let(:headers)     { { 'Authorization' => "Bearer #{token.token}" } }

  around do |example|
    ClimateControl.modify(EPSILON_FIRST_PARTY_CLIENT_ID: application.uid) { example.run }
  end

  context 'with a valid first-party Bearer for an ordinary account' do
    it 'returns a single-use bridge token with a 30s lifetime' do
      subject

      expect(response).to have_http_status(200)
      expect(response.parsed_body[:expires_in]).to eq(30)

      raw = response.parsed_body[:token]
      expect(raw).to be_present
      expect(redis.exists?(Epsilon::SessionBridge.redis_key(raw))).to be(true)
    end
  end

  context 'without a Bearer' do
    let(:headers) { {} }

    it 'returns http unauthorized' do
      subject
      expect(response).to have_http_status(401)
    end
  end

  context 'when the token lacks the read scope' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, application: application, scopes: 'write') }

    it 'returns http forbidden' do
      subject
      expect(response).to have_http_status(403)
    end
  end

  context 'when the token belongs to a non-first-party application' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, application: Fabricate(:application), scopes: 'read') }

    it 'returns http forbidden and issues nothing' do
      subject
      expect(response).to have_http_status(403)
    end
  end

  context 'when the first-party client is not configured (fail-closed)' do
    around do |example|
      ClimateControl.modify(EPSILON_FIRST_PARTY_CLIENT_ID: nil) { example.run }
    end

    it 'returns http forbidden' do
      subject
      expect(response).to have_http_status(403)
    end
  end

  context 'when the account carries a moderation permission' do
    let(:user) { Fabricate(:user, role: Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_reports])) }

    it 'returns http forbidden' do
      subject
      expect(response).to have_http_status(403)
    end
  end

  context 'when the account is suspended' do
    before { user.account.suspend! }

    it 'returns http forbidden' do
      subject
      expect(response).to have_http_status(403)
    end
  end
end
