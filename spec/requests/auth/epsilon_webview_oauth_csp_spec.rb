# frozen_string_literal: true

require 'rails_helper'

# ==========================================
# EPSILON : OAUTH CALLBACK IN WEBVIEW
# The native iOS app completes OAuth inside a WKWebView by redirecting to a custom
# scheme (epsilonapp://oauth/callback). WebKit enforces the CSP `form-action`
# directive across a form submission's whole redirect chain, so any page whose
# form POST ends at that scheme must NOT carry `form-action 'self'` — otherwise the
# redirect is silently cancelled and login/confirmation hangs in the app.
#
# These guards exist because the default relaxation (the controller-level
# `content_security_policy only: :new` macro) does NOT cover the 2FA page: it is
# rendered by sessions#create inside a prepend_before_action that halts the filter
# chain before the macro's before_action runs. The relaxation is therefore set
# directly in prompt_for_two_factor / confirmations_controller.
# ==========================================
RSpec.describe 'Auth OAuth-in-WebView CSP (Epsilon)' do
  # The single `form-action` directive currently emitted, or nil when dropped.
  def form_action_directive
    response.headers['Content-Security-Policy']
      &.split(';')
      &.map(&:strip)
      &.find { |directive| directive.start_with?('form-action') }
  end

  describe 'the two-factor (TOTP) page' do
    let!(:user) do
      Fabricate(:user, email: 'x@y.com', password: 'abcdefgh', otp_required_for_login: true, otp_secret: User.generate_otp_secret)
    end

    before do
      post user_session_path, params: { user: { email: user.email, password: user.password } }
    end

    it 'renders the TOTP form inline (not a completed-login redirect)' do
      expect(response).to have_http_status(200)
      expect(response.body).to include('otp_attempt')
    end

    it 'drops form-action so WebKit does not block the post-OTP redirect to the app scheme' do
      expect(form_action_directive).to be_nil
    end
  end

  describe 'the email-confirmation page' do
    before { Fabricate(:user, confirmation_token: 'foobar', confirmed_at: nil, approved: false) }

    context 'when returning to the app (redirect_to_app)' do
      before { get user_confirmation_path(confirmation_token: 'foobar', redirect_to_app: 'true') }

      it 'drops form-action for the app-return flow' do
        expect(form_action_directive).to be_nil
      end
    end

    context 'without redirect_to_app (plain web confirmation)' do
      before { get user_confirmation_path(confirmation_token: 'foobar') }

      it "keeps the default form-action 'self'" do
        expect(form_action_directive).to eq("form-action 'self'")
      end
    end
  end
end
