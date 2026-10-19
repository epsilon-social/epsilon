# frozen_string_literal: true

module Epsilon::UserSearchIndexExtension
  extend ActiveSupport::Concern

  included do
    # Natively, only Account and AccountStat saves reindex an account, but the
    # AccountsIndex scope (Account.searchable) also requires the user to be
    # approved AND confirmed. Approving or confirming only saves the users row,
    # so an account validated after signup stays out of the search index until
    # an unrelated save (first post, follow, profile edit) or a full
    # `tootctl search deploy`. Re-evaluate the account whenever either flag
    # changes; the index scope still decides inclusion, so a half-validated
    # user is kept out rather than added.
    update_index('accounts', :account, if: -> { saved_change_to_approved? || saved_change_to_confirmed_at? })
  end
end
