# frozen_string_literal: true

# Loads the privacy policy server-side so the view can embed it in a
# <noscript> block: crawlers that do not execute JavaScript (e.g. Google Play
# User Data policy checks on the store-listing privacy policy URL) otherwise
# only see the empty SPA shell.
module Epsilon
  module CrawlablePrivacyPolicyExtension
    extend ActiveSupport::Concern

    included do
      # No `only: :show` (the controller's sole action): the action is not
      # defined in this module, which trips Rails/LexicallyScopedActionFilter.
      before_action :epsilon_set_privacy_policy
    end

    private

    def epsilon_set_privacy_policy
      @privacy_policy = PrivacyPolicy.current
    end
  end
end
