# frozen_string_literal: true

module Admin
  module Epsilon
    # Read-only triage list of statuses stuck in the AI moderation pipeline.
    # The health panel links here; each row links out to the native admin status
    # view for the actual moderation action.
    class AiModerationsController < Admin::BaseController
      PER_PAGE = 40
      FILTERS  = %w(pending stuck needs_attention rejected sensitive).freeze

      def index
        authorize :epsilon_ai_moderation_setting, :show?

        @health      = ::Epsilon::AiModerationHealth.new
        @filter      = params[:filter].presence_in(FILTERS) || 'pending'
        @moderations = scoped_moderations.page(params[:page]).per(PER_PAGE)

        # Rejected statuses are discarded, which the Status.kept default scope
        # hides -- load them unscoped so they still render.
        @statuses = Status.unscoped.where(id: @moderations.map(&:status_id)).includes(:account).index_by(&:id)
      end

      def restore
        authorize :epsilon_ai_moderation_setting, :update?

        status = Status.unscoped.find(params[:id])
        ::Epsilon::RestoreRejectedStatusService.new.call(status, current_account)

        redirect_back_or_to admin_epsilon_ai_moderations_path(filter: 'rejected'),
                            notice: t('admin.epsilon.ai_moderation.moderations.restored')
      end

      def remove_content_warning
        authorize :epsilon_ai_moderation_setting, :update?

        status = Status.unscoped.find(params[:id])
        ::Epsilon::RemoveContentWarningService.new.call(status)

        redirect_back_or_to admin_epsilon_ai_moderations_path(filter: 'sensitive'),
                            notice: t('admin.epsilon.ai_moderation.moderations.cw_removed')
      end

      private

      def scoped_moderations
        case @filter
        when 'rejected'
          ::Epsilon::AiStatusModeration.rejected.order(updated_at: :desc)
        when 'sensitive'
          ::Epsilon::AiStatusModeration.with_ai_content_warning.order(updated_at: :desc)
        when 'stuck'
          pending_scope.where(updated_at: ..::Epsilon::AiModerationReaperScheduler::STALE_AFTER.ago)
        when 'needs_attention'
          pending_scope.where(reaper_attempts: ::Epsilon::AiModerationReaperScheduler::MAX_ATTEMPTS..)
        else
          pending_scope
        end
      end

      def pending_scope
        ::Epsilon::AiStatusModeration.pending_ai.order(updated_at: :asc)
      end
    end
  end
end
