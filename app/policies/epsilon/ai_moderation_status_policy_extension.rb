# frozen_string_literal: true

# Denies access to statuses held for AI moderation (pending_ai) to everyone but
# their author and staff. StatusPolicy#show? is the choke point for the status
# REST endpoint, the public web/embed views, ActivityPub dereferencing, thread
# contexts and search results (both via StatusFilter), and it gates every
# interaction (favourite/reblog/quote build on show?).
module Epsilon::AiModerationStatusPolicyExtension
  def show?
    return false if epsilon_held_for_ai_moderation?

    super
  end

  private

  def epsilon_held_for_ai_moderation?
    epsilon_held_status?(record) || (record.reblog? && epsilon_held_status?(record.reblog))
  end

  # A reblog is denied when its *target* is held, so a boost made while the
  # target was published cannot resurface content that went back to pending_ai
  # (edit re-moderation). Visibility exemption follows the held status' author,
  # not the booster.
  def epsilon_held_status?(status)
    status.pending_ai? && status.account_id != current_account&.id && !role.can?(:manage_reports)
  end
end
