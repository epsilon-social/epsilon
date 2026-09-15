# frozen_string_literal: true

# Grants any pending badges matching a freshly-confirmed user's email, then
# consumes those pending grants. Called when a user's email becomes confirmed.
class Epsilon::ApplyPendingBadgeGrantsService
  def call(user)
    account = user.account
    email = user.email.to_s.strip.downcase
    return if account.nil? || email.blank?

    grants = Epsilon::BadgePendingGrant.where(email: email)
    return if grants.empty?

    grants.includes(:badge).find_each do |grant|
      # `granted_at` defaults to now (the sign-up moment) — the obtention date is
      # when the account is actually created, not the invitation/import time.
      Epsilon::AccountBadge.find_or_create_by!(account: account, badge: grant.badge)
    end

    grants.delete_all
  end
end
