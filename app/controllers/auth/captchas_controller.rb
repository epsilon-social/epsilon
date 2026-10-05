# frozen_string_literal: true

class Auth::CaptchasController < ApplicationController
  include Auth::CaptchaConcern

  # Users going through the confirmation flow are signed in but not yet
  # functional (unconfirmed), same as in Auth::ConfirmationsController
  skip_before_action :check_self_destruct!
  skip_before_action :require_functional!

  def challenge
    raise ActiveRecord::RecordNotFound unless captcha_enabled? && captcha_provider.respond_to?(:challenge_json)

    render json: captcha_provider.challenge_json
  end
end
