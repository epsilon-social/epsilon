# frozen_string_literal: true

# Loads the terms of service server-side so the view can embed them in a
# <noscript> block: crawlers that do not execute JavaScript (e.g. Google Play
# child safety standards verification) otherwise only see the empty SPA shell.
module Epsilon
  module CrawlableTermsOfServiceExtension
    extend ActiveSupport::Concern

    included do
      # No `only: :show` (the controller's sole action): the action is not
      # defined in this module, which trips Rails/LexicallyScopedActionFilter.
      before_action :epsilon_set_terms_of_service
    end

    private

    def epsilon_set_terms_of_service
      @terms_of_service = if params[:date].present?
                            TermsOfService.published.find_by(effective_date: params[:date])
                          else
                            TermsOfService.current
                          end
    end
  end
end
