# frozen_string_literal: true

module Captcha
  class AltchaProvider
    include Redisable

    ALGORITHM = 'PBKDF2/SHA-256'
    COST = 5_000
    COUNTER_RANGE = (5_000..20_000)
    CHALLENGE_TTL = 10.minutes
    REPLAY_TTL = (CHALLENGE_TTL * 2).to_i

    def available?
      hmac_key.present?
    end

    def csp_sources
      []
    end

    def widget_html(helpers)
      tags = [
        # Exposes the per-request CSP nonce via <meta name="csp-nonce">,
        # which the widget picks up for its injected <style> tag
        helpers.csp_meta_tag,
        helpers.vite_typescript_tag('captcha.ts', crossorigin: 'anonymous'),
        helpers.tag.altcha_widget(challenge: helpers.auth_captcha_challenge_path, auto: 'onload'),
      ]

      helpers.safe_join(tags)
    end

    def challenge_json
      options = Altcha::V2::CreateChallengeOptions.new(
        algorithm: ALGORITHM,
        cost: COST,
        counter: SecureRandom.random_number(COUNTER_RANGE),
        expires_at: CHALLENGE_TTL.from_now,
        hmac_signature_secret: hmac_key
      )

      Altcha::V2.create_challenge(options).to_json
    end

    def verify(controller)
      payload = decode_payload(controller.params[:altcha])
      return false if payload.nil?

      result = Altcha::V2.verify_solution(payload.challenge, payload.solution, hmac_signature_secret: hmac_key)
      result.verified && mark_nonce_used!(payload.challenge.parameters.nonce)
    end

    def error_message(_controller)
      I18n.t('auth.captcha_confirmation.failed')
    end

    private

    def hmac_key
      Rails.configuration.x.captcha.altcha_hmac_key
    end

    def decode_payload(value)
      return if value.blank?

      Altcha::V2::Payload.from_json(Base64.strict_decode64(value))
    rescue ArgumentError, JSON::ParserError, NoMethodError, TypeError
      nil
    end

    def mark_nonce_used!(nonce)
      redis.set("altcha:#{nonce}", '1', nx: true, ex: REPLAY_TTL)
    end
  end
end
