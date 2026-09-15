# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::ApplyPendingBadgeGrantsService do
  subject { described_class.new }

  let(:badge) { Fabricate('Epsilon::Badge') }

  describe '#call' do
    it 'grants matching pending badges and consumes the grants' do
      user = Fabricate(:user, email: 'vip@example.com')
      Fabricate('Epsilon::BadgePendingGrant', badge: badge, email: 'vip@example.com')

      subject.call(user)

      expect(user.account.epsilon_badges).to include(badge)
      expect(Epsilon::BadgePendingGrant.where(email: 'vip@example.com')).to be_empty
    end

    it 'matches the email case-insensitively' do
      user = Fabricate(:user, email: 'mixed@example.com')
      Fabricate('Epsilon::BadgePendingGrant', badge: badge, email: 'MIXED@example.com')

      subject.call(user)

      expect(user.account.reload.epsilon_badges).to include(badge)
    end

    it 'does nothing when no pending grant matches' do
      user = Fabricate(:user, email: 'nobody@example.com')

      expect { subject.call(user) }.to_not change(Epsilon::AccountBadge, :count)
    end
  end

  describe 'automatic grant on email confirmation' do
    it 'grants the badge when a user confirms their email' do
      user = Fabricate(:user, confirmed_at: nil, email: 'newcomer@example.com')
      Fabricate('Epsilon::BadgePendingGrant', badge: badge, email: 'newcomer@example.com')

      user.confirm

      expect(user.account.reload.epsilon_badges).to include(badge)
      expect(Epsilon::BadgePendingGrant.where(email: 'newcomer@example.com')).to be_empty
    end
  end
end
