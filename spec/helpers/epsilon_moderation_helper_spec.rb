# frozen_string_literal: true

require 'rails_helper'

RSpec.describe EpsilonModerationHelper do
  describe '#epsilon_ai_content_warning?' do
    it 'detects a content warning the AI flagged and still active' do
      status = Fabricate(:status, sensitive: true)
      Fabricate(:epsilon_ai_status_moderation, status: status, ai_content_warning: true)

      expect(helper.epsilon_ai_content_warning?(status.reload)).to be(true)
    end

    it 'ignores a content warning the AI did not flag' do
      status = Fabricate(:status, sensitive: true)
      Fabricate(:epsilon_ai_status_moderation, status: status, ai_content_warning: false)

      expect(helper.epsilon_ai_content_warning?(status.reload)).to be(false)
    end

    it 'ignores a status that is no longer sensitive' do
      status = Fabricate(:status, sensitive: false)
      Fabricate(:epsilon_ai_status_moderation, status: status, ai_content_warning: true)

      expect(helper.epsilon_ai_content_warning?(status.reload)).to be(false)
    end

    it 'ignores a status with no moderation record' do
      status = Fabricate(:status, sensitive: true)

      expect(helper.epsilon_ai_content_warning?(status)).to be(false)
    end
  end
end
