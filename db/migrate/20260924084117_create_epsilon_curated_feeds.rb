# frozen_string_literal: true

class CreateEpsilonCuratedFeeds < ActiveRecord::Migration[8.1]
  def change
    create_table :epsilon_curated_feeds do |t|
      t.string :slug, null: false
      t.string :name, null: false
      t.jsonb :name_translations, null: false, default: {}
      t.jsonb :description_translations, null: false, default: {}
      t.string :icon
      t.references :parent, foreign_key: { to_table: :epsilon_curated_feeds, on_delete: :cascade }
      t.integer :position, null: false, default: 0
      t.integer :state, null: false, default: 0
      t.datetime :starts_at
      t.datetime :ends_at

      t.timestamps
    end

    add_index :epsilon_curated_feeds, :slug, unique: true
  end
end
