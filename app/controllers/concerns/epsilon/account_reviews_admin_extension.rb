# frozen_string_literal: true

module Epsilon
  # Exposes the review rows for the accounts shown on the admin accounts
  # index, loaded with a single query instead of one per row.
  module AccountReviewsAdminExtension
    def self.prepended(base)
      base.helper_method :epsilon_account_reviews
    end

    private

    def epsilon_account_reviews
      @epsilon_account_reviews ||= ::Epsilon::AccountReview
        .where(account_id: Array(@accounts).map(&:id))
        .index_by(&:account_id)
    end
  end
end
