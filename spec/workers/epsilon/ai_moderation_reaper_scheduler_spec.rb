# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::AiModerationReaperScheduler do
  subject(:worker) { described_class.new }

  let(:status) { Fabricate(:status) }
  let(:fan_out) { instance_double(FanOutOnWriteService, call: true) }
  let(:report_service) { instance_double(ReportService, call: true) }

  before do
    allow(FanOutOnWriteService).to receive(:new).and_return(fan_out)
    allow(ReportService).to receive(:new).and_return(report_service)
  end

  # Force the moderation row into a given state/age/attempt count, bypassing
  # touch so the +updated_at+ we set (which is what the reaper reads) sticks.
  def moderate!(target, state:, pending_since:, attempts: 0)
    moderation = Fabricate(:epsilon_ai_status_moderation, status: target, state: state)
    Epsilon::AiStatusModeration.where(id: moderation.id).update_all(updated_at: pending_since, reaper_attempts: attempts)
    moderation
  end

  describe '#perform' do
    context 'with a pending_ai status orphaned past the grace window' do
      before { moderate!(status, state: :pending_ai, pending_since: 20.minutes.ago) }

      it 'releases it to manual_review (published but flagged, never AI-vetted)' do
        worker.perform

        expect(status.reload.moderation_state).to eq('manual_review')
      end

      it 'distributes the released status' do
        worker.perform

        expect(fan_out).to have_received(:call).with(status)
      end

      it 'federates the released status' do
        allow(ActivityPub::DistributionWorker).to receive(:perform_async)

        worker.perform

        expect(ActivityPub::DistributionWorker).to have_received(:perform_async).with(status.id)
      end

      it 'records a reaper_released moderation event' do
        expect { worker.perform }.to change(Epsilon::ModerationEvent, :count).by(1)

        expect(Epsilon::ModerationEvent.last.decision).to eq('reaper_released')
      end

      it 'files a system report so a human reviews it' do
        worker.perform

        expect(report_service).to have_received(:call).with(
          Account.representative,
          status.account,
          hash_including(status_ids: [status.id])
        )
      end
    end

    context 'with a pending_ai status still within the grace window' do
      before { moderate!(status, state: :pending_ai, pending_since: 1.minute.ago) }

      it 'leaves it pending and does not distribute or report' do
        worker.perform

        expect(status.reload.moderation_state).to eq('pending_ai')
        expect(fan_out).to_not have_received(:call)
        expect(report_service).to_not have_received(:call)
      end
    end

    context 'with an old status that already has a verdict' do
      before { moderate!(status, state: :approved, pending_since: 20.minutes.ago) }

      it 'does not touch it' do
        worker.perform

        expect(status.reload.moderation_state).to eq('approved')
        expect(fan_out).to_not have_received(:call)
      end
    end

    context 'when a status has already exhausted its release attempts' do
      before { moderate!(status, state: :pending_ai, pending_since: 20.minutes.ago, attempts: described_class::MAX_ATTEMPTS) }

      it 'stops retrying it (leaves it for humans, does not distribute)' do
        worker.perform

        expect(status.reload.moderation_state).to eq('pending_ai')
        expect(fan_out).to_not have_received(:call)
      end
    end

    context 'when releasing one status raises' do
      let(:healthy_status) { Fabricate(:status) }

      before do
        moderate!(status, state: :pending_ai, pending_since: 20.minutes.ago)
        moderate!(healthy_status, state: :pending_ai, pending_since: 20.minutes.ago)

        # Fan-out blows up only for the broken status (the generic `call: true`
        # stub from the top-level `before` still covers the healthy one).
        allow(fan_out).to receive(:call).with(status).and_raise(StandardError, 'boom')
      end

      it 'counts the failed attempt and keeps the status pending for a later retry' do
        worker.perform

        moderation = status.reload.epsilon_ai_status_moderation
        expect(moderation.state).to eq('pending_ai')
        expect(moderation.reaper_attempts).to eq(1)
      end

      it 'still releases the other statuses in the batch (failure is isolated)' do
        worker.perform

        expect(healthy_status.reload.moderation_state).to eq('manual_review')
      end
    end

    context 'when there is nothing to reap' do
      it 'does no work' do
        worker.perform

        expect(fan_out).to_not have_received(:call)
        expect(report_service).to_not have_received(:call)
      end
    end
  end
end
