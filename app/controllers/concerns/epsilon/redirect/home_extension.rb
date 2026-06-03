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

        return unless request.path == '/home'

        redirect_to about_path
      end
    end
  end
end
