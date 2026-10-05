# frozen_string_literal: true

module Epsilon
  # Manually releases a status held in pending_ai -- a staff decision that
  # overrides a stuck or slow AI verdict. The state is flipped first (all the
  # read guards and ActivityPubDistributionWorkerExtension key off pending_ai),
  # then the status gets its initial distribution, exactly like the fail-open
  # paths: the hold means nothing was ever delivered, so this is a fresh
  # publish, not a re-publish.
  #
  # The row lock plus the state re-check make the release idempotent and keep a
  # concurrent release (reaper, double click) from double-distributing. If the
  # AI verdict lands in the narrow window where the moderation worker is
  # already past its own pending_ai? check, that verdict still wins -- a
  # wrongly rejected post remains recoverable via the existing Restore button.
  class ApproveHeldStatusService < BaseService
    def call(status)
      # Query the table directly: the status instance may carry a stale, unsaved
      # association target (epsilon_ai_status_moderation_or_default builds one).
      moderation = ::Epsilon::AiStatusModeration.find_by(status_id: status.id)
      return status unless moderation&.pending_ai?

      released = false

      ApplicationRecord.transaction do
        moderation.lock!

        if moderation.pending_ai?
          moderation.update!(state: :approved)
          released = true
        end
      end

      return status unless released

      ::Epsilon::ModerationEvent.record!(
        status: status,
        decision: :manual_approved,
        source: :admin,
        sensitive: status.sensitive?
      )

      FanOutOnWriteService.new.call(status)
      ActivityPub::DistributionWorker.perform_async(status.id)

      status
    end
  end
end
