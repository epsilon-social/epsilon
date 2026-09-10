# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::MistralModerationWorker do
  subject(:worker) { described_class.new }

  let(:moderator_role) { Fabricate(:user_role, name: 'Moderator', permissions: UserRole::FLAGS[:manage_reports]) }

  let(:sentinel_account) do
    account = Account.find_by(username: 'EpsilonSafety', domain: nil)
    if account
      account.user&.update!(role: moderator_role)
      account
    else
      user = Fabricate(:user, role: moderator_role)
      Fabricate(:account, username: 'EpsilonSafety', user: user)
    end
  end

  let(:mistral_response_low_risk) do
    {
      'choices' => [
        {
          'message' => {
            'content' => {
              'violence_score' => 0.0,
              'vulgarity_score' => 0.1,
              'sexual_score' => 0.0,
              'category' => 'Technology',
              'reasoning' => 'Safe content.',
            }.to_json,
          },
        },
      ],
    }
  end
  let(:mistral_response_high_risk) do
    {
      'choices' => [
        {
          'message' => {
            'content' => {
              'violence_score' => 0.9,
              'vulgarity_score' => 0.0,
              'sexual_score' => 0.0,
              'category' => 'Politics',
              'reasoning' => 'Direct death threat detected.',
            }.to_json,
          },
        },
      ],
    }
  end
  let(:mistral_response_manual_review) do
    {
      'choices' => [
        {
          'message' => {
            'content' => {
              'violence_score' => 0.0,
              'vulgarity_score' => 0.75,
              'sexual_score' => 0.0,
              'category' => 'Other',
              'reasoning' => 'Borderline vulgarity.',
            }.to_json,
          },
        },
      ],
    }
  end
  let(:mistral_native_response) do
    {
      'results' => [
        {
          'category_scores' => {
            'violence_and_threats' => 0.5,
            'hate_and_discrimination' => 0.1,
            'sexual' => 0.0,
          },
        },
      ],
    }
  end
  let(:author_account) { Fabricate(:account) }
  let(:status) { Fabricate(:status, account: author_account) }

  before do
    Fabricate(:epsilon_ai_status_moderation, status: status, state: :pending_ai)
    sentinel_account
    ENV['MISTRAL_API_KEY'] = 'test_api_key'
  end

  describe '#perform' do
    context 'when status does not exist' do
      it 'does nothing' do
        expect { worker.perform(999_999) }.to_not raise_error
      end
    end

    context 'when status is not pending_ai' do
      it 'does nothing' do
        status.reload.epsilon_ai_status_moderation_or_default.update!(state: :approved)

        allow(HTTP).to receive(:timeout)

        worker.perform(status.id)

        expect(HTTP).to_not have_received(:timeout)
      end
    end

    context 'when Mistral API returns low risk scores (approved)' do
      let(:http_mock) { instance_double(HTTP::Client) }
      let(:response_mock) { instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: true), parse: mistral_response_low_risk) }

      before do
        allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
        allow(http_mock).to receive(:auth).with('Bearer test_api_key').and_return(http_mock)
        allow(http_mock).to receive(:post).and_return(response_mock)
      end

      it 'updates status to approved' do
        worker.perform(status.id)

        expect(status.reload.moderation_state).to eq('approved')
      end

      it 'does not flag a content warning below the sensitive threshold' do
        worker.perform(status.id)

        expect(status.reload.epsilon_ai_status_moderation.ai_content_warning).to be(false)
      end

      it 'creates AI metadata with correct scores' do
        worker.perform(status.id)

        metadata = status.reload.epsilon_ai_metadata
        expect(metadata).to be_present
        expect(metadata.violence_score).to eq(0.0)
        expect(metadata.mistral_payload['category']).to eq('Technology')
        expect(metadata.mistral_payload['trigger']).to eq('vulgarité')
      end

      it 'calls FanOutOnWriteService' do
        fan_out_service = instance_double(FanOutOnWriteService)
        allow(FanOutOnWriteService).to receive(:new).and_return(fan_out_service)
        allow(fan_out_service).to receive(:call)

        worker.perform(status.id)

        expect(fan_out_service).to have_received(:call).with(status)
      end

      it 'federates the approved status (creation-time federation was held while pending)' do
        allow(ActivityPub::DistributionWorker).to receive(:perform_async)

        worker.perform(status.id)

        expect(ActivityPub::DistributionWorker).to have_received(:perform_async).with(status.id)
      end

      it 'records a moderation event for the audit log' do
        expect { worker.perform(status.id) }.to change(Epsilon::ModerationEvent, :count).by(1)

        expect(Epsilon::ModerationEvent.last).to have_attributes(decision: 'approved', account_id: author_account.id)
      end

      it 'does not send a DM' do
        post_status_service = instance_double(PostStatusService)
        allow(PostStatusService).to receive(:new).and_return(post_status_service)
        allow(post_status_service).to receive(:call)

        worker.perform(status.id)

        expect(post_status_service).to_not have_received(:call)
      end
    end

    context 'when Mistral API returns high risk scores (rejected)' do
      let(:http_mock) { instance_double(HTTP::Client) }
      let(:response_mock) { instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: true), parse: mistral_response_high_risk) }

      before do
        allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
        allow(http_mock).to receive(:auth).with('Bearer test_api_key').and_return(http_mock)
        allow(http_mock).to receive(:post).and_return(response_mock)
      end

      it 'preserves the status (soft-delete) instead of destroying it' do
        allow(PostStatusService).to receive(:new).and_return(instance_double(PostStatusService, call: true))
        allow(ReportService).to receive(:new).and_return(instance_double(ReportService, call: true))
        status_id = status.id

        worker.perform(status_id)

        expect(Status.unscoped.exists?(status_id)).to be true
        expect(Status.unscoped.find(status_id).deleted_at).to be_present
      end

      it 'creates AI metadata before deletion' do
        remove_status_service = instance_double(RemoveStatusService)
        allow(RemoveStatusService).to receive(:new).and_return(remove_status_service)
        allow(remove_status_service).to receive(:call)

        worker.perform(status.id)

        metadata = status.reload.epsilon_ai_metadata
        expect(metadata).to be_present
        expect(metadata.violence_score).to eq(0.9)
        expect(metadata.mistral_payload['trigger']).to eq('violence')
      end

      # EPSILON : Test spécifique pour nos utilisateurs locaux
      context 'when the author is a local account' do
        it 'creates an AccountWarning and sends a DM' do
          post_status_service = instance_double(PostStatusService)
          allow(PostStatusService).to receive(:new).and_return(post_status_service)
          allow(post_status_service).to receive(:call)

          expect do
            worker.perform(status.id)
          end.to change(AccountWarning, :count).by(1)

          warning = AccountWarning.last
          expect(warning.target_account).to eq(author_account)
          expect(warning.account).to eq(sentinel_account)
          expect(warning.action).to eq('delete_statuses')

          expect(post_status_service).to have_received(:call).with(
            sentinel_account,
            hash_including(
              visibility: :direct,
              text: include("@#{status.account.acct}")
            )
          )
        end

        it 'files a report so the removal can be reviewed and restored' do
          allow(PostStatusService).to receive(:new).and_return(instance_double(PostStatusService, call: true))

          expect { worker.perform(status.id) }.to change(Report, :count).by(1)

          expect(Report.last.status_ids).to include(status.id)
        end
      end

      context 'when the author is a remote account' do
        let(:author_account) { Fabricate(:account, domain: 'remote.com') }
        let(:status) { Fabricate(:status, account: author_account) }

        it 'removes the status silently without sending DM or Warning' do
          post_status_service = instance_double(PostStatusService)
          allow(PostStatusService).to receive(:new).and_return(post_status_service)
          allow(post_status_service).to receive(:call)

          expect do
            worker.perform(status.id)
          end.to_not change(AccountWarning, :count)

          expect(post_status_service).to_not have_received(:call)
          expect(Status.exists?(status.id)).to be false
        end
      end
    end

    context 'when Mistral API returns medium risk scores (manual_review)' do
      let(:http_mock) { instance_double(HTTP::Client) }
      let(:response_mock) { instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: true), parse: mistral_response_manual_review) }

      before do
        allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
        allow(http_mock).to receive(:auth).with('Bearer test_api_key').and_return(http_mock)
        allow(http_mock).to receive(:post).and_return(response_mock)
      end

      it 'updates status to manual_review' do
        worker.perform(status.id)

        expect(status.reload.moderation_state).to eq('manual_review')
      end

      it 'flags the moderation as an AI content warning (sensitive band)' do
        worker.perform(status.id)

        expect(status.reload.epsilon_ai_status_moderation.ai_content_warning).to be(true)
      end

      it 'creates AI metadata' do
        worker.perform(status.id)

        metadata = status.reload.epsilon_ai_metadata
        expect(metadata).to be_present
        expect(metadata.violence_score).to eq(0.0)
        expect(metadata.mistral_payload['trigger']).to eq('vulgarité')
      end

      it 'calls FanOutOnWriteService' do
        fan_out_service = instance_double(FanOutOnWriteService)
        allow(FanOutOnWriteService).to receive(:new).and_return(fan_out_service)
        allow(fan_out_service).to receive(:call)

        worker.perform(status.id)

        expect(fan_out_service).to have_received(:call).with(status)
      end

      it 'creates a system report via ReportService' do
        report_service = instance_double(ReportService)
        allow(ReportService).to receive(:new).and_return(report_service)
        allow(report_service).to receive(:call)

        worker.perform(status.id)

        expect(report_service).to have_received(:call).with(
          Account.representative,
          author_account,
          hash_including(
            status_ids: [status.id],
            comment: include('VULGARITÉ')
          )
        )
      end
    end

    context 'when use_native_moderation setting is true' do
      let(:http_mock) { instance_double(HTTP::Client) }
      let(:response_mock) { instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: true), parse: mistral_native_response) }

      before do
        Epsilon::AiModerationSetting.current.update!(use_native_moderation: true)

        allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
        allow(http_mock).to receive(:auth).with('Bearer test_api_key').and_return(http_mock)
        allow(http_mock).to receive(:post).and_return(response_mock)
      end

      after do
        Epsilon::AiModerationSetting.current.update!(use_native_moderation: false)
      end

      it 'routes to native moderation API and correctly maps the scores' do
        worker.perform(status.id)

        metadata = status.reload.epsilon_ai_metadata

        expect(metadata).to be_present
        expect(metadata.violence_score).to eq(0.5)
        expect(metadata.mistral_payload['category']).to eq('Modération Native')
        expect(metadata.mistral_payload['trigger']).to eq('violence')
      end
    end
  end

  describe '#perform when re-moderating an edit (is_edit: true)' do
    let(:http_mock) { instance_double(HTTP::Client) }

    def stub_mistral(response_body)
      response_mock = instance_double(HTTP::Response, status: instance_double(HTTP::Response::Status, success?: true), parse: response_body)
      allow(HTTP).to receive(:timeout).with(5).and_return(http_mock)
      allow(http_mock).to receive(:auth).with('Bearer test_api_key').and_return(http_mock)
      allow(http_mock).to receive(:post).and_return(response_mock)
    end

    context 'when the edit is approved' do
      before { stub_mistral(mistral_response_low_risk) }

      it 'distributes the edit as an update rather than a fresh fan-out' do
        fan_out = instance_double(FanOutOnWriteService, call: true)
        allow(FanOutOnWriteService).to receive(:new).and_return(fan_out)
        allow(DistributionWorker).to receive(:perform_async)
        allow(ActivityPub::StatusUpdateDistributionWorker).to receive(:perform_async)

        worker.perform(status.id, true)

        expect(DistributionWorker).to have_received(:perform_async).with(status.id, { 'update' => true })
        expect(ActivityPub::StatusUpdateDistributionWorker).to have_received(:perform_async).with(status.id)
        expect(fan_out).to_not have_received(:call)
      end
    end

    context 'when the edit scores in the sensitive band (content warning, not a ban)' do
      let(:mistral_response_sensitive) do
        {
          'choices' => [
            {
              'message' => {
                'content' => {
                  'violence_score' => 0.3,
                  'vulgarity_score' => 0.0,
                  'sexual_score' => 0.0,
                  'category' => 'Other',
                  'reasoning' => 'Mildly violent, not a ban.',
                }.to_json,
              },
            },
          ],
        }
      end

      before { stub_mistral(mistral_response_sensitive) }

      it 'adds a content warning and keeps the edit published rather than reverting' do
        allow(DistributionWorker).to receive(:perform_async)
        allow(ActivityPub::StatusUpdateDistributionWorker).to receive(:perform_async)

        worker.perform(status.id, true)

        status.reload
        expect(status.moderation_state).to eq('approved')
        expect(status.sensitive).to be true
        expect(status.spoiler_text).to include('Contenu sensible')
        expect(DistributionWorker).to have_received(:perform_async).with(status.id, { 'update' => true })
      end
    end

    context 'when the edit is rejected and a prior revision exists' do
      let(:status) { Fabricate(:status, account: author_account, text: 'Rejected new body') }

      before do
        Fabricate(:status_edit, status: status, text: 'Previous good body')
        Fabricate(:status_edit, status: status, text: 'Rejected new body')
        stub_mistral(mistral_response_high_risk)
      end

      it 'restores the previous revision and records the attempt (strike + report), without deleting' do
        update_service = instance_double(UpdateStatusService, call: true)
        allow(UpdateStatusService).to receive(:new).and_return(update_service)

        expect { worker.perform(status.id, true) }
          .to change(AccountWarning, :count).by(1)
          .and change(Report, :count).by(1)

        expect(Status.exists?(status.id)).to be true
        expect(status.reload.moderation_state).to eq('approved')
        expect(update_service).to have_received(:call).with(
          status,
          author_account.id,
          hash_including(text: 'Previous good body', bypass_ai_moderation: true)
        )
      end

      it 'sends the edit-reverted DM to the author' do
        allow(UpdateStatusService).to receive(:new).and_return(instance_double(UpdateStatusService, call: true))
        allow(ReportService).to receive(:new).and_return(instance_double(ReportService, call: true))
        post_status_service = instance_double(PostStatusService, call: true)
        allow(PostStatusService).to receive(:new).and_return(post_status_service)

        worker.perform(status.id, true)

        expect(post_status_service).to have_received(:call).with(
          sentinel_account,
          hash_including(visibility: :direct, text: include('restored'))
        )
      end
    end

    context 'when the edit is rejected but no prior revision exists' do
      before { stub_mistral(mistral_response_high_risk) }

      it 'falls back to striking and deleting the status' do
        post_status_service = instance_double(PostStatusService, call: true)
        allow(PostStatusService).to receive(:new).and_return(post_status_service)

        expect { worker.perform(status.id, true) }.to change(AccountWarning, :count).by(1)
        expect(Status.exists?(status.id)).to be false
      end
    end
  end

  describe 'Fail-Safe behavior on exhausted retries' do
    let(:exception) { StandardError.new('Mistral API Error: 401') }
    let(:msg) { { 'args' => [status.id] } }
    let(:fan_out_service) { instance_double(FanOutOnWriteService, call: true) }

    before do
      allow(FanOutOnWriteService).to receive(:new).and_return(fan_out_service)
      allow(Rails.logger).to receive(:error)
    end

    it 'reverts to unmoderated, updates timestamp, federates the post and logs an error' do
      exhausted_block = described_class.sidekiq_retries_exhausted_block

      expect do
        exhausted_block.call(msg, exception)
      end.to change { status.epsilon_ai_status_moderation_or_default.reload.state }.from('pending_ai').to('unmoderated')
        .and(change { status.reload.updated_at })

      expect(fan_out_service).to have_received(:call).with(status)

      expect(Rails.logger).to have_received(:error).with(
        "[EPSILON AI CRITICAL] Échec définitif de la modération du statut #{status.id}. Erreur : Mistral API Error: 401"
      )
    end

    it 'flags the status as fail-open so the re-moderation scheduler re-checks it' do
      exhausted_block = described_class.sidekiq_retries_exhausted_block

      exhausted_block.call(msg, exception)

      expect(Epsilon::AiStatusModeration.find_by(status_id: status.id).ai_failed_open).to be(true)
    end

    it 'records a fail_open audit event' do
      exhausted_block = described_class.sidekiq_retries_exhausted_block

      expect { exhausted_block.call(msg, exception) }.to change(Epsilon::ModerationEvent, :count).by(1)
      expect(Epsilon::ModerationEvent.last.decision).to eq('fail_open')
    end

    it 'does nothing if the status has been deleted in the meantime' do
      exhausted_block = described_class.sidekiq_retries_exhausted_block
      deleted_msg = { 'args' => [999_999_999] }

      expect { exhausted_block.call(deleted_msg, exception) }.to_not raise_error
      expect(fan_out_service).to_not have_received(:call)
    end
  end
end
