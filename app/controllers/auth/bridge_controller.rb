# frozen_string_literal: true

# Endpoint 2 of the session bridge: consumes a single-use bridge token and, if
# everything still checks out, materialises a normal Devise web session (same
# side effects as a real login, via the Warden `after_set_user` callback that
# creates the SessionActivation). Any failure returns a generic 401 with no
# session created. See docs/session_bridge.md.
#
# This is a wholly Epsilon-specific controller living under the native `auth/`
# namespace only because the route has to (`/auth/bridge`).
class Auth::BridgeController < ApplicationController
  def show
    payload = ::Epsilon::SessionBridge::ConsumeService.new.call(params[:token])
    return render_invalid if payload.blank?

    access_token = Doorkeeper::AccessToken.find_by(id: payload[:access_token_id])
    return render_invalid unless valid_access_token?(access_token, payload[:user_id])

    user = User.find_by(id: payload[:user_id])
    return render_invalid unless eligible_user?(user)

    # reset_session BEFORE sign_in: protects against session fixation. Also clears
    # any pre-existing challenge grace period, so the produced session cannot skip
    # password re-confirmation on sensitive screens.
    reset_session
    sign_in(user)
    record_login_activity(user)

    redirect_to '/home'
  end

  private

  # Re-validate the originating Doorkeeper token: it may have been revoked or
  # expired between issuance and consumption, and must still be the first-party
  # client's token for this exact user.
  def valid_access_token?(token, user_id)
    token.present? &&
      token.accessible? &&
      token.resource_owner_id == user_id &&
      ::Epsilon::SessionBridge.first_party_application?(token.application)
  end

  # Account state is checked explicitly here because the controller cannot rely
  # on `require_functional!` (no user is signed in when the action runs).
  def eligible_user?(user)
    user.present? &&
      user.functional? &&
      !user.role.can?(*::Epsilon::SessionBridge.staff_permission_flags)
  end

  def record_login_activity(user)
    user.login_activities.create(
      authentication_method: :session_bridge,
      success: true,
      ip: request.remote_ip,
      user_agent: request.user_agent
    )
  end

  def render_invalid
    render 'invalid', layout: false, status: 401
  end
end
