# frozen_string_literal: true

# ==========================================
# EPSILON : MODERATION LIVE FEED FILTER
# Partial index for the moderator-only "sensitive / CW" filter on the live
# feed (PublicFeed#sensitive_only_scope).
#
# Additive and reversible: does not alter the structure or data of the native
# `statuses` table. Built CONCURRENTLY (no write lock, required by
# strong_migrations); partial, so small (~2-5% of rows) and fast to build.
# ==========================================
class AddEpsilonSensitiveIndexToStatuses < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    safety_assured do
      add_index :statuses,
                :id,
                order: { id: :desc },
                where: "sensitive OR spoiler_text <> ''",
                algorithm: :concurrently,
                if_not_exists: true,
                name: :index_statuses_epsilon_sensitive_id
    end
  end

  def down
    remove_index :statuses, name: :index_statuses_epsilon_sensitive_id, algorithm: :concurrently, if_exists: true
  end
end
