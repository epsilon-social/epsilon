# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Admin::Epsilon::AccountBadgesController do
  let(:role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_users]) }
  let(:user) { Fabricate(:user, role: role) }
  let(:account) { Fabricate(:account) }
  let(:badge) { Fabricate('Epsilon::Badge') }

  before { sign_in user, scope: :user }

  describe 'POST #create' do
    it 'assigns the badge to the account with an obtention date' do
      post :create, params: { account_id: account.id, epsilon_badge_id: badge.id }

      account_badge = account.account_badges.find_by(badge: badge)
      expect(account_badge).to be_present
      expect(account_badge.granted_at).to be_present
      expect(response).to redirect_to(admin_account_path(account.id))
    end
  end

  describe 'DELETE #destroy' do
    it 'removes the badge from the account' do
      account_badge = account.account_badges.create!(badge: badge)

      delete :destroy, params: { id: account_badge.id }

      expect(Epsilon::AccountBadge.exists?(account_badge.id)).to be(false)
      expect(response).to redirect_to(admin_account_path(account.id))
    end
  end
end
