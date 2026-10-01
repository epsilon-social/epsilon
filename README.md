# Epsilon

**Epsilon** is a French social network built on [Mastodon](https://github.com/mastodon/mastodon). It is a fork of **Mastodon v4.6.0** that adds content categorization, AI-assisted moderation, and a complete redesign of the web interface.

- Instance: [epsilon.social](https://epsilon.social)
- iOS app: [Epsilon Social on the App Store](https://apps.apple.com/app/epsilon-social/id6804720532)
- Changelog of all Epsilon-specific changes: [EPSILON_CHANGELOG.md](EPSILON_CHANGELOG.md) (in French)

## About this repository

This repository contains the source code of what runs in production at epsilon.social, published in compliance with the **AGPLv3** license inherited from Mastodon.

Day-to-day development happens in a private repository; this public repository is updated at each production deployment. Issues and feature branches are not mirrored here — the commit history of the production branch is.

## What's different from Mastodon

Epsilon follows a **non-destructive "sidecar" architecture**: native Mastodon tables and logic are left untouched wherever possible. New behavior lives in parallel tables (`epsilon_*`, `category_*`) and `ActiveSupport::Concern` extensions, and every unavoidable edit to a core file is flagged with an `EPSILON` comment block. This keeps upstream upgrades tractable (upstream releases are merged, not rebased).

Main additions:

- **Content categorization** — 23 official categories (FR/EN), hashtag-to-category mapping, automatic categorization of local posts, per-category subscriptions and feeds, crowdsourced category votes, admin tooling.
- **AI-assisted moderation** — statuses go through a moderation state machine (`unmoderated → pending_ai → approved / manual_review / rejected`) scored by [Mistral](https://mistral.ai). Fail-open by design: if the API is unavailable, posts publish normally. Includes a kill switch, configurable thresholds and prompt, and an admin dashboard.
- **UI redesign** — three-column layout, light/dark themes, compose modal, redesigned Explore/Trends/Notifications, onboarding flow for category selection.
- **Extended limits** — 9,000-character posts, 10 media attachments.

## Running Epsilon yourself

Honest disclaimer: **self-hosting Epsilon is possible but not officially supported.** This code is published for transparency and license compliance; it is deployed and tested on exactly one instance. There is no installation documentation beyond Mastodon's, no migration path from a stock Mastodon instance is guaranteed, and some UI surfaces assume Epsilon's data has been seeded.

If you want to try anyway:

1. Follow the standard [Mastodon installation guide](https://docs.joinmastodon.org/admin/install/) — the stack (Ruby on Rails, PostgreSQL, Redis, Sidekiq, Node.js) and deployment configurations are unchanged.
2. Run the Epsilon seeds, without which categorization features will be empty or broken:

   ```sh
   RAILS_ENV=production bin/rails epsilon:categories:seed   # official categories (idempotent)
   RAILS_ENV=production bin/rails epsilon:hashtags:seed     # hashtag→category mappings
   RAILS_ENV=production bin/rails epsilon:setup_sentinel    # AI moderation system account
   ```

3. Optional environment variables:
   - `MISTRAL_API_KEY` — enables AI moderation. Without it, moderation fails open and posts publish normally.
   - `EPSILON_FIRST_PARTY_CLIENT_ID` — OAuth client ID of the first-party mobile app.

Bug reports from self-hosters are welcome, but support is best-effort.

## Contributing

The project is young and the contribution process is not formalized yet. Bug reports and security reports are welcome through the issue tracker. If you want to contribute code, please open an issue first to discuss it.

## Upstream

Epsilon is possible thanks to [Mastodon](https://joinmastodon.org) and its contributors. General documentation about running and using Mastodon lives at [docs.joinmastodon.org](https://docs.joinmastodon.org). Epsilon tracks upstream releases by merging them.

## License

Copyright (c) 2026 Epsilon (modifications)
Copyright (c) 2016-2025 Eugen Rochko & other [Mastodon contributors](AUTHORS.md) (original work)

Licensed under the GNU Affero General Public License v3 as stated in [LICENSE](LICENSE):

```text
This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see https://www.gnu.org/licenses/
```
