# frozen_string_literal: true

class CleanupLegacyEpsilonModeration < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      remove_column :statuses, :moderation_state if column_exists?(:statuses, :moderation_state)

      drop_table :ai_metadata if table_exists?(:ai_metadata)

      drop_table :ai_status_moderations if table_exists?(:ai_status_moderations)
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Cannot restore legacy non-sidecar Epsilon architecture'
  end
end
