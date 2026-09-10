# frozen_string_literal: true

module Epsilon
  # Completes the pending_ai hold on the federation side. FanOutOnWriteServiceExtension
  # blocks *local* delivery of a status under moderation, but PostStatusService also
  # enqueues ActivityPub::DistributionWorker directly, which would otherwise federate
  # the still-unmoderated post to remote instances. We skip it here; the status is
  # re-federated once the verdict lands (worker approve / reaper release / fail-open).
  module ActivityPubDistributionWorkerExtension
    def perform(status_id, ...)
      status = Status.find_by(id: status_id)
      return if status&.pending_ai?

      super
    end
  end
end
