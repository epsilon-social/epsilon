# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session bridge consumption' do
  let(:application)  { Fabricate(:application) }
  let(:user)         { Fabricate(:user) }
  let(:access_token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, application: application, scopes: 'read') }
  let(:raw_token)    { Epsilon::SessionBridge::IssueService.new.call(user: user, access_token: access_token) }

  around do |example|
    ClimateControl.modify(EPSILON_FIRST_PARTY_CLIENT_ID: application.uid) { example.run }
  end

  def consume(token = raw_token)
    get '/auth/bridge', params: { token: token }
  end

  context 'with a valid bridge token (must be equivalent to a normal login)' do
    it 'redirects to /home' do
      consume
      expect(response).to redirect_to('/home')
    end

    it 'creates exactly one session activation, backed by a read/write/follow web token' do
      expect { consume }.to change { user.session_activations.count }.by(1)

      expect(user.session_activations.last.access_token.scopes.to_s).to eq('read write follow')
    end

    it 'sets the signed _session_id cookie' do
      consume
      expect(response.cookies['_session_id']).to be_present
    end

    it 'does NOT inflate the trackable sign-in count' do
      expect { consume }.to_not(change { user.reload.sign_in_count })
    end

    it 'records a session_bridge login activity' do
      consume

      activity = user.login_activities.last
      expect(activity.authentication_method).to eq('session_bridge')
      expect(activity.success).to be(true)
    end
  end

  context 'when the same token is presented twice (replay)' do
    it 'succeeds once, then fails' do
      consume
      expect(response).to redirect_to('/home')

      consume
      expect(response).to have_http_status(401)
    end
  end

  context 'when the token has expired (vanished from Redis)' do
    it 'returns http unauthorized and creates no session' do
      redis.del(Epsilon::SessionBridge.redis_key(raw_token))

      expect { consume }.to_not(change { user.session_activations.count })
      expect(response).to have_http_status(401)
    end
  end

  context 'with an unknown, empty, missing or non-string token' do
    it 'rejects an unknown token' do
      consume('does-not-exist')
      expect(response).to have_http_status(401)
    end

    it 'rejects an empty token' do
      consume('')
      expect(response).to have_http_status(401)
    end

    it 'rejects a missing token param' do
      get '/auth/bridge'
      expect(response).to have_http_status(401)
    end

    it 'rejects a non-string (array) token param without raising a 500' do
      get '/auth/bridge', params: { token: %w(a b) }
      expect(response).to have_http_status(401)
    end
  end

  context 'when the originating access token was revoked after issuance' do
    it 'returns http unauthorized and creates no session' do
      raw_token
      access_token.revoke

      expect { consume }.to_not(change { user.session_activations.count })
      expect(response).to have_http_status(401)
    end
  end

  context 'when the account was suspended after issuance' do
    it 'returns http unauthorized' do
      raw_token
      user.account.suspend!

      consume
      expect(response).to have_http_status(401)
    end
  end

  context 'when the account carries a moderation permission' do
    let(:user) { Fabricate(:user, role: Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_reports])) }

    it 'returns http unauthorized' do
      consume
      expect(response).to have_http_status(401)
    end
  end

  context 'when the token belongs to a non-first-party application' do
    it 'returns http unauthorized even though the token is still live' do
      raw_token # issued while the config points at the token's application

      ClimateControl.modify(EPSILON_FIRST_PARTY_CLIENT_ID: 'a-different-client') do
        consume
      end

      expect(response).to have_http_status(401)
    end
  end
end
