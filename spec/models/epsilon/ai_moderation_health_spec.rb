# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::AiModerationHealth do
  subject(:health) { described_class.new }

  before do
    queue = instance_double(Sidekiq::Queue, size: 0, latency: 0.0)
    allow(Sidekiq::Queue).to receive(:new).with('epsilon_ai_moderation').and_return(queue)
  end

  def moderation!(state:, updated_at: Time.current, attempts: 0)
    moderation = Fabricate(:epsilon_ai_status_moderation, status: Fabricate(:status), state: state)
    Epsilon::AiStatusModeration.where(id: moderation.id).update_all(updated_at: updated_at, reaper_attempts: attempts)
    moderation
  end

  describe '#pending_count' do
    it 'counts only pending_ai rows' do
      moderation!(state: :pending_ai)
      moderation!(state: :approved)

      expect(health.pending_count).to eq(1)
    end
  end

  describe '#oldest_pending_at' do
    it 'returns nil when nothing is pending' do
      expect(health.oldest_pending_at).to be_nil
    end

    it 'returns the oldest pending timestamp' do
      moderation!(state: :pending_ai, updated_at: 30.minutes.ago)
      moderation!(state: :pending_ai, updated_at: 2.minutes.ago)

      expect(health.oldest_pending_at).to be_within(1.second).of(30.minutes.ago)
    end
  end

  describe '#stuck_count' do
    it 'counts only pending_ai older than the grace window' do
      moderation!(state: :pending_ai, updated_at: 20.minutes.ago)
      moderation!(state: :pending_ai, updated_at: 1.minute.ago)

      expect(health.stuck_count).to eq(1)
    end
  end

  describe '#needs_attention_count' do
    it 'counts pending_ai that exhausted the reaper attempts' do
      moderation!(state: :pending_ai, updated_at: 20.minutes.ago, attempts: described_class::GAVE_UP_AT)
      moderation!(state: :pending_ai, updated_at: 20.minutes.ago, attempts: 1)

      expect(health.needs_attention_count).to eq(1)
    end
  end

  describe '#reaped_last_24h' do
    it 'counts rows the reaper touched within the last 24h' do
      moderation!(state: :manual_review, updated_at: 2.hours.ago, attempts: 1)
      moderation!(state: :manual_review, updated_at: 2.days.ago, attempts: 1) # too old
      moderation!(state: :approved, updated_at: 2.hours.ago, attempts: 0)     # never reaped

      expect(health.reaped_last_24h).to eq(1)
    end
  end

  describe '#healthy?' do
    it 'is true when nothing is stuck or abandoned' do
      moderation!(state: :pending_ai, updated_at: 1.minute.ago)

      expect(health).to be_healthy
    end

    it 'is false when something is stuck past the grace window' do
      moderation!(state: :pending_ai, updated_at: 20.minutes.ago)

      expect(health).to_not be_healthy
    end

    it 'is false when the reaper gave up on something' do
      moderation!(state: :pending_ai, updated_at: 20.minutes.ago, attempts: described_class::GAVE_UP_AT)

      expect(health).to_not be_healthy
    end
  end

  describe '#api_key_present?' do
    around do |example|
      original = ENV.fetch('MISTRAL_API_KEY', nil)
      example.run
      ENV['MISTRAL_API_KEY'] = original
    end

    it 'is true when the key is set' do
      ENV['MISTRAL_API_KEY'] = 'a-key'

      expect(health.api_key_present?).to be(true)
    end

    it 'is false when the key is blank' do
      ENV['MISTRAL_API_KEY'] = ''

      expect(health.api_key_present?).to be(false)
    end
  end

  describe 'queue metrics' do
    it 'delegates to the epsilon_ai_moderation Sidekiq queue' do
      queue = instance_double(Sidekiq::Queue, size: 3, latency: 12.5)
      allow(Sidekiq::Queue).to receive(:new).with('epsilon_ai_moderation').and_return(queue)

      expect(health.queue_size).to eq(3)
      expect(health.queue_latency).to eq(12.5)
    end
  end
end
