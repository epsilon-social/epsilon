# frozen_string_literal: true

module Epsilon::Categorization::AccountExtension
  extend ActiveSupport::Concern

  included do
    has_many :category_votes, class_name: 'Epsilon::Categorization::CategoryVote', dependent: :destroy
    has_one :account_category_override, class_name: 'Epsilon::Categorization::AccountCategoryOverride', dependent: :destroy

    has_many :category_subscriptions, class_name: 'Epsilon::Categorization::CategorySubscription', dependent: :destroy
    has_many :subscribed_categories, through: :category_subscriptions, source: :category_master
  end
end
