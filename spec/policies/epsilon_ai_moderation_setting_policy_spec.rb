# frozen_string_literal: true

require 'rails_helper'

RSpec.describe EpsilonAiModerationSettingPolicy do
  subject { described_class }

  let(:admin_role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_reports]) }
  let(:user_role) { Fabricate(:user_role, permissions: 0) }

  let(:admin) { Fabricate(:user, role: admin_role) }
  let(:user) { Fabricate(:user, role: user_role) }

  permissions :show?, :update? do
    it 'denies access if user does not have manage_reports permission' do
      expect(subject).to_not permit(user.account, Epsilon::AiModerationSetting)
    end

    it 'grants access if user has manage_reports permission' do
      expect(subject).to permit(admin.account, Epsilon::AiModerationSetting)
    end
  end
end
