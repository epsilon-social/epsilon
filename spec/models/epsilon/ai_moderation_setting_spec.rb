# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::AiModerationSetting do
  describe 'validations' do
    it 'validates numericality of thresholds' do
      setting = described_class.new(ban_violence: 1.5)
      expect(setting).to_not be_valid
      expect(setting.errors[:ban_violence]).to include('must be less than or equal to 1.0')
    end

    it 'validates presence of custom_prompt' do
      setting = described_class.new(custom_prompt: nil)
      expect(setting).to_not be_valid
      expect(setting.errors[:custom_prompt]).to include("can't be blank")
    end
  end

  describe '.current' do
    it 'creates a new record with default values if none exists' do
      expect { described_class.current }.to change(described_class, :count).by(1)
      expect(described_class.current.use_native_moderation).to be(false)
    end

    it 'returns the existing record if one exists' do
      described_class.current

      expect { described_class.current }.to_not change(described_class, :count)
    end
  end
end
