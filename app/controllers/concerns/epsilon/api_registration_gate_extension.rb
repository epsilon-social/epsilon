# frozen_string_literal: true

# Closes API-based sign-ups (POST /api/v1/accounts). Every legitimate
# sign-up goes through the web form — the mobile apps render it in a
# webview, so even they never hit this endpoint — which makes any account
# created through the API a bot registration (the web form protections,
# captcha included, do not apply here).
#
# EPSILON_SIGNUP_APP_IDS (comma-separated Doorkeeper application ids) is an
# escape hatch should an official app ever switch to native API sign-up.
# OAuth app registration and sign-in for existing accounts are unaffected.
module Epsilon
  module ApiRegistrationGateExtension
    private

    def check_enabled_registrations
      return forbidden unless epsilon_signup_app_allowed?

      super
    end

    def epsilon_signup_app_allowed?
      ENV.fetch('EPSILON_SIGNUP_APP_IDS', '')
        .split(',')
        .map(&:strip)
        .include?(doorkeeper_token&.application&.id&.to_s)
    end
  end
end
