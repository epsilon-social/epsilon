# frozen_string_literal: true

# rubocop:disable RSpec/SpecFilePathFormat
require 'rails_helper'

RSpec.describe UpdateStatusService, type: :service do
  subject { described_class.new }

  let(:author) { Fabricate(:account) }
  let(:status) { Fabricate(:status, account: author, text: 'Original approved text') }

  before do
    ENV['TEST_EPSILON_AI'] = 'true'
  end

  # Bring an already-published status into a clean "approved" state, as if it
  # had passed moderation at creation time, then drop any enqueued jobs so the
  # assertions only see what the *edit* produced.
  def approve_and_reset!
    status.epsilon_ai_status_moderation_or_default.update!(state: :approved)
    Sidekiq::Worker.clear_all
  end

  describe 'AI re-moderation on edit' do
    context 'when a standard user rewrites the text' do
      it 'flips the status back to pending_ai and enqueues the worker as an edit' do
        approve_and_reset!

        subject.call(status, author.id, text: 'A brand new, unvetted body')

        expect(status.reload.moderation_state).to eq('pending_ai')
        expect(Epsilon::MistralModerationWorker.jobs.pluck('args'))
          .to include([status.id, true])
      end

      it 'holds distribution until the worker approves the edit' do
        approve_and_reset!

        subject.call(status, author.id, text: 'A brand new, unvetted body')

        expect(DistributionWorker.jobs).to be_empty
        expect(ActivityPub::StatusUpdateDistributionWorker.jobs).to be_empty
      end
    end

    context 'when the edit only changes non-text attributes' do
      it 'does not re-moderate (the AI only reads text)' do
        approve_and_reset!

        subject.call(status, author.id, sensitive: true)

        expect(status.reload.moderation_state).to eq('approved')
        expect(Epsilon::MistralModerationWorker.jobs).to be_empty
      end
    end

    context 'when bypass_ai_moderation is passed' do
      it 'edits normally without re-moderation' do
        approve_and_reset!

        subject.call(status, author.id, text: 'System revert content', bypass_ai_moderation: true)

        expect(status.reload.moderation_state).to eq('approved')
        expect(Epsilon::MistralModerationWorker.jobs).to be_empty
        expect(DistributionWorker.jobs).to_not be_empty
      end
    end

    context 'when the author is staff' do
      let(:moderator_role) { Fabricate(:user_role, name: 'Moderator', permissions: UserRole::FLAGS[:manage_reports]) }
      let(:author) { Fabricate(:account, user: Fabricate(:user, role: moderator_role)) }

      it 'does not re-moderate staff edits' do
        approve_and_reset!

        subject.call(status, author.id, text: 'An edited official message')

        expect(status.reload.moderation_state).to eq('approved')
        expect(Epsilon::MistralModerationWorker.jobs).to be_empty
      end
    end
  end
end
# rubocop:enable RSpec/SpecFilePathFormat
