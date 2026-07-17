# frozen_string_literal: true

# == Schema Information
#
# Table name: category_subscriptions
#
#  id                 :bigint(8)        not null, primary key
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint(8)        not null
#  category_master_id :bigint(8)
#
module CustomCategorization
  class Epsilon::Categorization::CategorySubscription < ApplicationRecord
    # On force Rails à chercher la table sans préfixe
    self.table_name = 'category_subscriptions'

    # Pointe vers le noyau Mastodon
    belongs_to :account, class_name: 'Account'

    # Pointe vers ton modèle de catégorie
    belongs_to :category_master, class_name: 'Epsilon::Categorization::CategoryMaster', counter_cache: :category_subscriptions_count

    # Validation pour s'assurer qu'il n'y a pas de doublon au niveau Ruby
    validates :category_master_id, uniqueness: { scope: :account_id }
  end
end
