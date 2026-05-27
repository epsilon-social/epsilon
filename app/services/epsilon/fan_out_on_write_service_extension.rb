# frozen_string_literal: true

module Epsilon
  module FanOutOnWriteServiceExtension
    extend ActiveSupport::Concern

    def call(status, **options)
      return if status.respond_to?(:pending_ai?) && status.pending_ai?

      super
    end
  end
end
