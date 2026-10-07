# Curated editorial feeds ("fils d'actu")

Platform-curated news feeds, built by the moderation team — not by users.
Nothing is ever published without an explicit human decision.

## How it works

- Feeds live in `epsilon_curated_feeds` (seeded: `discover` + child `world`).
  A parent feed **aggregates its children**: anything published in a child
  shows in the parent's timeline too (cross-feed ordering via a global
  position counter). Curate in the most specific feed — add to the parent
  directly only for general posts that belong to no sub-feed.
- Content is attached through `epsilon_curated_feed_items` with two states:
  `draft` (on the studio board, invisible publicly) and `published`.
- **Ordering is NOT chronological**: the public feed renders by curation
  `position` (descending). Publishing a batch stacks it on top of the feed in
  the exact order composed on the draft board. The API cursor (`max_id`)
  paginates on `position`.
- Public read endpoints (`GET /api/v1/epsilon/curated_feeds`,
  `GET /api/v1/epsilon/curated_feeds/:slug/statuses`) work logged-out and are
  HTTP-cached 15s for anonymous traffic. The `/discover` page is public.

## Daily workflow (staff, `manage_taxonomies` permission)

1. Open the **curation studio** at `/curation` (linked from the sidebar).
2. Search posts by **account**, **hashtag**, **post URL** or **fork
   category**; attribute them to feeds with the per-post buttons → they land
   in that feed's **draft board** (server-side: survives reloads, shared
   between curators).
3. On the _Drafts_ tab: drag to reorder, **Shuffle** to break single-outlet
   blocks, remove strays, then **Publish** — the batch appears on top of the
   public feed in the composed order.
4. Quick add/remove from anywhere: the "Curated feeds…" entry in a status'
   `…` menu opens a checkbox picker (checked = published immediately on top;
   unchecked = removed — use this when a curated post turns out to be fake
   news).

Feed management (create "Présidentielles 2027", rename, archive, time
window…) lives in `/admin/epsilon/curated_feeds`.

## The curator account (important ops step)

The studio's account search only sees statuses **already known to this
instance**. For a remote outlet nobody follows, results are thin. Two
complementary mechanisms:

- **"Import recent posts" button** (account mode, remote accounts): reads the
  account's public ActivityPub outbox (1–2 pages, ~20 statuses max) through
  `Epsilon::Curation::FetchOutboxService` and imports them. Covers history,
  depends on the remote instance exposing a standard outbox.
- **A dedicated curator account** (staff-owned, e.g. `@EpsilonCuration`)
  should **follow every source account** the team curates from. Following is
  what makes their _future_ posts federate in continuously. Import covers the
  past, the follow covers the future.

## Constraints & notes

- Only **public, non-reblog** statuses can be curated (replies allowed via
  the manual picker, not surfaced by default searches).
- Deleting a status cleans its feed items (FK cascade). Statuses hidden by
  AI moderation are local-only concerns; federated posts have no AI state.
- `DISALLOW_UNAUTHENTICATED_API_ACCESS` must stay **unset** in production,
  otherwise the public feed pages break for logged-out visitors.
- Event feed lifecycle: create as `draft` → fill drafts → `published` (+
  optional `starts_at`/`ends_at` window — expired feeds disappear from the
  public list automatically, no scheduler involved) → `archived` when done.
  The `discover` feed is deletion-protected in the admin.
- Seeds: `RAILS_ENV=production bin/rails epsilon:curated_feeds:seed`
  (idempotent, never touches existing rows).
