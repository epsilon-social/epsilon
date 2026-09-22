# frozen_string_literal: true

# Strip every whitespace character from *local* usernames before validation.
#
# Mastodon core normalizes usernames with `squish`, which trims leading and
# trailing whitespace but keeps a single internal space (e.g. "jean dupont").
# That surviving space then fails the username format validation and blocks
# sign-up with a confusing error. The offending character is often invisible to
# the user — a stray space from mobile autocomplete or a non-breaking space
# pasted from another app. Removing all whitespace (POSIX [[:space:]] also
# covers tabs and U+00A0) lets these sign-ups succeed instead of failing.
#
# Scoped to local accounts on purpose: for remote accounts we must keep core's
# behaviour, where an internal space survives `squish` and is correctly rejected
# by the username format validation. Running after core's normalizer, a value
# like "jean dupont" is already squished to a single space before we strip it.
module Epsilon::UsernameNormalizationExtension
  extend ActiveSupport::Concern

  included do
    before_validation :epsilon_strip_username_whitespace, if: :local?
  end

  private

  def epsilon_strip_username_whitespace
    return if username.blank?

    self.username = username.gsub(/[[:space:]]+/, '')
  end
end
