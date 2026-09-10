# frozen_string_literal: true

class AddRejectedRetentionToEpsilonAiModerationSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :epsilon_ai_moderation_settings, :rejected_retention_days, :integer, default: 90, null: false
  end
end
