# frozen_string_literal: true

module Epsilon
  module AccountFilterExtension
    ENGAGEMENT_ORDERS = {
      'followers' => :followers_count,
      'following' => :following_count,
      'statuses' => :statuses_count,
    }.freeze

    private

    def order_scope(value)
      column = ENGAGEMENT_ORDERS[value.to_s]
      return super if column.nil?

      Account
        .left_joins(:account_stat)
        .order(AccountStat.arel_table[column].desc.nulls_last, Account.arel_table[:id].desc)
    end
  end
end
