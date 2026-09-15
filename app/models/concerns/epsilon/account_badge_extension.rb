# frozen_string_literal: true

module Epsilon::AccountBadgeExtension
  extend ActiveSupport::Concern

  included do
    has_many :account_badges, class_name: 'Epsilon::AccountBadge', dependent: :destroy
    has_many :epsilon_badges, -> { active.in_display_order }, through: :account_badges, source: :badge
  end
end
