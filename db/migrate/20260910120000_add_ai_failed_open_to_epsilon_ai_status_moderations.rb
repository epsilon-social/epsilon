# frozen_string_literal: true

class AddAiFailedOpenToEpsilonAiStatusModerations < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    # Marks statuses published *without* an AI verdict because the Mistral call
    # exhausted its retries (fail-open). These are the backlog the re-moderation
    # scheduler re-checks once the API is healthy again. Metadata-only on PG11+
    # (NOT NULL + default), so it is instant on an existing table.
    add_column :epsilon_ai_status_moderations, :ai_failed_open, :boolean, default: false, null: false, if_not_exists: true

    # Partial index: the backlog is a tiny slice of the table (only during/after
    # an outage), so we only index the true rows the scheduler scans.
    add_index :epsilon_ai_status_moderations, :ai_failed_open,
              where: 'ai_failed_open = true',
              name: 'index_epsilon_ai_status_moderations_on_failed_open',
              algorithm: :concurrently,
              if_not_exists: true
  end

  def down
    remove_index :epsilon_ai_status_moderations,
                 name: 'index_epsilon_ai_status_moderations_on_failed_open',
                 if_exists: true
    remove_column :epsilon_ai_status_moderations, :ai_failed_open, if_exists: true
  end
end
