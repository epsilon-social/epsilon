# frozen_string_literal: true

class AddTrigramIndexToEpsilonModerationEventsAcct < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  # Trigram GIN index so the account search (acct ILIKE '%…%', leading wildcard)
  # becomes index-backed instead of a full seq scan. Requires the pg_trgm
  # extension (CREATE EXTENSION needs a privileged DB role, once).
  def up
    enable_extension 'pg_trgm' unless extension_enabled?('pg_trgm')

    add_index :epsilon_moderation_events, :acct,
              using: :gin,
              opclass: :gin_trgm_ops,
              name: 'index_epsilon_moderation_events_on_acct_trgm',
              algorithm: :concurrently,
              if_not_exists: true
  end

  def down
    remove_index :epsilon_moderation_events, name: 'index_epsilon_moderation_events_on_acct_trgm', if_exists: true
  end
end
