# frozen_string_literal: true

class CreateEpsilonAccountReviews < ActiveRecord::Migration[8.1]
  def change
    create_table :epsilon_account_reviews do |t|
      t.references :account, null: false, index: { unique: true }, foreign_key: { on_delete: :cascade }
      t.integer :status, null: false, default: 0
      t.jsonb :payload, null: false, default: {}
      t.references :decided_by_account, index: false, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.datetime :decided_at

      t.timestamps
    end

    add_index :epsilon_account_reviews, :status

    create_table :epsilon_review_list_entries do |t|
      t.string :kind, null: false
      t.string :value, null: false
      t.integer :status, null: false, default: 0
      t.integer :hits, null: false, default: 0
      t.jsonb :payload, null: false, default: {}

      t.timestamps
    end

    add_index :epsilon_review_list_entries, [:kind, :value], unique: true

    create_table :epsilon_review_settings do |t|
      t.string :key, null: false
      t.text :value

      t.timestamps
    end

    add_index :epsilon_review_settings, :key, unique: true

    create_table :epsilon_review_runs do |t|
      t.datetime :started_at
      t.datetime :finished_at
      t.jsonb :stats, null: false, default: {}

      t.timestamps
    end
  end
end
