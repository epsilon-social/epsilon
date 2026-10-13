# frozen_string_literal: true

module Admin
  module Epsilon
    class AccountReviewsController < Admin::BaseController
      # Internal flag consumed (and cleared) by the review tooling on its next
      # pass. Writing it is always safe: nothing in the app waits on it.
      ANALYSIS_REQUEST_KEY = 'analysis_requested_at'

      def index
        authorize :epsilon_account_review, :index?

        @status_counts = ::Epsilon::AccountReview.group(:status).count
        @settings      = ::Epsilon::ReviewSetting.where.not(key: ANALYSIS_REQUEST_KEY).order(:key)
        @list_entries  = ::Epsilon::ReviewListEntry.order(:status, :kind, :value)
        @runs          = ::Epsilon::ReviewRun.recent.limit(30)

        @analysis_requested_at = parse_time(::Epsilon::ReviewSetting.find_by(key: ANALYSIS_REQUEST_KEY)&.value)
      end

      def request_analysis
        authorize :epsilon_account_review, :update?

        setting = ::Epsilon::ReviewSetting.find_or_initialize_by(key: ANALYSIS_REQUEST_KEY)
        setting.update!(value: Time.now.utc.iso8601)

        redirect_to admin_epsilon_account_reviews_path, notice: I18n.t('admin.epsilon.account_reviews.analysis.requested')
      end

      private

      def parse_time(value)
        return if value.blank?

        Time.iso8601(value)
      rescue ArgumentError
        nil
      end
    end
  end
end
