# frozen_string_literal: true

class CreateCategorySubscriptions < ActiveRecord::Migration[7.1]
  def change
    create_table :category_subscriptions do |t|
      # Lien vers le compte Mastodon (exactement comme dans ta table category_votes)
      t.bigint :account_id, null: false

      # Lien vers ta table de catégories
      t.references :category_master, foreign_key: true

      t.timestamps
    end

    # Une sécurité absolue : on empêche un utilisateur de s'abonner 2 fois à la même catégorie
    add_index :category_subscriptions, [:account_id, :category_master_id], unique: true, name: 'idx_unique_category_subscriptions'
  end
end
