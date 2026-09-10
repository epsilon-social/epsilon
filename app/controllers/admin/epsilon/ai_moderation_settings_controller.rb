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

      # Flush the fail-open backlog on demand (statuses published during an
      # outage). The scheduler stays self-gating: it still probes the API and
      # only re-checks a capped batch, so the button can't saturate Mistral.
      def remoderate
        authorize :epsilon_ai_moderation_setting, :update?

        ::Epsilon::AiRemoderationScheduler.perform_async
        redirect_to admin_epsilon_ai_moderation_setting_path, notice: I18n.t('admin.epsilon.ai_moderation.remoderation.enqueued')
      end

      private

      def health
        @health ||= ::Epsilon::AiModerationHealth.new
      end
      helper_method :health

      def set_setting
        @setting = ::Epsilon::AiModerationSetting.current
      end

      def resource_params
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
          :review_threshold,
          :rejected_retention_days
        )
        # rubocop:enable Rails/StrongParametersExpect
      end
    end
  end
end
