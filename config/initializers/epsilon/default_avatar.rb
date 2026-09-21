# frozen_string_literal: true

# Version the default avatar/header ("missing.png") URL served by Paperclip.
#
# The default placeholder is a static, non-fingerprinted file cached by browsers
# and CDNs for weeks (nginx sends a long `max-age`). When we ship a new
# placeholder, already-cached clients keep the old one until it expires. Serving
# it from a versioned *path* makes the API return a fresh URL, so every client
# switches immediately.
#
# Why the path and not a `?v=N` query: Mastodon escapes asset URLs, which turns
# `?` into `%3F` and breaks the link (this is also why Mastodon itself never
# uses query strings for assets, cf. `use_timestamp: false`).
#
# Why `default_options` and not a per-attachment override: kt-paperclip captures
# each attachment's options in a closure at definition time, so mutating the
# registry afterwards has no effect — but `default_options` is re-read on every
# Attachment instantiation, so it reliably applies.
#
# The template is global, so it also covers the default header; both files must
# exist on disk. To ship a new default avatar:
#   1. bump this version,
#   2. drop the new PNG at public/avatars/original/v<N>/missing.png
#      (and public/headers/original/v<N>/missing.png for the header).
EPSILON_DEFAULT_MEDIA_VERSION = 3

Paperclip::Attachment.default_options[:default_url] =
  "/:attachment/:style/v#{EPSILON_DEFAULT_MEDIA_VERSION}/missing.png"
