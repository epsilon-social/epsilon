# frozen_string_literal: true

module Api
  module V1
    module Epsilon
      # Endpoint 1 of the session bridge: exchanges a valid first-party Bearer for
      # a short-lived, single-use bridge token. The Bearer never appears in a URL;
      # the client posts it here and receives an opaque token to hand to endpoint 2
      # (GET /auth/bridge). See docs/session_bridge.md.
      class SessionBridgeController < Api::BaseController
        before_action -> { doorkeeper_authorize! :read }
        before_action :require_user!
        before_action :require_first_party_application!
        before_action :require_non_privileged_account!

        def create
          raw_token = ::Epsilon::SessionBridge::IssueService.new.call(
            user: current_user,
            access_token: doorkeeper_token
          )

          render json: { token: raw_token, expires_in: ::Epsilon::SessionBridge::TTL_SECONDS }
        end

        private

        def require_first_party_application!
          return if ::Epsilon::SessionBridge.first_party_application?(doorkeeper_token.application)

          Rails.logger.warn("[session_bridge] rejected non-first-party issuance application_id=#{doorkeeper_token.application_id} user_id=#{current_user.id}")
          render json: { error: 'This OAuth client is not authorized to use the session bridge' }, status: 403
        end

        def require_non_privileged_account!
          return unless current_user.role.can?(*::Epsilon::SessionBridge.staff_permission_flags)

          render json: { error: 'Staff accounts cannot use the session bridge' }, status: 403
        end
      end
    end
  end
end
