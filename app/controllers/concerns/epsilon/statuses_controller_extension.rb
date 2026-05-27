# frozen_string_literal: true

module Epsilon
  module StatusesControllerExtension
    extend ActiveSupport::Concern

    included do
      before_action :epsilon_clean_empty_poll_param, only: :create # rubocop:disable Rails/LexicallyScopedActionFilter
    end

    private

    def epsilon_clean_empty_poll_param
      params.delete(:poll) if params[:poll].blank?
    end
  end
end
