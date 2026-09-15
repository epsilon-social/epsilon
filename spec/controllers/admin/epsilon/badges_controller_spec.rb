# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Admin::Epsilon::BadgesController do
  render_views

  let(:role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_users]) }
  let(:user) { Fabricate(:user, role: role) }

  before { sign_in user, scope: :user }

  describe 'GET #index' do
    it 'returns http success' do
      Fabricate('Epsilon::Badge')
      get :index
      expect(response).to have_http_status(:success)
    end
  end

  describe 'GET #new' do
    it 'returns http success' do
      get :new
      expect(response).to have_http_status(:success)
    end
  end

  describe 'GET #edit' do
    it 'returns http success' do
      badge = Fabricate('Epsilon::Badge')
      get :edit, params: { id: badge.id }
      expect(response).to have_http_status(:success)
    end
  end

  describe 'GET #show' do
    it 'returns http success' do
      badge = Fabricate('Epsilon::Badge')
      get :show, params: { id: badge.id }
      expect(response).to have_http_status(:success)
    end
  end

  describe 'POST #create' do
    it 'creates a badge with translations and a generated slug' do
      expect do
        post :create, params: { epsilon_badge: { name_translations: { en: 'VIP', fr: 'VIP' }, description_translations: { en: 'desc', fr: 'desc' }, color: '#800082', position: '0', is_active: '1' } }
      end.to change(Epsilon::Badge, :count).by(1)

      badge = Epsilon::Badge.last
      expect(badge.name).to eq('VIP')
      expect(badge.slug).to be_present
      expect(response).to redirect_to(admin_epsilon_badge_path(badge))
    end
  end

  describe 'PATCH #update' do
    it 'updates the badge' do
      badge = Fabricate('Epsilon::Badge')
      patch :update, params: { id: badge.id, epsilon_badge: { name_translations: { en: 'Renamed', fr: 'Renommé' }, color: '#123456', position: '1', is_active: '0' } }

      expect(badge.reload.name).to eq('Renamed')
      expect(badge.color).to eq('#123456')
      expect(response).to redirect_to(admin_epsilon_badge_path(badge))
    end
  end

  describe 'POST #assign_account' do
    it 'assigns the badge to a local account' do
      badge = Fabricate('Epsilon::Badge')
      account = Fabricate(:account)

      post :assign_account, params: { id: badge.id, acct: account.username }

      expect(badge.accounts).to include(account)
    end

    it 'queues a pending grant for an unknown email' do
      badge = Fabricate('Epsilon::Badge')

      post :assign_account, params: { id: badge.id, acct: 'future@example.com' }

      expect(badge.pending_grants.pluck(:email)).to include('future@example.com')
    end
  end

  describe 'POST #import_csv' do
    it 'assigns known accounts and queues unknown emails' do
      badge = Fabricate('Epsilon::Badge')
      account = Fabricate(:account)
      file = Rack::Test::UploadedFile.new(StringIO.new("#{account.username}\nfuture@example.com\n"), 'text/csv', original_filename: 'list.csv')

      post :import_csv, params: { id: badge.id, file: file }

      expect(badge.accounts).to include(account)
      expect(badge.pending_grants.pluck(:email)).to include('future@example.com')
    end
  end

  describe 'DELETE #remove_pending_grant' do
    it 'removes the pending grant' do
      badge = Fabricate('Epsilon::Badge')
      grant = Fabricate('Epsilon::BadgePendingGrant', badge: badge)

      delete :remove_pending_grant, params: { id: badge.id, grant_id: grant.id }

      expect(Epsilon::BadgePendingGrant.exists?(grant.id)).to be(false)
    end
  end
end
