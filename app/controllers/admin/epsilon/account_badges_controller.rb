# frozen_string_literal: true

module Admin
  module Epsilon
    # Assign / remove a badge from the admin account moderation page.
    class AccountBadgesController < Admin::BaseController
      def create
        @account = Account.find(params[:account_id])
        authorize @account, :show?

        badge = ::Epsilon::Badge.find(params[:epsilon_badge_id])
        @account.account_badges.find_or_create_by!(badge: badge)

        redirect_to admin_account_path(@account.id), notice: t('admin.epsilon.badges.account_added', name: badge.display_name)
      end

      def destroy
        account_badge = ::Epsilon::AccountBadge.find(params[:id])
        @account = account_badge.account
        authorize @account, :show?

        account_badge.destroy!

        redirect_to admin_account_path(@account.id), notice: t('admin.epsilon.badges.account_removed')
      end
    end
  end
end
