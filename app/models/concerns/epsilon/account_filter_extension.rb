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

    # Native "active" only excludes suspended accounts, so signups awaiting
    # approval or email confirmation still show up. Keep them out: they have
    # their own "pending" filter. Subqueries on users leave remote accounts
    # (no local user) untouched.
    def status_scope(value)
      return super unless value.to_s == 'active'

      super
        .where.not(id: User.pending.select(:account_id))
        .where.not(id: User.where(confirmed_at: nil).select(:account_id))
    end

    def scope_for(key, value)
      return super unless key.to_s == 'epsilon_review_status'

      epsilon_review_status_scope(value)
    end

    def epsilon_review_status_scope(value)
      value = value.to_s

      if value == 'none'
        Account.where.not(id: ::Epsilon::AccountReview.select(:account_id))
      elsif ::Epsilon::AccountReview.statuses.key?(value)
        Account.where(id: ::Epsilon::AccountReview.where(status: value).select(:account_id))
      else
        Account.none
      end
    end
  end
end
