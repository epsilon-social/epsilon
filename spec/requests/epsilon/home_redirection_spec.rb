# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Epsilon : Home Redirect' do
  describe 'GET /home' do
    context 'when the user is not connected' do
      it 'redirect to about page' do
        get '/home'
        expect(response).to redirect_to(about_path)
      end
    end

    context 'when the user is connected' do
      let(:user) { Fabricate(:user) }

      before do
        sign_in user
      end

      it 'redirect status 200 (OK)' do
        get '/home'
        expect(response).to have_http_status(:success)
      end
    end
  end
end
