# frozen_string_literal: true

module Captcha
  def self.provider
    [AltchaProvider.new, HcaptchaProvider.new].find(&:available?)
  end
end
