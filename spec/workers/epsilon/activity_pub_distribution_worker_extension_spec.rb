# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::ActivityPubDistributionWorkerExtension do
  let(:worker) { ActivityPub::DistributionWorker.new }

  before { allow(worker).to receive(:distribute!) }

  def moderated_status(state)
    status = Fabricate(:status)
    Fabricate(:epsilon_ai_status_moderation, status: status, state: state)
    status
  end

  it 'skips federation while a status is pending AI moderation' do
    status = moderated_status(:pending_ai)

    worker.perform(status.id)

    expect(worker).to_not have_received(:distribute!)
  end

  it 'federates a status once it has a verdict' do
    status = moderated_status(:approved)

    worker.perform(status.id)

    expect(worker).to have_received(:distribute!)
  end

  it 'federates a normal (unmoderated) status' do
    status = Fabricate(:status)

    worker.perform(status.id)

    expect(worker).to have_received(:distribute!)
  end
end
