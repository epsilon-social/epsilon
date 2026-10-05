# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::ApproveHeldStatusService do
  subject { described_class.new }

  let(:status)  { Fabricate(:status) }
  let(:fan_out) { instance_double(FanOutOnWriteService, call: nil) }

  before do
    allow(FanOutOnWriteService).to receive(:new).and_return(fan_out)
    allow(ActivityPub::DistributionWorker).to receive(:perform_async)
  end

  context 'with a status held in pending_ai' do
    before { Fabricate(:epsilon_ai_status_moderation, status: status, state: :pending_ai) }

    it 'approves the status and performs its initial distribution', :aggregate_failures do
      subject.call(status)

      expect(Epsilon::AiStatusModeration.find_by(status_id: status.id).state).to eq 'approved'
      expect(fan_out).to have_received(:call).with(status)
      expect(ActivityPub::DistributionWorker).to have_received(:perform_async).with(status.id)
    end

    it 'records the manual decision in the audit log' do
      expect { subject.call(status) }.to change(Epsilon::ModerationEvent, :count).by(1)

      expect(Epsilon::ModerationEvent.last).to have_attributes(decision: 'manual_approved', source: 'admin')
    end
  end

  context 'with a status that already has a verdict' do
    before { Fabricate(:epsilon_ai_status_moderation, status: status, state: :approved) }

    it 'does nothing', :aggregate_failures do
      expect { subject.call(status) }.to_not change(Epsilon::ModerationEvent, :count)

      expect(fan_out).to_not have_received(:call)
      expect(ActivityPub::DistributionWorker).to_not have_received(:perform_async)
    end
  end

  context 'with an unmoderated status (no moderation row)' do
    it 'does nothing', :aggregate_failures do
      subject.call(status)

      expect(fan_out).to_not have_received(:call)
      expect(ActivityPub::DistributionWorker).to_not have_received(:perform_async)
    end
  end
end
