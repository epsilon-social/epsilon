# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Admin::Epsilon::ModerationHistoriesController do
  render_views

  let(:role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_reports]) }
  let(:user) { Fabricate(:user, role: role) }

  before { sign_in user, scope: :user }

  def event!(decision:, created_at: Time.current, sensitive: false, violence: nil, vulgarity: nil, sexual: nil, acct: 'someone@example.test')
    event = Epsilon::ModerationEvent.record!(
      status: Fabricate(:status), decision: decision, source: :llm, sensitive: sensitive,
      scores: { violence: violence, vulgarity: vulgarity, sexual: sexual }
    )
    Epsilon::ModerationEvent.where(id: event.id).update_all(created_at: created_at, acct: acct)
    event
  end

  describe 'GET #show' do
    it 'renders the history and its event log' do
      event!(decision: :approved, acct: 'APPROVED_MARKER')
      event!(decision: :rejected, acct: 'REJECTED_MARKER', violence: 0.9)

      get :show

      expect(response).to have_http_status(:success)
      expect(response.body).to include('APPROVED_MARKER').and include('REJECTED_MARKER')
    end

    it 'filters every table by the selected time range' do
      event!(decision: :rejected, created_at: 2.hours.ago, acct: 'RECENT_MARKER')
      event!(decision: :rejected, created_at: 40.days.ago, acct: 'OLD_MARKER')

      get :show, params: { range: 'week' }

      expect(response).to have_http_status(:success)
      expect(response.body).to include('RECENT_MARKER')
      expect(response.body).to_not include('OLD_MARKER')
    end

    it 'filters every table by the account search' do
      event!(decision: :approved, acct: 'alice_marker@example.test')
      event!(decision: :approved, acct: 'bob_marker@example.test')

      get :show, params: { q: 'alice_marker' }

      expect(response.body).to include('alice_marker')
      expect(response.body).to_not include('bob_marker')
    end

    it 'filters every table by decision' do
      event!(decision: :rejected, acct: 'rejected_marker@example.test')
      event!(decision: :approved, acct: 'approved_marker@example.test')

      get :show, params: { decision: 'rejected' }

      expect(response.body).to include('rejected_marker')
      expect(response.body).to_not include('approved_marker')
    end

    it 'renders cleanly with no events' do
      get :show

      expect(response).to have_http_status(:success)
    end

    it 'reports severity as the peak across all three criteria, not just violence' do
      # No violence, but a high sexual score -- the old violence-only column would
      # have shown nothing here.
      event!(decision: :rejected, violence: 0.0, vulgarity: 0.1, sexual: 0.87, acct: 'PEAK_MARKER')

      get :show

      expect(response.body).to include('0.87')
    end

    it 'links each event to the status page and, when present, to its report' do
      status = Fabricate(:status)
      Epsilon::ModerationEvent.record!(status: status, decision: :rejected, source: :llm)
      report = Fabricate(:report, target_account: status.account, status_ids: [status.id.to_s])

      get :show

      expect(response.body).to include(admin_account_status_path(status.account_id, status.id))
      expect(response.body).to include(admin_report_path(report))
    end
  end
end
