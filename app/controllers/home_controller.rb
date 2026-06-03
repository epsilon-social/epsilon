# frozen_string_literal: true

class HomeController < ApplicationController
  # ==========================================
  # EPSILON : UNAUTHENTICATED HOME REDIRECT
  include Epsilon::Redirect::HomeExtension
  # ==========================================

  include WebAppControllerConcern

  def index
    expires_in(15.seconds, public: true, stale_while_revalidate: 30.seconds, stale_if_error: 1.day) unless user_signed_in?
  end
end
