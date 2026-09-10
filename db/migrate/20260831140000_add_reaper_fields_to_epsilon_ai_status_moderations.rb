# frozen_string_literal: true

class AddReaperFieldsToEpsilonAiStatusModerations < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :epsilon_ai_status_moderations, :reaper_attempts, :integer, default: 0, null: false, if_not_exists: true

    # Partial index over the (tiny, transient) set of pending_ai rows so the
    # reaper's per-minute sweep is an index probe instead of a full table scan
    # that grows with every status ever moderated. state = 1 is :pending_ai.
    add_index :epsilon_ai_status_moderations, :updated_at,
              where: 'state = 1',
              name: 'index_epsilon_ai_status_moderations_pending',
              algorithm: :concurrently,
              if_not_exists: true
  end
end
