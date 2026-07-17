# frozen_string_literal: true

class CreateCategorySystem < ActiveRecord::Migration[7.0]
  def change
    # 1. La Taxonomie Officielle
    create_table :category_masters do |t|
      t.string :slug, null: false, limit: 50
      t.string :name, null: false, limit: 100
      t.boolean :is_active, default: true, null: false
      t.timestamps
    end
    add_index :category_masters, :slug, unique: true

    # 2. Mapping des hashtags
    create_table :hashtag_mappings, id: false do |t|
      t.string :hashtag, primary_key: true, limit: 50
      t.references :category_master, foreign_key: true
      t.timestamps
    end

    # 3. Whitelist des auteurs distants
    create_table :account_category_overrides, id: false do |t|
      t.bigint :account_id, primary_key: true
      t.references :category_master, foreign_key: true
      t.timestamps
    end

    # 4. Table des Votes (Crowdsourcing)
    create_table :category_votes do |t|
      t.bigint :status_id, null: false
      t.bigint :account_id, null: false
      t.references :category_master, foreign_key: true
      t.integer :vote_points, default: 10
      t.timestamps
    end
    # Un utilisateur ne peut voter qu'une fois par post et par catégorie
    add_index :category_votes, [:status_id, :account_id, :category_master_id], unique: true, name: 'idx_unique_category_votes'

    # 5. Table de Vérité : local_post_categorizations
    create_table :local_post_categorizations do |t|
      t.bigint :status_id, null: false
      t.references :category_master, foreign_key: true
      t.string :source, null: false, limit: 20
      t.integer :confidence_score, default: 100
      t.boolean :is_validated, default: true, null: false
      t.timestamps
    end
    add_index :local_post_categorizations, [:status_id, :category_master_id], unique: true, name: 'idx_unique_post_categories'
    add_index :local_post_categorizations, :status_id
  end
end
