# frozen_string_literal: true

# Side effects applied once a Mistral verdict is known: system reports, strikes,
# the non-destructive preserve, explanation DMs, and lifting/adding a content
# warning. Shared by the live worker (Epsilon::MistralModerationWorker) and the
# re-moderation backlog worker (Epsilon::AiRemoderationWorker) so the two never
# drift on how a rejection or a review is recorded.
module Epsilon::ModerationVerdictActions
  extend ActiveSupport::Concern

  def trigger_system_report!(status, reason, score, reasoning)
    comment = I18n.t('epsilon.moderation.system.report',
                     reason: reason.upcase,
                     score: score.round(3),
                     details: "Analyse IA : #{reasoning}")

    ReportService.new.call(Account.representative, status.account, status_ids: [status.id], comment: comment)
  end

  # A rejected local post is *preserved*, not destroyed. We strike the author,
  # file a system report so the removal is reviewable + restorable from
  # /admin/reports, and soft-delete the status (preserve: true keeps the row
  # and its media, just hidden everywhere). A false positive can be restored
  # within the retention window; RejectedContentPurgeScheduler hard-deletes it
  # afterwards.
  def create_strike_and_preserve!(status, reason, score, sentinel, category)
    warning_text = I18n.t('epsilon.moderation.message.deleted.reason',
                          reason: reason.upcase,
                          score: score.round(3),
                          content: status.text)

    source_tag = category == 'Modération Native' ? '[API NATIVE]' : '[LLM MISTRAL]'
    final_text = "#{warning_text}\n\nScore: #{score.round(3)}\nSource: #{source_tag} - #{category}"

    AccountWarning.create!(
      target_account: status.account,
      account: sentinel,
      action: :delete_statuses,
      text: final_text,
      status_ids: [status.id.to_s]
    )

    ReportService.new.call(
      Account.representative,
      status.account,
      status_ids: [status.id],
      comment: I18n.t('epsilon.moderation.system.reject_report', reason: reason.upcase, score: score.round(3))
    )

    RemoveStatusService.new.call(status, preserve: true)
  end

  # Add the AI content warning to an *already published* status, propagated as an
  # update (UpdateStatusService broadcasts an edit) so copies already on timelines
  # and the fediverse get the warning -- without a fresh fan-out that would
  # re-insert it. Used by re-moderation; the live worker sets the CW inline before
  # its first distribution instead.
  def apply_content_warning!(status, reason)
    options = { sensitive: true, bypass_ai_moderation: true }
    options[:spoiler_text] = "Contenu sensible : #{reason.capitalize}" if status.spoiler_text.blank?

    UpdateStatusService.new.call(status, status.account_id, options)
  end

  def send_explanation_dm(target_status, sender, type, reason, score, category, message)
    author = target_status.account

    recipient_locale = author.user&.locale || I18n.default_locale

    text = I18n.with_locale(recipient_locale) do
      case type
      when :review
        I18n.t('epsilon.moderation.message.review',
               username: author.username,
               reason: reason)
      when :edit_reverted
        I18n.t('epsilon.moderation.message.edit_reverted.dm',
               username: author.username,
               reason: reason.upcase)
      else
        I18n.t('epsilon.moderation.message.deleted.dm',
               username: author.username,
               reason: reason.upcase)
      end
    end

    safe_message = message.to_s.gsub('@', '[at]')
    source_tag = category == 'Modération Native' ? '[API NATIVE]' : '[LLM MISTRAL]'
    final_text = "#{text}\n\nScore: #{score.round(3)}\nSource: #{source_tag} - #{category}\nMessage: #{safe_message}"

    PostStatusService.new.call(
      sender,
      text: final_text,
      visibility: :direct
    )
  end
end
