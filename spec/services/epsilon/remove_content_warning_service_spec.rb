# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::RemoveContentWarningService do
  subject(:service) { described_class.new }

  let(:update_service) { instance_double(UpdateStatusService, call: true) }

  before { allow(UpdateStatusService).to receive(:new).and_return(update_service) }

  it 'clears the sensitive flag and the AI spoiler, bypassing re-moderation' do
    status = Fabricate(:status, sensitive: true, spoiler_text: 'Contenu sensible : Violence')

    service.call(status)

    expect(update_service).to have_received(:call).with(
      status, status.account_id, hash_including(sensitive: false, spoiler_text: '', bypass_ai_moderation: true)
    )
  end

  it "preserves an author's own spoiler, clearing only the sensitive flag" do
    status = Fabricate(:status, sensitive: true, spoiler_text: 'My own warning')

    service.call(status)

    expect(update_service).to have_received(:call).with(
      status, status.account_id, { sensitive: false, bypass_ai_moderation: true }
    )
  end

  it 'does nothing for a status without a content warning' do
    status = Fabricate(:status, sensitive: false)

    service.call(status)

    expect(update_service).to_not have_received(:call)
  end
end
