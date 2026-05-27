# frozen_string_literal: true

module Epsilon::NotifyServiceExtension
  extend ActiveSupport::Concern

  def call(recipient, type, activity, *args, **kwargs)
    return if epsilon_blocked_by_ai?(activity)

    super
  end

  private

  def epsilon_blocked_by_ai?(activity)
    statuses = epsilon_extract_statuses_from(activity)

    statuses.any? do |status|
      status.respond_to?(:moderation_state) && (status.pending_ai? || status.rejected?)
    end
  end

  def epsilon_extract_statuses_from(activity)
    extracted = []

    extracted << activity if activity.is_a?(Status)

    if activity.respond_to?(:class) && activity.class.respond_to?(:reflect_on_all_associations)
      activity.class.reflect_on_all_associations(:belongs_to).each do |assoc|
        next unless activity.respond_to?(assoc.name)

        record = activity.public_send(assoc.name)
        extracted << record if record.is_a?(Status)
      end
    end

    extracted.compact
  end
end
