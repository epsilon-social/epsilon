# frozen_string_literal: true

module Epsilon::UserBadgeExtension
  extend ActiveSupport::Concern

  included do
    # Fires on any confirmation path (email link, admin confirm, skip) because
    # they all set `confirmed_at`. Grants proven ownership only: the badge lands
    # once the email is confirmed, so nobody can claim a pre-registered email
    # without controlling it.
    after_commit :epsilon_apply_pending_badge_grants, on: [:create, :update]
  end

  private

  def epsilon_apply_pending_badge_grants
    return unless saved_change_to_confirmed_at? && confirmed_at.present?

    Epsilon::ApplyPendingBadgeGrantsService.new.call(self)
  end
end
