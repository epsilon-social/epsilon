# frozen_string_literal: true

class AddAiEnabledToEpsilonAiModerationSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :epsilon_ai_moderation_settings, :ai_enabled, :boolean, default: true, null: false
  end
end
