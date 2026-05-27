# frozen_string_literal: true

class CreateEpsilonAiModerationSettings < ActiveRecord::Migration[7.1]
  def change
    create_table :epsilon_ai_moderation_settings do |t|
      t.boolean :use_native_moderation, default: false, null: false
      t.text :custom_prompt,
             default: "You are the content analysis radar for the Epsilon social network.\nYour only role is to analyze the provided text (regardless of its language) and return strict severity scores in JSON format. You do not make banning decisions; you solely measure and classify.", null: false
      t.decimal :ban_violence, precision: 3, scale: 2, default: 0.8, null: false
      t.decimal :ban_vulgarity, precision: 3, scale: 2, default: 0.8, null: false
      t.decimal :ban_sexual, precision: 3, scale: 2, default: 0.8, null: false
      t.decimal :sensitive_violence, precision: 3, scale: 2, default: 0.25, null: false
      t.decimal :sensitive_vulgarity, precision: 3, scale: 2, default: 0.25, null: false
      t.decimal :sensitive_sexual, precision: 3, scale: 2, default: 0.25, null: false
      t.decimal :review_threshold, precision: 3, scale: 2, default: 0.5, null: false

      t.timestamps
    end
  end
end
