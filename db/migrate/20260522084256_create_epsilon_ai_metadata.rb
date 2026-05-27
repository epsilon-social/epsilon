# frozen_string_literal: true

class CreateEpsilonAiMetadata < ActiveRecord::Migration[8.0]
  def change
    create_table :epsilon_ai_metadata do |t|
      t.references :status, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }

      t.jsonb :categories_raw, null: false, default: {}
      t.jsonb :mistral_payload, null: false, default: {}
      t.float :violence_score, null: false, default: 0.0

      t.timestamps
    end
  end
end
