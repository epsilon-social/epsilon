# frozen_string_literal: true

module Epsilon
  module WellKnown
    # Serves the Apple App Site Association (AASA) file that drives iOS Universal
    # Links for the Epsilon mobile app.
    #
    # Apple's constraints (enforced by design here):
    #   - HTTP 200 with no redirect (inherits ActionController::Base directly, so
    #     none of the app's before_actions / auth / locale filters run)
    #   - Content-Type: application/json (render json: with a raw String)
    #   - Publicly accessible, even if a login wall is later added on UGC routes
    #
    # The served payload is the versioned file at config/apple-app-site-association.json.
    # Source of truth is the mobile repo (epsilon-mobile, docs/apple-app-site-association);
    # this copy additionally excludes /sidekiq (bare) and /pghero ops dashboards.
    class AppleAppSiteAssociationController < ActionController::Base # rubocop:disable Rails/ApplicationController
      FILE_PATH = Rails.root.join('config', 'apple-app-site-association.json')

      def show
        expires_in 1.hour, public: true
        # render body: (not json:) — sends the raw file bytes and bypasses
        # active_model_serializers, so the endpoint never touches current_user
        # and stays reachable with no auth in the stack.
        render body: File.read(FILE_PATH), content_type: 'application/json'
      end
    end
  end
end
