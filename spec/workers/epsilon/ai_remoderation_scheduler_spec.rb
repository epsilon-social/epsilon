# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::AiRemoderationScheduler do
  subject(:scheduler) { described_class.new }

  let(:http_mock) { instance_double(HTTP::Client) }

  # A published-during-outage status: unmoderated + flagged fail-open.
  def failed_open_status!
    status = Fabricate(:status)
    Fabricate(:epsilon_ai_status_moderation, status: status, state: :unmoderated, ai_failed_open: true)
    status
  end

  # The health probe hits the real Mistral path; stub it success/failure.
  def stub_probe(success:)
    body = { 'choices' => [{ 'message' => { 'content' => { 'violence_score' => 0.0 }.to_json } }] }
    response = instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: success), parse: body, code: 500)
    allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
    allow(http_mock).to receive_messages(auth: http_mock, post: response)
  end

  before do
    Epsilon::AiModerationSetting.current.update!(ai_enabled: true)
    ENV['MISTRAL_API_KEY'] = 'test_api_key'
  end

  describe '#perform' do
    context 'with a backlog and a healthy API' do
      it 'enqueues a re-moderation worker for each fail-open status' do
        a = failed_open_status!
        b = failed_open_status!
        stub_probe(success: true)

        scheduler.perform

        expect(Epsilon::AiRemoderationWorker.jobs.pluck('args').flatten).to contain_exactly(a.id, b.id)
      end
    end

    context 'when the API probe fails (still down)' do
      it 'enqueues nothing and does not raise' do
        failed_open_status!
        stub_probe(success: false)

        expect { scheduler.perform }.to_not raise_error
        expect(Epsilon::AiRemoderationWorker.jobs).to be_empty
      end
    end

    context 'when there is nothing to re-moderate' do
      it 'does no work and does not even probe the API' do
        allow(HTTP).to receive(:timeout)

        scheduler.perform

        expect(HTTP).to_not have_received(:timeout)
        expect(Epsilon::AiRemoderationWorker.jobs).to be_empty
      end
    end

    context 'when the kill-switch is off' do
      it 'does nothing' do
        failed_open_status!
        Epsilon::AiModerationSetting.current.update!(ai_enabled: false)
        allow(HTTP).to receive(:timeout)

        scheduler.perform

        expect(HTTP).to_not have_received(:timeout)
        expect(Epsilon::AiRemoderationWorker.jobs).to be_empty
      end
    end

    context 'with more than one batch of backlog' do
      it 'only enqueues up to RECHECK_BATCH per run' do
        stub_const('Epsilon::AiRemoderationScheduler::RECHECK_BATCH', 2)
        3.times { failed_open_status! }
        stub_probe(success: true)

        scheduler.perform

        expect(Epsilon::AiRemoderationWorker.jobs.size).to eq(2)
      end
    end
  end
end
