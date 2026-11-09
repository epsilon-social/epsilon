# frozen_string_literal: true

class CreateEpsilonFeedLanguagePreferences < ActiveRecord::Migration[8.1]
  def change
    create_table :epsilon_feed_language_preferences do |t|
      t.references :account, null: false, index: { unique: true }, foreign_key: { on_delete: :cascade }
      t.string :languages, array: true

      t.timestamps
    end
  end
end
