# frozen_string_literal: true

module Epsilon
  # Restores a status that AI moderation rejected and preserved (soft-deleted).
  #
  # A rejected post was held (pending_ai) and never actually delivered, so
  # restoring it is a *fresh publish* rather than an un-delete-after-delivery:
  # we un-discard it, re-open its media, mark it approved and distribute it
  # (locally + fediverse). We also close the system report and reverse the
  # automated strike -- a false positive should leave no sanction.
  class RestoreRejectedStatusService < BaseService
    def call(status, acting_account)
      return status unless status.deleted_at?

      status.undiscard!
      UpdateMediaAttachmentsPermissionsService.new.call(status.media_attachments, :public) if status.with_media?

      ::Epsilon::AiStatusModeration.find_or_initialize_by(status_id: status.id).update!(state: :approved)

      DistributionWorker.perform_async(status.id)
      ActivityPub::DistributionWorker.perform_async(status.id) if status.account.local?

      resolve_reports!(status, acting_account)
      reverse_ai_strikes!(status)

      status
    end

    private

    # Leave a trace instead of deleting: add a note explaining the restoration,
    # then mark the report resolved (it stays, moves to the resolved tab).
    def resolve_reports!(status, acting_account)
      Report.unresolved.where('? = ANY(status_ids)', status.id.to_s).find_each do |report|
        ReportNote.create!(account: acting_account, report: report, content: I18n.t('admin.epsilon.ai_moderation.reports.restore_note'))
        report.resolve!(acting_account)
      end
    end

    def reverse_ai_strikes!(status)
      scope = AccountWarning.where(target_account: status.account)

      sentinel = Account.find_by(username: 'EpsilonSafety', domain: nil)
      scope = scope.where(account: sentinel) if sentinel

      scope.where('? = ANY(status_ids)', status.id.to_s).destroy_all
    end
  end
end
