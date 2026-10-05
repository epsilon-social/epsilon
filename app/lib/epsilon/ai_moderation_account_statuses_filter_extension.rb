# frozen_string_literal: true

# Hides statuses held for AI moderation (pending_ai) from profile status
# listings: the REST accounts/:id/statuses API and the ActivityPub outbox both
# build on AccountStatusesFilter. The author still sees their own held posts
# (greyed in the UI), and staff keep moderator visibility.
module Epsilon::AiModerationAccountStatusesFilterExtension
  def results
    scope = super
    return scope if epsilon_exempt_viewer?

    scope.merge(Status.epsilon_without_pending_ai)
  end

  private

  def epsilon_exempt_viewer?
    return false if current_account.nil?

    current_account.id == account.id || current_account.user&.can?(:manage_reports) || false
  end
end
