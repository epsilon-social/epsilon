# frozen_string_literal: true

module Auth::CaptchaConcern
  extend ActiveSupport::Concern

  # ==========================================
  # EPSILON : CAPTCHA PROVIDER ABSTRACTION
  # Delegates to Captcha.provider (hCaptcha or self-hosted ALTCHA),
  # auto-detected from environment variables. See app/lib/captcha.rb.
  # ==========================================

  CAPTCHA_DIRECTIVES = %w(
    connect_src
    frame_src
    script_src
    style_src
  ).freeze

  included do
    helper_method :render_captcha
  end

  def captcha_provider
    @captcha_provider ||= Captcha.provider
  end

  def captcha_available?
    captcha_provider.present?
  end

  def captcha_enabled?
    captcha_available? && Setting.captcha_enabled
  end

  def captcha_user_bypass?
    false
  end

  def captcha_required?
    captcha_enabled? && !captcha_user_bypass?
  end

  def check_captcha!
    return true unless captcha_required?

    if captcha_provider.verify(self)
      true
    else
      yield captcha_provider.error_message(self) if block_given?
      false
    end
  end

  def extend_csp_for_captcha!
    return unless captcha_required? && request.content_security_policy.present?

    sources = captcha_provider&.csp_sources
    return if sources.blank?

    request.content_security_policy = captcha_adjusted_policy(sources)
  end

  def render_captcha
    return unless captcha_required?

    captcha_provider.widget_html(helpers)
  end

  private

  def captcha_adjusted_policy(sources)
    request.content_security_policy.clone.tap do |policy|
      populate_captcha_policy(policy, sources)
    end
  end

  def populate_captcha_policy(policy, sources)
    CAPTCHA_DIRECTIVES.each do |directive|
      values = policy.send(directive)

      sources.each do |source|
        values << source unless values.include?(source) || values.include?('https:')
      end

      policy.send(directive, *values)
    end
  end
end
