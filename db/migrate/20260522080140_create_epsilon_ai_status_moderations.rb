# frozen_string_literal: true

class CreateEpsilonAiStatusModerations < ActiveRecord::Migration[8.0]
  def change
    create_table :epsilon_ai_status_moderations do |t|
      t.references :status, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.integer :state, default: 0, null: false

      t.timestamps
    end
  end
end
