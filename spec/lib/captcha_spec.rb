# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Captcha do
  before do
    allow(Rails.configuration.x).to receive(:captcha).and_return(ActiveSupport::OrderedOptions.new.merge(config))
  end

  describe '.provider' do
    context 'when nothing is configured' do
      let(:config) { {} }

      it 'returns no provider' do
        expect(described_class.provider).to be_nil
      end
    end

    context 'when only hCaptcha keys are configured' do
      let(:config) { { site_key: 'site', secret_key: 'secret' } }

      it 'returns the hCaptcha provider' do
        expect(described_class.provider).to be_a(described_class::HcaptchaProvider)
      end
    end

    context 'when only an ALTCHA HMAC key is configured' do
      let(:config) { { altcha_hmac_key: 'hmac-key' } }

      it 'returns the ALTCHA provider' do
        expect(described_class.provider).to be_a(described_class::AltchaProvider)
      end
    end

    context 'when hCaptcha is only partially configured' do
      let(:config) { { site_key: 'site' } }

      it 'returns no provider' do
        expect(described_class.provider).to be_nil
      end
    end

    context 'when both providers are configured' do
      let(:config) { { site_key: 'site', secret_key: 'secret', altcha_hmac_key: 'hmac-key' } }

      it 'prefers the self-hosted ALTCHA provider' do
        expect(described_class.provider).to be_a(described_class::AltchaProvider)
      end
    end
  end
end
