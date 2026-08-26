# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::SessionBridge::IssueService do
  subject(:service) { described_class.new }

  let(:user) { Fabricate(:user) }
  let(:access_token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }

  describe '#call' do
    it 'returns a random token and persists only its hash, with a 30s Redis TTL' do
      raw = service.call(user: user, access_token: access_token)

      expect(raw).to be_present

      key = Epsilon::SessionBridge.redis_key(raw)
      expect(redis.exists?(key)).to be(true)

      # the raw token itself is never used as a key
      expect(redis.exists?("session_bridge:#{Rails.configuration.x.local_domain}:#{raw}")).to be(false)

      expect(redis.ttl(key)).to be_between(1, 30)
    end

    it 'stores the user id and the originating access token id' do
      raw = service.call(user: user, access_token: access_token)

      payload = JSON.parse(redis.get(Epsilon::SessionBridge.redis_key(raw)), symbolize_names: true)
      expect(payload).to eq(user_id: user.id, access_token_id: access_token.id)
    end

    it 'issues a distinct token on each call' do
      first = service.call(user: user, access_token: access_token)
      second = service.call(user: user, access_token: access_token)

      expect(first).to_not eq(second)
    end
  end
end
