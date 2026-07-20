# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Admin::Epsilon::HashtagsCategorizationController do
  let(:role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_taxonomies]) }
  let(:user) { Fabricate(:user, role: role) }
  let(:category) { Fabricate(:epsilon_category_master) }

  before { sign_in user, scope: :user }

  describe 'POST #toggle' do
    it 'creates a mapping when checked' do
      expect do
        post :toggle, params: { hashtag: 'chien', category_id: category.id, checked: true }
      end.to change { category.hashtag_mappings.where(hashtag: 'chien').count }.by(1)

      expect(response).to have_http_status(:success)
    end

    it 'removes a mapping when unchecked' do
      Fabricate(:epsilon_hashtag_mapping, category_master: category, hashtag: 'chien')

      expect do
        post :toggle, params: { hashtag: 'chien', category_id: category.id, checked: false }
      end.to change { category.hashtag_mappings.where(hashtag: 'chien').count }.by(-1)

      expect(response).to have_http_status(:success)
    end

    it 'strips a leading # from the hashtag' do
      post :toggle, params: { hashtag: '#chien', category_id: category.id, checked: true }

      expect(category.hashtag_mappings.where(hashtag: 'chien')).to be_present
    end
  end
end
