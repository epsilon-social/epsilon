# frozen_string_literal: true

module Admin
  module Epsilon
    class ReviewSettingsController < Admin::BaseController
      def create
        authorize :epsilon_account_review, :update?

        setting = ::Epsilon::ReviewSetting.new(resource_params)

        if setting.save
          redirect_to admin_epsilon_account_reviews_path, notice: I18n.t('admin.epsilon.account_reviews.settings.saved')
        else
          redirect_to admin_epsilon_account_reviews_path, alert: setting.errors.full_messages.to_sentence
        end
      end

      def update
        authorize :epsilon_account_review, :update?

        setting = ::Epsilon::ReviewSetting.find(params[:id])

        if setting.update(resource_params.except(:key))
          redirect_to admin_epsilon_account_reviews_path, notice: I18n.t('admin.epsilon.account_reviews.settings.saved')
        else
          redirect_to admin_epsilon_account_reviews_path, alert: setting.errors.full_messages.to_sentence
        end
      end

      def destroy
        authorize :epsilon_account_review, :update?

        ::Epsilon::ReviewSetting.find(params[:id]).destroy!
        redirect_to admin_epsilon_account_reviews_path, notice: I18n.t('admin.epsilon.account_reviews.settings.deleted')
      end

      private

      def resource_params
        params.expect(epsilon_review_setting: [:key, :value])
      end
    end
  end
end
