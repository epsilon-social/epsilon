# frozen_string_literal: true

module Epsilon
  class DelayedFanOutWorker
    include Sidekiq::Worker

    sidekiq_options queue: 'default', retry: 3

    def perform(status_id, options = {})
      status = Status.find_by(id: status_id)
      return if status.nil?

      FanOutOnWriteService.new.call(status, options.deep_symbolize_keys)
    end
  end
end
