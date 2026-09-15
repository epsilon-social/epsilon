# frozen_string_literal: true

class AddGrantedAtToEpsilonAccountBadges < ActiveRecord::Migration[8.1]
  def up
    add_column :epsilon_account_badges, :granted_at, :datetime

    # Obtention date. Backfill existing rows from their creation time; new rows
    # default to now (set in the model) but can be back-dated.
    safety_assured { execute('UPDATE epsilon_account_badges SET granted_at = created_at WHERE granted_at IS NULL') }
  end

  def down
    remove_column :epsilon_account_badges, :granted_at
  end
end
