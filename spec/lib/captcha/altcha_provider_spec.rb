# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Captcha::AltchaProvider do
  subject(:provider) { described_class.new }

  let(:hmac_key) { 'test-altcha-hmac-key' }

  before do
    allow(Rails.configuration.x).to receive(:captcha).and_return(
      ActiveSupport::OrderedOptions.new.merge(altcha_hmac_key: hmac_key)
    )
  end

  # Builds the base64 payload the widget would POST. Uses a minimal-difficulty
  # challenge so solving is instant: the provider only trusts the HMAC
  # signature, not the difficulty parameters.
  def solved_payload(hmac: hmac_key, expires_at: 5.minutes.from_now)
    options = Altcha::V2::CreateChallengeOptions.new(
      algorithm: 'SHA-256',
      cost: 1,
      counter: 5,
      expires_at: expires_at,
      hmac_signature_secret: hmac
    )
    challenge = Altcha::V2.create_challenge(options)
    solution  = Altcha::V2.solve_challenge(challenge)
    Base64.strict_encode64(Altcha::V2::Payload.new(challenge: challenge, solution: solution).to_json)
  end

  def controller_with(altcha)
    instance_double(Auth::CaptchasController, params: ActionController::Parameters.new(altcha: altcha))
  end

  describe '#available?' do
    it 'is available when the HMAC key is configured' do
      expect(provider.available?).to be true
    end

    context 'without an HMAC key' do
      let(:hmac_key) { nil }

      it 'is not available' do
        expect(provider.available?).to be false
      end
    end
  end

  describe '#csp_sources' do
    it 'needs no third-party CSP sources' do
      expect(provider.csp_sources).to eq []
    end
  end

  describe '#challenge_json' do
    let(:challenge) { JSON.parse(provider.challenge_json) }

    it 'returns a signed proof-of-work challenge' do
      expect(challenge['signature']).to be_present
      expect(challenge['parameters']).to include('algorithm' => described_class::ALGORITHM, 'cost' => described_class::COST)
    end

    it 'embeds a future expiration' do
      expect(challenge['parameters']['expiresAt']).to be > Time.now.to_i
    end
  end

  describe '#verify' do
    it 'accepts a solved payload once' do
      expect(provider.verify(controller_with(solved_payload))).to be true
    end

    it 'rejects a replayed payload' do
      payload = solved_payload

      expect(provider.verify(controller_with(payload))).to be true
      expect(provider.verify(controller_with(payload))).to be false
    end

    it 'rejects a payload signed with the wrong key' do
      expect(provider.verify(controller_with(solved_payload(hmac: 'forged-key')))).to be false
    end

    it 'rejects an expired payload' do
      expect(provider.verify(controller_with(solved_payload(expires_at: 1.minute.ago)))).to be false
    end

    it 'rejects a blank payload' do
      expect(provider.verify(controller_with(''))).to be false
    end

    it 'rejects a payload that is not base64 JSON' do
      expect(provider.verify(controller_with('not-base64!'))).to be false
    end

    it 'rejects a structurally invalid payload' do
      # The widget test mode posts { challenge: null, solution: null }
      payload = Base64.strict_encode64({ challenge: nil, solution: nil, test: true }.to_json)

      expect(provider.verify(controller_with(payload))).to be false
    end
  end

  describe '#error_message' do
    it 'returns a localized failure message' do
      expect(provider.error_message(nil)).to eq I18n.t('auth.captcha_confirmation.failed')
    end
  end
end
