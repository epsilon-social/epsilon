# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::SubscribeBackfillWorker do
  let(:feed_manager) { FeedManager.instance }

  describe 'contract with the private FeedManager#build_crutches API' do
    subject(:parameters) { feed_manager.method(:build_crutches).parameters }

    it 'exists as a private method' do
      expect(feed_manager.respond_to?(:build_crutches, true)).to be(true)
    end

    it 'stays private (not publicly exposed)' do
      expect(feed_manager.respond_to?(:build_crutches)).to be(false)
    end

    it 'expects (receiver_id, statuses) as required positional arguments' do
      required = parameters.select { |pair| pair.first == :req }.map(&:last)
      expect(required).to eq(%i(receiver_id statuses))
    end

    it 'accepts the optional :list keyword argument' do
      keyword_types = %i(key keyreq)
      keywords = parameters.select { |pair| keyword_types.include?(pair.first) }.map(&:last)
      expect(keywords).to include(:list)
    end

    it 'stays callable with 2 positional arguments (as used by the worker)' do
      expect(feed_manager.method(:build_crutches).arity).to eq(-3)
    end
  end

  describe 'contract with the private FeedManager#filter_from_home API' do
    subject(:parameters) { feed_manager.method(:filter_from_home).parameters }

    it 'exists as a private method' do
      expect(feed_manager.respond_to?(:filter_from_home, true)).to be(true)
    end

    it 'stays private (not publicly exposed)' do
      expect(feed_manager.respond_to?(:filter_from_home)).to be(false)
    end

    it 'expects (status, receiver_id, crutches) as required positional arguments' do
      required = parameters.select { |pair| pair.first == :req }.map(&:last)
      expect(required).to eq(%i(status receiver_id crutches))
    end

    it 'accepts an optional positional timeline_type argument' do
      optional = parameters.select { |pair| pair.first == :opt }.map(&:last)
      expect(optional).to include(:timeline_type)
    end

    it 'stays callable with 3 positional arguments (as used by the worker)' do
      expect(feed_manager.method(:filter_from_home).arity).to eq(-4)
    end
  end
end
