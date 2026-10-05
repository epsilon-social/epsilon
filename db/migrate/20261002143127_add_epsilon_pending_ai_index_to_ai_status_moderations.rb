# frozen_string_literal: true

class AddEpsilonPendingAiIndexToAiStatusModerations < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # Partial index over the (small) set of statuses currently held for AI
    # moderation, so the Status.epsilon_without_pending_ai subquery used on hot
    # timeline read paths scans the held set instead of the whole ledger.
    # state = 1 is Epsilon::AiStatusModeration state :pending_ai.
    add_index :epsilon_ai_status_moderations, :status_id,
              name: :index_epsilon_ai_moderations_pending_status_id,
              where: 'state = 1',
              algorithm: :concurrently
  end
end
