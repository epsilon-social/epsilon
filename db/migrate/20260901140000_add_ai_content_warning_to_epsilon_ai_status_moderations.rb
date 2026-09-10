# frozen_string_literal: true

class AddAiContentWarningToEpsilonAiStatusModerations < ActiveRecord::Migration[8.1]
  def change
    add_column :epsilon_ai_status_moderations, :ai_content_warning, :boolean, default: false, null: false
  end
end
