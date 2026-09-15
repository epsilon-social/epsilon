# frozen_string_literal: true

class CreateEpsilonBadges < ActiveRecord::Migration[8.1]
  def change
    # Badge definition (e.g. "Ambassador"). Name/description are localized
    # (jsonb, EN/FR), mirroring category_masters; `name` is the canonical
    # fallback + slug source. All badges share one icon for now (license-fill),
    # only the color changes.
    create_table :epsilon_badges do |t|
      t.string :slug, null: false, limit: 50
      t.string :name, null: false, limit: 100
      t.jsonb :name_translations, null: false, default: {}
      t.jsonb :description_translations, null: false, default: {}
      t.string :color, null: false, default: '#800082'
      t.string :icon, null: false, default: 'license-fill'
      t.integer :position, null: false, default: 0
      t.boolean :is_active, null: false, default: true
      t.integer :account_badges_count, null: false, default: 0

      t.timestamps
    end

    add_index :epsilon_badges, :slug, unique: true

    # Many-to-many join: an account can carry several badges; a badge can be
    # held by many accounts.
    create_table :epsilon_account_badges do |t|
      t.bigint :account_id, null: false
      t.references :epsilon_badge, null: false, foreign_key: true

      t.timestamps
    end

    add_index :epsilon_account_badges, [:account_id, :epsilon_badge_id], unique: true, name: 'idx_unique_epsilon_account_badges'
    add_index :epsilon_account_badges, :account_id

    # Onboarding: a badge queued for an email that has no local account yet.
    # Granted automatically (and consumed) when someone confirms an account with
    # that email.
    create_table :epsilon_badge_pending_grants do |t|
      t.string :email, null: false
      t.references :epsilon_badge, null: false, foreign_key: true

      t.timestamps
    end

    add_index :epsilon_badge_pending_grants, [:email, :epsilon_badge_id], unique: true, name: 'idx_unique_epsilon_badge_pending_grants'
    add_index :epsilon_badge_pending_grants, :email
  end
end
