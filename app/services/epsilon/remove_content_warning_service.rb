# frozen_string_literal: true

module Epsilon
  # Lifts a content warning the AI wrongly added to a published status. Clears
  # the sensitive flag and, only if the spoiler is the AI-generated one, the
  # spoiler text too (an author's own CW is preserved). Applied through
  # UpdateStatusService with bypass so the change federates and refreshes
  # timelines without re-triggering moderation.
  class RemoveContentWarningService < BaseService
    def call(status)
      return status unless status.sensitive?

      options = { sensitive: false, bypass_ai_moderation: true }
      options[:spoiler_text] = '' if status.spoiler_text.to_s.start_with?(::Epsilon::AiStatusModeration::AI_CW_SPOILER_PREFIX)

      UpdateStatusService.new.call(status, status.account_id, options)
      status
    end
  end
end
