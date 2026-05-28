# frozen_string_literal: true

module Admin
  module Epsilon
    class AiModerationSettingsController < Admin::BaseController
      before_action :set_setting

      def show
        authorize :epsilon_ai_moderation_setting, :show?
      end

      def update
        authorize :epsilon_ai_moderation_setting, :update?

        if @setting.update(resource_params)
          redirect_to admin_epsilon_ai_moderation_setting_path, notice: I18n.t('admin.epsilon.ai_moderation.updated')
        else
          render :show
        end
      end

      private

      def set_setting
        @setting = ::Epsilon::AiModerationSetting.current
      end

      def resource_params
        # rubocop:disable Rails/StrongParametersExpect
        params.require(:epsilon_ai_moderation_setting).permit(
          :ai_enabled,
          :use_native_moderation,
          :custom_prompt,
          :ban_violence,
          :ban_vulgarity,
          :ban_sexual,
          :sensitive_violence,
          :sensitive_vulgarity,
          :sensitive_sexual,
          :review_threshold
        )
        # rubocop:enable Rails/StrongParametersExpect
      end
    end
  end
end
