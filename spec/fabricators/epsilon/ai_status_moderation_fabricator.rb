# frozen_string_literal: true

Fabricator(:epsilon_ai_status_moderation, class_name: 'Epsilon::AiStatusModeration') do
  status
  state :unmoderated
end
