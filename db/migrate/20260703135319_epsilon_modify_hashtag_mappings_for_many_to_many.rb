# frozen_string_literal: true

class EpsilonModifyHashtagMappingsForManyToMany < ActiveRecord::Migration[8.1]
  def up
    drop_table :hashtag_mappings, if_exists: true

    create_table :hashtag_mappings do |t|
      t.string :hashtag, null: false, limit: 50
      t.references :category_master, foreign_key: true, null: false
      t.timestamps
    end

    add_index :hashtag_mappings, [:hashtag, :category_master_id],
              unique: true,
              name: 'idx_unique_epsilon_hashtag_mapping'
  end

  def down
    drop_table :hashtag_mappings, if_exists: true

    create_table :hashtag_mappings, id: false do |t|
      t.string :hashtag, primary_key: true, limit: 50
      t.references :category_master, foreign_key: true
      t.timestamps
    end
  end
end
