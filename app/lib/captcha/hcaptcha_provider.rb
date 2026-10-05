# frozen_string_literal: true

module Captcha
  class HcaptchaProvider
    CSP_SOURCES = %w(
      https://*.hcaptcha.com
      https://hcaptcha.com
    ).freeze

    def available?
      settings.secret_key.present? && settings.site_key.present?
    end

    def csp_sources
      CSP_SOURCES
    end

    def widget_html(helpers)
      helpers.hcaptcha_tags
    end

    def verify(controller)
      controller.send(:verify_hcaptcha)
    end

    def error_message(controller)
      controller.flash.delete(:hcaptcha_error)
    end

    private

    def settings
      Rails.configuration.x.captcha
    end
  end
end
