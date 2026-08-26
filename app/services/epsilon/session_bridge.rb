# frozen_string_literal: true

module Epsilon
  # Shared constants and policy helpers for the OAuth-Bearer -> Devise-session
  # bridge. The bridge turns a first-party mobile Bearer into a normal web
  # session so the Expo WebView does not have to re-prompt for credentials.
  # See docs/session_bridge.md for the full design and the security analysis.
  module SessionBridge
    TTL_SECONDS = 30
    REDIS_KEY_PREFIX = 'session_bridge'

    module_function

    # Redis key = prefix + local domain + SHA256(raw token). We store the hash,
    # never the raw token, so a Redis dump cannot leak usable tokens. The local
    # domain scopes the key per instance: several Mastodon instances (prod /
    # preprod / dev) may share a Redis, and Doorkeeper ids are sequential, so a
    # token issued on one must not be consumable on another.
    def redis_key(raw_token)
      "#{REDIS_KEY_PREFIX}:#{Rails.configuration.x.local_domain}:#{Digest::SHA256.hexdigest(raw_token)}"
    end

    # The bridge is restricted to the first-party Epsilon OAuth client, matched
    # by its client_id (uid) configured via ENV. Fail-closed: when the ENV var
    # is unset the check rejects everyone, so a misconfiguration disables the
    # feature instead of opening it to every OAuth client on the instance.
    def first_party_application?(application)
      configured_uid = ENV.fetch('EPSILON_FIRST_PARTY_CLIENT_ID', nil)
      configured_uid.present? && application&.uid == configured_uid
    end

    # Any moderation / administration / infra permission disqualifies an account:
    # the /admin interface has no per-session step-up, so a dormant staff Bearer
    # must never be turned into a full web session. Bearers of ordinary users
    # (whose role only carries invite permissions) are allowed.
    #
    # Deny-by-default: we take EVERY permission category except the two benign
    # ones (:invites, :email). A category added by a future upstream version is
    # therefore refused, not silently missed — and `except` avoids the nil that a
    # `values_at` on a removed key would slip into `can?`.
    def staff_permission_flags
      UserRole::Flags::CATEGORIES.except(:invites, :email).values.flatten
    end
  end
end
