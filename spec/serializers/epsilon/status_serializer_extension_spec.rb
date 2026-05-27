# spec/serializers/epsilon/status_serializer_extension_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::StatusSerializerExtension do
  let(:serializer_class) do
    Class.new(ActiveModel::Serializer) do
      include Epsilon::StatusSerializerExtension
    end
  end

  let(:status) { Fabricate(:status) }
  let(:serializer) { serializer_class.new(status) }

  describe '#moderation_state' do
    it 'returns the moderation state of the status' do
      status.epsilon_ai_status_moderation_or_default.update!(state: :approved)
      expect(serializer.moderation_state).to eq('approved')
    end
  end

  describe '#ai_moderated' do
    context 'when moderation_state is approved' do
      it 'returns true' do
        status.epsilon_ai_status_moderation_or_default.update!(state: :approved)
        expect(serializer.ai_moderated).to be true
      end
    end

    context 'when moderation_state is manual_review' do
      it 'returns false' do
        status.epsilon_ai_status_moderation_or_default.update!(state: :manual_review)
        expect(serializer.ai_moderated).to be false
      end
    end

    context 'when moderation_state is pending_ai' do
      it 'returns false' do
        status.epsilon_ai_status_moderation_or_default.update!(state: :pending_ai)
        expect(serializer.ai_moderated).to be false
      end
    end

    context 'when moderation_state is unmoderated' do
      it 'returns false' do
        status.epsilon_ai_status_moderation_or_default.update!(state: :unmoderated)
        expect(serializer.ai_moderated).to be false
      end
    end

    context 'when moderation_state is rejected' do
      it 'returns false' do
        status.epsilon_ai_status_moderation_or_default.update!(state: :rejected)
        expect(serializer.ai_moderated).to be false
      end
    end
  end
end
