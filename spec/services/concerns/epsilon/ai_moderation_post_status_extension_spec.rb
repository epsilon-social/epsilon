# frozen_string_literal: true

# rubocop:disable RSpec/SpecFilePathFormat
require 'rails_helper'

RSpec.describe PostStatusService, type: :service do
  subject { described_class.new }

  let(:normal_user) { Fabricate(:account) }

  let(:admin_role) do
    UserRole.find_by(name: 'Admin') || Fabricate(:user_role, name: 'Admin', permissions: UserRole::FLAGS[:administrator] | UserRole::FLAGS[:manage_reports])
  end
  let(:admin_user) { Fabricate(:account, user: Fabricate(:user, role: admin_role)) }

  before do
    ENV['TEST_EPSILON_AI'] = 'true'
  end

  describe 'AI epsilon moderation extension' do
    context 'when the author is a standard user' do
      it 'sets the post to pending_ai and triggers Sidekiq' do
        Sidekiq::Worker.clear_all

        status = subject.call(normal_user, text: 'A normal message')

        expect(status.moderation_state).to eq('pending_ai')
        expect(Epsilon::MistralModerationWorker.jobs.size).to eq(1)
        expect(Epsilon::MistralModerationWorker.jobs.first['args']).to eq([status.id])
      end
    end

    context 'when the author is an administrator' do
      it 'leaves the post as unmoderated and does not trigger AI' do
        Sidekiq::Worker.clear_all

        status = subject.call(admin_user, text: 'An official message')

        expect(status.moderation_state).to eq('unmoderated')
        expect(Epsilon::MistralModerationWorker.jobs.size).to eq(0)
      end
    end
  end
end
# rubocop:enable RSpec/SpecFilePathFormat
