# frozen_string_literal: true

module Epsilon::StatusSerializerExtension
  extend ActiveSupport::Concern

  included do
    attribute :moderation_state
    attribute :ai_moderated
  end

  def moderation_state
    object.epsilon_ai_status_moderation_or_default.state
  end

  def ai_moderated
    object.epsilon_ai_status_moderation_or_default.approved?
  end
end
