# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::AiRemoderationWorker do
  subject(:worker) { described_class.new }

  let(:author) { Fabricate(:account) }
  let(:status) { Fabricate(:status, account: author) }
  let(:moderation) { Fabricate(:epsilon_ai_status_moderation, status: status, state: :unmoderated, ai_failed_open: true) }

  # Stubbed external side effects -- the worker's own logic (state, flag, event,
  # branching) is what we assert on.
  let(:report_service) { instance_double(ReportService, call: true) }
  let(:remove_service) { instance_double(RemoveStatusService, call: true) }
  let(:update_service) { instance_double(UpdateStatusService, call: true) }
  let(:post_service)   { instance_double(PostStatusService, call: true) }
  let(:http_mock)      { instance_double(HTTP::Client) }

  before do
    moderation
    Epsilon::AiModerationSetting.current.update!(ai_enabled: true)
    ENV['MISTRAL_API_KEY'] = 'test_api_key'
    allow(ReportService).to receive(:new).and_return(report_service)
    allow(RemoveStatusService).to receive(:new).and_return(remove_service)
    allow(UpdateStatusService).to receive(:new).and_return(update_service)
    allow(PostStatusService).to receive(:new).and_return(post_service)
  end

  # Stub the Mistral LLM call (default path) to return a controlled score set.
  def stub_scores(violence: 0.0, vulgarity: 0.0, sexual: 0.0, category: 'Other')
    body = {
      'choices' => [
        { 'message' => { 'content' => {
          'violence_score' => violence,
          'vulgarity_score' => vulgarity,
          'sexual_score' => sexual,
          'category' => category,
          'reasoning' => 'test',
        }.to_json } },
      ],
    }
    response = instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: true), parse: body)
    allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
    allow(http_mock).to receive_messages(auth: http_mock, post: response)
  end

  describe '#perform' do
    context 'when the re-check clears the post (low scores)' do
      before { stub_scores(violence: 0.1) }

      it 'approves it and clears the fail-open flag' do
        worker.perform(status.id)

        expect(moderation.reload.state).to eq('approved')
        expect(moderation.ai_failed_open).to be(false)
      end

      it 'records a re-moderation audit event' do
        expect { worker.perform(status.id) }.to change(Epsilon::ModerationEvent, :count).by(1)

        event = Epsilon::ModerationEvent.last
        expect(event.decision).to eq('approved')
        expect(event.source).to eq('remoderation')
      end

      it 'does not take the post down or re-report it' do
        worker.perform(status.id)

        expect(remove_service).to_not have_received(:call)
        expect(report_service).to_not have_received(:call)
      end
    end

    context 'when the re-check lands in the sensitive band (approved + CW)' do
      before { stub_scores(violence: 0.3) } # >= sensitive (0.25), < review (0.5)

      it 'adds a content warning in place (as an update, no fresh fan-out)' do
        worker.perform(status.id)

        expect(moderation.reload.ai_content_warning).to be(true)
        expect(update_service).to have_received(:call).with(status, status.account_id, hash_including(sensitive: true))
      end
    end

    context 'when the re-check lands in the review band' do
      before { stub_scores(vulgarity: 0.6) } # >= review (0.5), < ban (0.8)

      it 'flags it for humans via a system report' do
        worker.perform(status.id)

        expect(moderation.reload.state).to eq('manual_review')
        expect(report_service).to have_received(:call)
      end
    end

    context 'when the re-check rejects a now-public local post' do
      before { stub_scores(violence: 0.9) } # >= ban (0.8)

      it 'takes it down retroactively (preserved) with a strike, and clears the flag' do
        expect { worker.perform(status.id) }.to change(AccountWarning, :count).by(1)

        expect(remove_service).to have_received(:call).with(status, preserve: true)
        expect(moderation.reload.state).to eq('rejected')
        expect(moderation.ai_failed_open).to be(false)
      end
    end

    context 'when the rejected post is from a remote account' do
      let(:author) { Fabricate(:account, domain: 'remote.example', uri: 'https://remote.example/users/x') }

      before { stub_scores(violence: 0.9) }

      it 'removes it outright without preserving' do
        worker.perform(status.id)

        expect(remove_service).to have_received(:call).with(status)
      end
    end

    context 'when the API is still down' do
      before do
        response = instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: false), code: 500)
        allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
        allow(http_mock).to receive_messages(auth: http_mock, post: response)
      end

      it 're-raises (so Sidekiq retries) and leaves the flag set for a later cycle' do
        expect { worker.perform(status.id) }.to raise_error(StandardError)

        expect(moderation.reload.ai_failed_open).to be(true)
        expect(moderation.state).to eq('unmoderated')
      end
    end

    context 'when the kill-switch is off' do
      before { Epsilon::AiModerationSetting.current.update!(ai_enabled: false) }

      it 'does not call the API and leaves the flag for later' do
        allow(HTTP).to receive(:timeout)

        worker.perform(status.id)

        expect(HTTP).to_not have_received(:timeout)
        expect(moderation.reload.ai_failed_open).to be(true)
      end
    end

    context 'when the status was deleted in the meantime' do
      # update_column avoids autosaving the memoized status' built default
      # moderation (which would collide with the fabricated row).
      before { status.update_column(:deleted_at, Time.current) }

      it 'clears the flag and does nothing else' do
        allow(HTTP).to receive(:timeout)

        worker.perform(status.id)

        expect(HTTP).to_not have_received(:timeout)
        expect(moderation.reload.ai_failed_open).to be(false)
      end
    end

    context 'when the flag was already cleared (raced)' do
      before { moderation.update!(ai_failed_open: false) }

      it 'is a no-op' do
        allow(HTTP).to receive(:timeout)

        worker.perform(status.id)

        expect(HTTP).to_not have_received(:timeout)
      end
    end
  end
end
