# frozen_string_literal: true

module Epsilon
  module Redirect
    module HomeExtension
      extend ActiveSupport::Concern

      included do
        before_action :epsilon_redirect_unauthenticated_from_home
      end

      private

      def epsilon_redirect_unauthenticated_from_home
        return unless action_name == 'index'

        return if user_signed_in?

        # /home and its curated-feed pills (/home/:slug) are member-only —
        # guests land on /about (curated feeds stay reachable via /discover).
        return unless request.path == '/home' || request.path.start_with?('/home/')

        redirect_to about_path
      end
    end
  end
end
