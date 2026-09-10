# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Admin::Epsilon::AiModerationsController do
  render_views

  let(:role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_reports]) }
  let(:user) { Fabricate(:user, role: role) }

  before { sign_in user, scope: :user }

  def moderation!(text:, state: :pending_ai, updated_at: Time.current, attempts: 0)
    status = Fabricate(:status, text: text)
    moderation = Fabricate(:epsilon_ai_status_moderation, status: status, state: state)
    Epsilon::AiStatusModeration.where(id: moderation.id).update_all(updated_at: updated_at, reaper_attempts: attempts)
    moderation
  end

  describe 'GET #index' do
    it 'returns success and lists pending statuses by default' do
      moderation!(text: 'PENDING_MARKER', updated_at: 2.minutes.ago)

      get :index

      expect(response).to have_http_status(:success)
      expect(response.body).to include('PENDING_MARKER')
    end

    it 'excludes statuses that already have a verdict' do
      moderation!(text: 'APPROVED_MARKER', state: :approved, updated_at: 2.minutes.ago)

      get :index

      expect(response.body).to_not include('APPROVED_MARKER')
    end

    it 'filters to stuck statuses past the grace window' do
      moderation!(text: 'RECENT_MARKER', updated_at: 1.minute.ago)
      moderation!(text: 'STUCK_MARKER', updated_at: 20.minutes.ago)

      get :index, params: { filter: 'stuck' }

      expect(response.body).to include('STUCK_MARKER')
      expect(response.body).to_not include('RECENT_MARKER')
    end

    it 'filters to statuses the reaper gave up on' do
      moderation!(text: 'NORMAL_MARKER', updated_at: 20.minutes.ago, attempts: 1)
      moderation!(text: 'GAVE_UP_MARKER', updated_at: 20.minutes.ago, attempts: Epsilon::AiModerationReaperScheduler::MAX_ATTEMPTS)

      get :index, params: { filter: 'needs_attention' }

      expect(response.body).to include('GAVE_UP_MARKER')
      expect(response.body).to_not include('NORMAL_MARKER')
    end

    it 'ignores an unknown filter and falls back to all pending' do
      moderation!(text: 'RECENT_MARKER', updated_at: 1.minute.ago)

      get :index, params: { filter: 'bogus' }

      expect(response).to have_http_status(:success)
      expect(response.body).to include('RECENT_MARKER')
    end

    it 'lists preserved (discarded) rejected statuses under the rejected filter' do
      status = Fabricate(:status, text: 'REJECTED_PRESERVED')
      Fabricate(:epsilon_ai_status_moderation, status: status, state: :rejected)
      status.update_column(:deleted_at, 1.day.ago)

      get :index, params: { filter: 'rejected' }

      expect(response).to have_http_status(:success)
      expect(response.body).to include('REJECTED_PRESERVED')
    end

    it 'lists AI content-warned statuses under the sensitive filter' do
      status = Fabricate(:status, text: 'CW_MARKER', sensitive: true)
      Fabricate(:epsilon_ai_status_moderation, status: status, state: :approved, ai_content_warning: true)

      get :index, params: { filter: 'sensitive' }

      expect(response).to have_http_status(:success)
      expect(response.body).to include('CW_MARKER')
    end
  end

  describe 'POST #restore' do
    it 'restores the status and redirects to the rejected list' do
      status = Fabricate(:status)
      Fabricate(:epsilon_ai_status_moderation, status: status, state: :rejected)
      status.update_column(:deleted_at, 1.day.ago)

      post :restore, params: { id: status.id }

      expect(status.reload.deleted_at).to be_nil
      expect(status.moderation_state).to eq('approved')
      expect(response).to redirect_to(admin_epsilon_ai_moderations_path(filter: 'rejected'))
    end
  end

  describe 'POST #remove_content_warning' do
    it 'lifts the content warning and redirects to the sensitive list' do
      status = Fabricate(:status, sensitive: true, spoiler_text: 'Contenu sensible : Violence')
      Fabricate(:epsilon_ai_status_moderation, status: status, state: :approved)

      post :remove_content_warning, params: { id: status.id }

      expect(status.reload.sensitive).to be(false)
      expect(response).to redirect_to(admin_epsilon_ai_moderations_path(filter: 'sensitive'))
    end
  end
end
