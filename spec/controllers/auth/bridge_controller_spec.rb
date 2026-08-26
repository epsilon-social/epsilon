# frozen_string_literal: true

require 'rails_helper'

# The session-fixation guarantee (reset_session BEFORE sign_in) is asserted here,
# in a controller spec, because it is the only harness that lets us seed a session
# value before the action and observe that it was cleared. The full-stack session
# creation is covered by spec/requests/auth/bridge_spec.rb.
RSpec.describe Auth::BridgeController do
  let(:application)  { Fabricate(:application) }
  let(:user)         { Fabricate(:user) }
  let(:access_token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, application: application, scopes: 'read') }
  let(:raw_token)    { Epsilon::SessionBridge::IssueService.new.call(user: user, access_token: access_token) }

  around do |example|
    ClimateControl.modify(EPSILON_FIRST_PARTY_CLIENT_ID: application.uid) { example.run }
  end

  describe 'GET #show' do
    it 'resets the session before signing in, dropping any pre-existing session state' do
      session[:fixation_probe] = 'attacker-fixed-value'

      get :show, params: { token: raw_token }

      expect(session[:fixation_probe]).to be_nil
      expect(response).to redirect_to('/home')
    end
  end
end
