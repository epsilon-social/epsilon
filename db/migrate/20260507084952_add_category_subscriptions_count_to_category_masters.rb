# frozen_string_literal: true

class AddCategorySubscriptionsCountToCategoryMasters < ActiveRecord::Migration[8.0]
  def up
    add_column :category_masters, :category_subscriptions_count, :integer, default: 0, null: false

    Epsilon::Categorization::CategoryMaster.reset_column_information

    Epsilon::Categorization::CategoryMaster.find_each do |category|
      Epsilon::Categorization::CategoryMaster.reset_counters(category.id, :category_subscriptions)
    end
  end

  def down
    remove_column :category_masters, :category_subscriptions_count
  end
end
