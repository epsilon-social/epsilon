# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Admin::Epsilon::CategoriesController do
  render_views

  let(:role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_taxonomies]) }
  let(:user) { Fabricate(:user, role: role) }

  before { sign_in user, scope: :user }

  describe 'GET #index' do
    it 'returns http success' do
      Fabricate(:epsilon_category_master)

      get :index

      expect(response).to have_http_status(:success)
    end
  end

  describe 'GET #index with a hashtag search' do
    it 'lists hashtags matching the term as a substring' do
      Fabricate(:tag, name: 'sport')
      Fabricate(:tag, name: 'frsports')
      Fabricate(:tag, name: 'music')

      get :index, params: { search_hashtag: 'sport' }

      expect(response).to have_http_status(:success)
      expect(response.body).to include('frsports')
      expect(response.body).to_not include('#music')
    end
  end

  describe 'GET #show' do
    it 'returns http success' do
      category = Fabricate(:epsilon_category_master)

      get :show, params: { id: category.id }

      expect(response).to have_http_status(:success)
    end
  end

  describe 'POST #create' do
    it 'creates a category with its translations and a generated slug' do
      expect do
        post :create, params: { category: { name_translations: { en: 'Cinema', fr: 'Cinéma' } } }
      end.to change(Epsilon::Categorization::CategoryMaster, :count).by(1)

      category = Epsilon::Categorization::CategoryMaster.last
      expect(category.name).to eq('Cinema')
      expect(category.name_translations).to eq('en' => 'Cinema', 'fr' => 'Cinéma')
      expect(category.slug).to be_present
      expect(response).to redirect_to(admin_epsilon_categories_path)
    end
  end

  describe 'PATCH #update' do
    it 'renames the category' do
      category = Fabricate(:epsilon_category_master)

      patch :update, params: { id: category.id, category: { name_translations: { en: 'Movies', fr: 'Films' } } }

      category.reload
      expect(category.name).to eq('Movies')
      expect(category.name_translations).to eq('en' => 'Movies', 'fr' => 'Films')
      expect(response).to redirect_to(admin_epsilon_category_path(category))
    end
  end

  describe 'DELETE #destroy' do
    it 'deletes the category' do
      category = Fabricate(:epsilon_category_master)

      expect { delete :destroy, params: { id: category.id } }
        .to change(Epsilon::Categorization::CategoryMaster, :count).by(-1)

      expect(response).to redirect_to(admin_epsilon_categories_path)
    end
  end

  describe 'POST #reassign_hashtags' do
    let(:source) { Fabricate(:epsilon_category_master) }
    let(:target) { Fabricate(:epsilon_category_master) }

    before { Fabricate(:epsilon_hashtag_mapping, category_master: source, hashtag: 'chien') }

    it 'migrates hashtags to the target and removes them from the source' do
      post :reassign_hashtags, params: { id: source.id, target_category_id: target.id, hashtags: ['chien'], mode: 'migrate' }

      expect(source.hashtag_mappings.where(hashtag: 'chien')).to be_empty
      expect(target.hashtag_mappings.where(hashtag: 'chien')).to be_present
    end

    it 'copies hashtags to the target while keeping them in the source' do
      post :reassign_hashtags, params: { id: source.id, target_category_id: target.id, hashtags: ['chien'], mode: 'copy' }

      expect(source.hashtag_mappings.where(hashtag: 'chien')).to be_present
      expect(target.hashtag_mappings.where(hashtag: 'chien')).to be_present
    end

    it 'removes hashtags from the source' do
      post :reassign_hashtags, params: { id: source.id, hashtags: ['chien'], mode: 'remove' }

      expect(source.hashtag_mappings.where(hashtag: 'chien')).to be_empty
    end
  end

  describe 'POST #add_hashtags' do
    it 'adds normalized hashtags to the category' do
      category = Fabricate(:epsilon_category_master)

      post :add_hashtags, params: { id: category.id, new_hashtags: '#Chien, Chats ÉLÉPHANT' }

      expect(category.hashtag_mappings.pluck(:hashtag)).to contain_exactly('chien', 'chats', 'elephant')
      expect(response).to redirect_to(admin_epsilon_category_path(category))
    end
  end
end
