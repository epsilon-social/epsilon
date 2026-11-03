# frozen_string_literal: true

# Keep server rules (they power the child-safety category in the in-app
# report flow, and the /about page) without adding the native rules-acceptance
# page to the sign-up funnel: the mandatory terms-of-service checkbox on the
# registration form already carries acceptance of the same rules (terms §8.1).
module Epsilon
  module SkipRulesInterstitialExtension
    private

    def require_rules_acceptance!; end
  end
end
