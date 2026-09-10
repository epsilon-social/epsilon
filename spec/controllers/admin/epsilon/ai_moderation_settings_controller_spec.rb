# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Admin::Epsilon::AiModerationSettingsController do
  render_views

  let(:role) { Fabricate(:user_role, permissions: UserRole::FLAGS[:manage_reports]) }
  let(:user) { Fabricate(:user, role: role) }

  before do
    sign_in user, scope: :user
  end

  describe 'GET #show' do
    it 'returns http success and renders the form' do
      get :show

      expect(response).to have_http_status(:success)
      expect(response.body).to include('epsilon_ai_moderation_setting_custom_prompt')
    end
  end

  describe 'PUT #update' do
    let(:setting) { Epsilon::AiModerationSetting.current }

    context 'with valid params' do
      let(:valid_params) do
        {
          epsilon_ai_moderation_setting: {
            use_native_moderation: '1',
            ban_violence: '0.9',
            custom_prompt: 'Updated Epsilon AI Prompt',
          },
        }
      end

      it 'updates the setting and redirects to the show page' do
        put :update, params: valid_params

        setting.reload
        expect(setting.use_native_moderation).to be(true)
        expect(setting.ban_violence).to eq(0.9)
        expect(setting.custom_prompt).to eq('Updated Epsilon AI Prompt')
        expect(response).to redirect_to(admin_epsilon_ai_moderation_setting_path)
      end
    end

    context 'with invalid params' do
      let(:invalid_params) do
        {
          epsilon_ai_moderation_setting: {
            ban_violence: '2.5',
          },
        }
      end

      it 'does not update and re-renders the show view' do
        original_violence = setting.ban_violence

        put :update, params: invalid_params

        setting.reload
        expect(setting.ban_violence).to eq(original_violence)

        expect(response).to have_http_status(:success)
        expect(response.body).to include('epsilon_ai_moderation_setting_ban_violence')
      end
    end
  end

  describe 'POST #remoderate' do
    it 'enqueues the re-moderation scheduler and redirects back' do
      expect { post :remoderate }.to change(Epsilon::AiRemoderationScheduler.jobs, :size).by(1)

      expect(response).to redirect_to(admin_epsilon_ai_moderation_setting_path)
    end

    context 'when the user lacks the moderation permission' do
      let(:role) { Fabricate(:user_role, permissions: 0) }

      it 'is forbidden and enqueues nothing' do
        expect { post :remoderate }.to_not change(Epsilon::AiRemoderationScheduler.jobs, :size)

        expect(response).to have_http_status(403)
      end
    end
  end
end
