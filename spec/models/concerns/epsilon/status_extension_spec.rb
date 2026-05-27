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
end
