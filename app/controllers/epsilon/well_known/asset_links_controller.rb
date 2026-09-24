# frozen_string_literal: true

module Epsilon
  module WellKnown
    # Serves the Android Digital Asset Links file that drives Android App Links
    # for the Epsilon mobile app (the Android counterpart of the AASA file).
    #
    # Same model as AppleAppSiteAssociationController:
    #   - HTTP 200 with no redirect (inherits ActionController::Base directly, so
    #     none of the app's before_actions / auth / locale filters run) — Android
    #     does not follow redirects on this file
    #   - Content-Type: application/json (render body: with raw bytes)
    #   - Publicly accessible, even if a login wall is later added on UGC routes
    #
    # Unlike the AASA URL, the Android path keeps the literal .json extension.
    # The served payload is the versioned file at config/assetlinks.json.
    class AssetLinksController < ActionController::Base # rubocop:disable Rails/ApplicationController
      FILE_PATH = Rails.root.join('config', 'assetlinks.json')

      def show
        expires_in 1.hour, public: true
        render body: File.read(FILE_PATH), content_type: 'application/json'
      end
    end
  end
end
