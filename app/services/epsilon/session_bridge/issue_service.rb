# frozen_string_literal: true

module Epsilon
  module SessionBridge
    # Issues a single-use bridge token for a user, bound to the Doorkeeper access
    # token that authenticated the request. Returns the raw token; only its
    # SHA256 hash is persisted, with a Redis-enforced 30 second TTL.
    class IssueService < BaseService
      include Redisable

      def call(user:, access_token:)
        raw_token = SecureRandom.urlsafe_base64(32)

        redis.set(
          SessionBridge.redis_key(raw_token),
          { user_id: user.id, access_token_id: access_token.id }.to_json,
          ex: TTL_SECONDS
        )

        raw_token
      end
    end
  end
end
