# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Epsilon : API registration gate' do
  subject do
    post '/api/v1/accounts', headers: headers, params: params
  end

  let(:client_app) { Fabricate(:application) }
  let(:token) { Fabricate(:client_credentials_token, application: client_app, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:params) { { username: 'gate_test', password: '12345678', email: 'gate@test.tld', agreement: 'true' } }

  def stub_allowlist(value)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('EPSILON_SIGNUP_APP_IDS', '').and_return(value)
  end

  context 'when no allowlist is configured (default)' do
    it 'refuses the API sign-up' do
      expect { subject }
        .to not_change(User, :count)
        .and not_change(Account, :count)

      expect(response).to have_http_status(403)
    end
  end

  context 'when the requesting application is allowlisted' do
    before { stub_allowlist(" 424242 , #{client_app.id} ") }

    it 'allows the sign-up' do
      expect { subject }
        .to change(User, :count).by(1)
        .and change(Account, :count).by(1)

      expect(response).to have_http_status(200)
    end
  end

  context 'when only another application is allowlisted' do
    before { stub_allowlist('424242') }

    it 'refuses the API sign-up' do
      expect { subject }
        .to not_change(User, :count)
        .and not_change(Account, :count)

      expect(response).to have_http_status(403)
    end
  end

  context 'when the web sign-up form is used' do
    before { Setting.registrations_mode = 'open' }

    it 'is not affected by the gate' do
      get '/auth/sign_up'

      expect(response).to have_http_status(200)
    end
  end
end
