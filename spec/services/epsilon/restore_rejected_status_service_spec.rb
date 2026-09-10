# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::RestoreRejectedStatusService do
  subject(:service) { described_class.new }

  let(:admin) { Fabricate(:account) }
  let(:author) { Fabricate(:account) }

  # A preserved rejected status: discarded + moderation rejected. Returned via a
  # fresh unscoped load to mirror the controller (Status.unscoped.find) and avoid
  # a stale association cache on the fabricated object.
  def preserved_reject!
    status = Fabricate(:status, account: author)
    Fabricate(:epsilon_ai_status_moderation, status: status, state: :rejected)
    status.update_column(:deleted_at, 1.day.ago)
    Status.unscoped.find(status.id)
  end

  describe '#call' do
    it 'un-discards the status and marks it approved' do
      status = preserved_reject!

      service.call(status, admin)

      expect(status.reload.deleted_at).to be_nil
      expect(status.moderation_state).to eq('approved')
    end

    it 'redistributes the restored status' do
      status = preserved_reject!

      expect { service.call(status, admin) }.to change(DistributionWorker.jobs, :size).by(1)
    end

    it 'resolves the report and leaves an explanatory note, without deleting it' do
      status = preserved_reject!
      report = Fabricate(:report, target_account: author, status_ids: [status.id.to_s])

      service.call(status, admin)

      expect(Report.exists?(report.id)).to be true
      expect(report.reload.action_taken_at).to be_present
      expect(report.notes.count).to eq(1)
      expect(report.notes.first.account).to eq(admin)
    end

    it 'reverses the AI strike linked to the status' do
      status = preserved_reject!
      sentinel = Fabricate(:account, username: 'EpsilonSafety')
      warning = AccountWarning.create!(target_account: author, account: sentinel, action: :delete_statuses, text: 'blocked', status_ids: [status.id.to_s])

      service.call(status, admin)

      expect(AccountWarning.exists?(warning.id)).to be false
    end

    it 'does nothing for a status that is not discarded' do
      status = Fabricate(:status, account: author)
      Fabricate(:epsilon_ai_status_moderation, status: status, state: :rejected)

      expect { service.call(status, admin) }.to_not change(DistributionWorker.jobs, :size)
    end
  end
end
