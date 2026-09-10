# frozen_string_literal: true

module EpsilonModerationHelper
  # True when a status is still sensitive *and* the AI is the one that flagged it
  # (recorded on the moderation record), so admin views can offer to lift it.
  # Mirrors Epsilon::AiStatusModeration.with_ai_content_warning.
  def epsilon_ai_content_warning?(status)
    status.sensitive? && status.epsilon_ai_status_moderation&.ai_content_warning?
  end
end
