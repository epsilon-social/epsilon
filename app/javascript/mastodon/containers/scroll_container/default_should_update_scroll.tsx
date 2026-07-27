import type { MastodonLocation } from 'mastodon/components/router';

export type ShouldUpdateScrollFn = (
  prevLocationContext: MastodonLocation | null,
  locationContext: MastodonLocation,
) => boolean;

/**
 * ScrollBehavior will automatically scroll to the top on navigations
 * or restore saved scroll positions, but on some location changes we
 * need to prevent this.
 */

export const defaultShouldUpdateScroll: ShouldUpdateScrollFn = (
  prevLocation,
  location,
) => {
  // === EPSILON =============================================================
  // Opening AND closing a modal pushes/pops a history entry on the SAME URL
  // (only state.mastodonModalKey differs). The upstream check only skipped the
  // scroll update on OPEN, so CLOSE fell through to `true` and ScrollBehavior
  // yanked the page to the top. That is invisible in vanilla (an inner
  // .scrollable scrolls, not the body) but our layout scrolls the document
  // body, so the jump shows. Skip the scroll update for both directions,
  // gated on same-URL so real navigations away from a modal still scroll.
  // Note: once the first comparison is truthy, TS narrows prevLocation to
  // non-null, so the remaining accesses intentionally omit the optional chain.
  const samePath =
    prevLocation?.pathname === location.pathname &&
    prevLocation.search === location.search &&
    prevLocation.hash === location.hash;

  const modalKeyChanged =
    (location.state?.mastodonModalKey ?? null) !==
    (prevLocation?.state?.mastodonModalKey ?? null);

  if (samePath && modalKeyChanged) {
    return false;
  }
  // === /EPSILON ============================================================

  return true;
};
