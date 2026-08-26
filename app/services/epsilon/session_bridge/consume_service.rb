# frozen_string_literal: true

module Epsilon
  module SessionBridge
    # Atomically consumes a bridge token. GETDEL guarantees single use even under
    # two concurrent requests (Redis 7 is deployed, so no Lua fallback is needed).
    # Returns { user_id:, access_token_id: } or nil when the token is absent,
    # expired, already used, or malformed.
    class ConsumeService < BaseService
      include Redisable

      def call(raw_token)
        # Guard against non-String params (?token[]=x arrives as an Array, ?token[a]=b
        # as a Hash): Digest::SHA256.hexdigest would raise TypeError -> trivial 500.
        return unless raw_token.is_a?(String) && raw_token.present?

        payload = redis.getdel(SessionBridge.redis_key(raw_token))
        return if payload.blank?

        JSON.parse(payload, symbolize_names: true)
      rescue JSON::ParserError
        nil
      end
    end
  end
end
