# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Captcha challenge endpoint' do
  before do
    allow(Rails.configuration.x).to receive(:captcha).and_return(ActiveSupport::OrderedOptions.new.merge(config))
    Setting.captcha_enabled = captcha_enabled
  end

  context 'with ALTCHA configured and the captcha enabled' do
    let(:config)          { { altcha_hmac_key: 'hmac-key' } }
    let(:captcha_enabled) { true }

    it 'returns a signed challenge as JSON' do
      get '/auth/captcha_challenge'

      expect(response).to have_http_status(200)
      expect(response.content_type).to start_with('application/json')
      expect(response.parsed_body['signature']).to be_present
      expect(response.parsed_body['parameters']).to include('algorithm' => Captcha::AltchaProvider::ALGORITHM)
    end
  end

  context 'with ALTCHA configured but the captcha disabled' do
    let(:config)          { { altcha_hmac_key: 'hmac-key' } }
    let(:captcha_enabled) { false }

    it 'returns not found' do
      get '/auth/captcha_challenge'

      expect(response).to have_http_status(404)
    end
  end

  context 'with hCaptcha as the active provider' do
    let(:config)          { { site_key: 'site', secret_key: 'secret' } }
    let(:captcha_enabled) { true }

    it 'returns not found' do
      get '/auth/captcha_challenge'

      expect(response).to have_http_status(404)
    end
  end

  context 'with no provider configured' do
    let(:config)          { {} }
    let(:captcha_enabled) { true }

    it 'returns not found' do
      get '/auth/captcha_challenge'

      expect(response).to have_http_status(404)
    end
  end
end
