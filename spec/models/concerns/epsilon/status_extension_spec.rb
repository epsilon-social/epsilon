# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Epsilon::StatusExtension' do
  let(:author) { Fabricate(:account) }

  describe 'AI moderation bypass' do
    it 'leaves the post as unmoderated when epsilon_bypass_ai is true' do
      Sidekiq::Worker.clear_all

      status = Fabricate.build(:status, account: author, text: 'Automated message')

      status.epsilon_bypass_ai = true
      status.save!

      expect(status.unmoderated?).to be true
      expect(status.moderation_state).to eq('unmoderated')
      expect(Epsilon::MistralModerationWorker.jobs.size).to eq(0)
    end
  end

  describe 'AI Moderation Kill Switch (ai_enabled)' do
    let(:account) { Fabricate(:account, domain: nil) }
    let(:setting) { Epsilon::AiModerationSetting.current }

    before do
      ENV['TEST_EPSILON_AI'] = 'true'
    end

    after do
      ENV.delete('TEST_EPSILON_AI')
    end

    context 'when AI moderation is enabled (ai_enabled: true)' do
      before do
        setting.update!(ai_enabled: true)
      end

      it 'triggers AI moderation and sets the status to pending_ai' do
        status = Fabricate(:status, account: account)

        expect(status.epsilon_ai_status_moderation_or_default.state).to eq('pending_ai')
      end
    end

    context 'when AI moderation is disabled (Kill Switch activated)' do
      before do
        setting.update!(ai_enabled: false)
      end

      it 'bypasses AI moderation entirely and leaves the status unmoderated' do
        status = Fabricate(:status, account: account)

        expect(status.epsilon_ai_status_moderation_or_default.state).to eq('unmoderated')
      end
    end
  end

  describe 'private messages (direct visibility)' do
    let(:account) { Fabricate(:account, domain: nil) }

    before do
      ENV['TEST_EPSILON_AI'] = 'true'
      Epsilon::AiModerationSetting.current.update!(ai_enabled: true)
    end

    after { ENV.delete('TEST_EPSILON_AI') }

    it 'never sends a direct message to AI moderation' do
      status = Fabricate(:status, account: account, visibility: :direct)

      expect(status.epsilon_ai_status_moderation_or_default.state).to eq('unmoderated')
      expect(Epsilon::MistralModerationWorker.jobs.size).to eq(0)
    end

    it 'still moderates a public post from the same account' do
      status = Fabricate(:status, account: account, visibility: :public)

      expect(status.epsilon_ai_status_moderation_or_default.state).to eq('pending_ai')
    end
  end
end
