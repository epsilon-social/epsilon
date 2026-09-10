# frozen_string_literal: true

class CreateEpsilonModerationEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :epsilon_moderation_events do |t|
      # No FKs: this is an append-only audit log that must outlive the status
      # (purged after retention) and the account (deletion). acct is denormalized
      # so the row stays readable even then.
      t.bigint :account_id
      t.string :acct
      t.bigint :status_id

      t.integer :decision, null: false, default: 0
      t.boolean :sensitive, null: false, default: false

      t.decimal :violence_score, precision: 4, scale: 3
      t.decimal :vulgarity_score, precision: 4, scale: 3
      t.decimal :sexual_score, precision: 4, scale: 3

      t.string :category
      t.string :trigger
      t.integer :source, null: false, default: 0

      t.datetime :created_at, null: false
    end

    add_index :epsilon_moderation_events, :created_at
    add_index :epsilon_moderation_events, :account_id
    add_index :epsilon_moderation_events, :decision
  end
end
