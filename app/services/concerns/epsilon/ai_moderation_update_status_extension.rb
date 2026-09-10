# frozen_string_literal: true

module Epsilon::AiModerationUpdateStatusExtension
  # Re-run AI moderation when a local status is edited.
  #
  # Native Mastodon lets an author rewrite an already-approved status freely,
  # which is a moderation bypass (post clean -> get approved -> edit into
  # anything). We treat an edit as a *proposal*: the new revision is applied and
  # saved, but its distribution is held while we flip the status back to
  # +pending_ai+ and re-moderate. Followers keep seeing the previous, approved
  # revision meanwhile (no flicker). On approval the update is distributed; on
  # rejection the previous revision is restored -- non-destructive, no strike.
  def call(status, account_id, options = {})
    @epsilon_bypass_ai = options.delete(:bypass_ai_moderation) { false }

    super
  end

  private

  # Capture whether the moderated surface (text / spoiler) actually changed,
  # right after the save. We can't read this in +broadcast_updates!+ because
  # +reset_preview_card!+ runs first and re-saves the status, wiping the
  # dirty-tracking flags.
  def update_immediate_attributes!
    super
    @epsilon_text_changed = @status.saved_change_to_text? || @status.saved_change_to_spoiler_text?
  end

  # Native +UpdateStatusService+ calls this last, after the edit has been saved
  # and its history snapshot created. Holding it here keeps the unvetted
  # revision off every timeline until the worker approves it.
  def broadcast_updates!
    if epsilon_edit_requires_moderation?
      epsilon_hold_and_remoderate!
      return
    end

    super
  end

  def epsilon_edit_requires_moderation?
    return false if @epsilon_bypass_ai
    return false unless @epsilon_text_changed

    @status.send(:epsilon_requires_moderation?)
  end

  def epsilon_hold_and_remoderate!
    @status.epsilon_ai_status_moderation_or_default.update!(state: :pending_ai)
    Epsilon::MistralModerationWorker.perform_async(@status.id, true)
  end
end
