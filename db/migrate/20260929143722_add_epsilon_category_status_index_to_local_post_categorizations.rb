# frozen_string_literal: true

# ==========================================
# EPSILON : MODERATION CATEGORY FEED FILTER
# Composite partial index for the moderator-only category filter on the live
# feed (PublicFeed#category_filter_scope): looking up the latest statuses of
# one or more categories becomes an ordered index scan (status ids are
# snowflakes, so chronological) instead of a sort of every row of the
# category.
#
# Additive and reversible: sidecar table only, no native table touched. Built
# CONCURRENTLY (no write lock, required by strong_migrations).
# ==========================================
class AddEpsilonCategoryStatusIndexToLocalPostCategorizations < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    add_index :local_post_categorizations,
              [:category_master_id, :status_id],
              order: { status_id: :desc },
              where: 'is_validated',
              algorithm: :concurrently,
              if_not_exists: true,
              name: :idx_epsilon_lpc_category_status_validated
  end

  def down
    remove_index :local_post_categorizations, name: :idx_epsilon_lpc_category_status_validated, algorithm: :concurrently, if_exists: true
  end
end
