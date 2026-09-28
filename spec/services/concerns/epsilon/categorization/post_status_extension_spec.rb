# frozen_string_literal: true

# rubocop:disable RSpec/SpecFilePathFormat
require 'rails_helper'

RSpec.describe PostStatusService, type: :service do
  subject { described_class.new }

  let(:account) { Fabricate(:account) }

  describe 'Epsilon categorization extension' do
    it 'enqueues the categorization worker only once the hashtags are attached' do
      tag_names_at_enqueue = nil

      allow(Epsilon::Categorization::CategorizeStatusWorker).to receive(:perform_async) do |status_id|
        tag_names_at_enqueue = Status.find(status_id).tags.pluck(:name)
      end

      status = subject.call(account, text: 'Debate time #politique')

      expect(Epsilon::Categorization::CategorizeStatusWorker).to have_received(:perform_async).with(status.id).once
      expect(tag_names_at_enqueue).to include('politique')
    end
  end
end
# rubocop:enable RSpec/SpecFilePathFormat
