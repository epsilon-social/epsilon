# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Epsilon::StatusesControllerExtension' do
  let(:user)  { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'POST /api/v1/statuses' do
    context 'when poll is nil (Frontend behavior)' do
      it 'cleans the empty poll parameter and successfully creates the status' do
        post '/api/v1/statuses', params: { status: 'Test Epsilon without poll', poll: nil }, headers: headers

        expect(response).to have_http_status(200)
        expect(Status.last.text).to eq('Test Epsilon without poll')
        expect(Status.last.poll).to be_nil
      end
    end

    context 'when poll is legitimately populated' do
      it 'retains the poll parameter and processes it correctly' do
        poll_params = { options: %w(Option1 Option2), expires_in: 3600 }

        post '/api/v1/statuses', params: { status: 'Test Epsilon with poll', poll: poll_params }, headers: headers

        expect(response).to have_http_status(200)
        expect(Status.last.poll).to be_present
        expect(Status.last.poll.options).to eq(%w(Option1 Option2))
      end
    end
  end
end
