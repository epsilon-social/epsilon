# frozen_string_literal: true

module Epsilon::AiModerationPostStatusExtension
  def process_status!
    super

    if @options[:bypass_ai_moderation]
      @status.epsilon_bypass_ai = true
      @status.update_column(:moderation_state, Status.moderation_states[:unmoderated])
    end
  end

  private

  def requires_ai_moderation?
    user = @account.user
    return false if user.nil?
    return false if Rails.env.test? && ENV['TEST_EPSILON_AI'] != 'true'

    is_staff = user.role.present? && (user.role.can?(:manage_reports) || user.role.can?(:administrator))
    is_sentinel = @account.username == 'EpsilonSafety'

    return false if is_staff || is_sentinel
    return false if @text.blank? && @media_attachments.empty?
    return false if @options[:bypass_ai_moderation] == true

    !user.try(:trusted_debater?)
  end
end
