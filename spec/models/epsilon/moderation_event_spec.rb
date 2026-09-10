# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::ModerationEvent do
  describe '.record!' do
    let(:status) { Fabricate(:status) }

    it 'stores a denormalized snapshot of the decision' do
      event = described_class.record!(
        status: status,
        decision: :rejected,
        source: :llm,
        sensitive: true,
        scores: { violence: 0.9, vulgarity: 0.1, sexual: 0.0 },
        category: 'Politics',
        trigger: 'violence'
      )

      expect(event).to have_attributes(
        account_id: status.account_id,
        acct: status.account.acct,
        status_id: status.id,
        decision: 'rejected',
        sensitive: true,
        category: 'Politics',
        trigger: 'violence'
      )
      expect(event.source_llm?).to be(true)
      expect(event.violence_score).to eq(0.9)
    end

    it 'defaults scores to nil when not provided (e.g. reaper releases)' do
      event = described_class.record!(status: status, decision: :reaper_released, source: :reaper)

      expect(event.decision).to eq('reaper_released')
      expect(event.violence_score).to be_nil
    end
  end
end
