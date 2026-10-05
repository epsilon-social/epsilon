# frozen_string_literal: true

# Hides statuses held for AI moderation (pending_ai) from the public profile
# RSS feed, which queries the statuses table directly (AccountsController
# builds @statuses from default_statuses for the RSS format only).
module Epsilon::AiModerationAccountsControllerExtension
  private

  def default_statuses
    super.merge(Status.epsilon_without_pending_ai)
  end
end
