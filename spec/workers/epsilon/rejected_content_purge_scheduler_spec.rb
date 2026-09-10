# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::RejectedContentPurgeScheduler do
  subject(:worker) { described_class.new }

  let(:remover) { instance_double(RemoveStatusService, call: true) }

  before do
    Epsilon::AiModerationSetting.current.update!(rejected_retention_days: 90)
    allow(RemoveStatusService).to receive(:new).and_return(remover)
  end

  # A rejected status is preserved as a soft-deleted (discarded) row.
  def rejected_status!(deleted_at:, state: :rejected)
    status = Fabricate(:status)
    Fabricate(:epsilon_ai_status_moderation, status: status, state: state)
    status.update_column(:deleted_at, deleted_at)
    status
  end

  describe '#perform' do
    it 'hard-removes rejected statuses past the retention window' do
      old = rejected_status!(deleted_at: 100.days.ago)

      worker.perform

      expect(remover).to have_received(:call).with(an_object_having_attributes(id: old.id), immediate: true)
    end

    it 'keeps rejected statuses still within the window' do
      rejected_status!(deleted_at: 10.days.ago)

      worker.perform

      expect(remover).to_not have_received(:call)
    end

    it 'ignores discarded statuses that were not rejected' do
      rejected_status!(state: :approved, deleted_at: 100.days.ago)

      worker.perform

      expect(remover).to_not have_received(:call)
    end

    it 'does nothing when retention is disabled (0 days)' do
      Epsilon::AiModerationSetting.current.update!(rejected_retention_days: 0)
      rejected_status!(deleted_at: 100.days.ago)

      worker.perform

      expect(remover).to_not have_received(:call)
    end
  end
end
