# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::SessionBridge::ConsumeService do
  subject(:service) { described_class.new }

  let(:user) { Fabricate(:user) }
  let(:access_token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:raw) { Epsilon::SessionBridge::IssueService.new.call(user: user, access_token: access_token) }

  describe '#call' do
    it 'returns the payload for a valid token and consumes it atomically (single use)' do
      expect(service.call(raw)).to eq(user_id: user.id, access_token_id: access_token.id)

      # GETDEL removed it: a second consume (replay / concurrent request) finds nothing
      expect(service.call(raw)).to be_nil
    end

    it 'returns nil for an expired (vanished) token' do
      redis.del(Epsilon::SessionBridge.redis_key(raw))

      expect(service.call(raw)).to be_nil
    end

    it 'returns nil for an unknown token' do
      expect(service.call('does-not-exist')).to be_nil
    end

    it 'returns nil for a blank token' do
      expect(service.call('')).to be_nil
    end

    it 'returns nil, without raising, for a non-string token param' do
      expect(service.call(['x'])).to be_nil
      expect(service.call({ a: 'b' })).to be_nil
    end

    it 'returns nil for a malformed payload' do
      redis.set(Epsilon::SessionBridge.redis_key(raw), 'not-json', ex: 30)

      expect(service.call(raw)).to be_nil
    end
  end
end
