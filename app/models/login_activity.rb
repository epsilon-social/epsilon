# frozen_string_literal: true

# == Schema Information
#
# Table name: login_activities
#
#  id                    :bigint(8)        not null, primary key
#  authentication_method :string
#  failure_reason        :string
#  ip                    :inet
#  provider              :string
#  success               :boolean
#  user_agent            :string
#  created_at            :datetime
#  user_id               :bigint(8)        not null
#

class LoginActivity < ApplicationRecord
  include BrowserDetection

  # ==========================================
  # EPSILON : SESSION BRIDGE
  # ==========================================
  # Additive value: sessions materialised by the OAuth -> session bridge are
  # recorded as `session_bridge` in the user's sign-in history, giving the only
  # forensic trace if a first-party Bearer is ever stolen (see docs/session_bridge.md).
  enum :authentication_method, { password: 'password', otp: 'otp', webauthn: 'webauthn', sign_in_token: 'sign_in_token', omniauth: 'omniauth', session_bridge: 'session_bridge' }
  # ==========================================

  belongs_to :user

  validates :authentication_method, inclusion: { in: authentication_methods.keys }
end
