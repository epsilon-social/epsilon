# frozen_string_literal: true

class CreateEpsilonCuratedFeedItems < ActiveRecord::Migration[8.1]
  def change
    create_table :epsilon_curated_feed_items do |t|
      # Single-column feed index skipped: both composite indexes below lead with it.
      t.references :curated_feed, null: false, foreign_key: { to_table: :epsilon_curated_feeds, on_delete: :cascade }, index: false
      t.references :status, null: false, foreign_key: { on_delete: :cascade }
      t.integer :state, null: false, default: 0
      t.integer :position, null: false, default: 0
      t.references :added_by_account, foreign_key: { to_table: :accounts, on_delete: :nullify }

      t.timestamps
    end

    add_index :epsilon_curated_feed_items, [:curated_feed_id, :status_id], unique: true, name: 'idx_epsilon_curated_feed_items_unique'
    add_index :epsilon_curated_feed_items, [:curated_feed_id, :state, :position], order: { position: :desc }, name: 'idx_epsilon_curated_feed_items_timeline'
  end
end
