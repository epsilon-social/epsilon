import { List as ImmutableList } from 'immutable';

// Fixed clock-aligned one-hour buckets (12:00-13:00, 13:00-14:00...).
// A post's bucket is intrinsic to its created_at: grouping never depends on
// which pages happen to be loaded, so paginating older content can never
// re-shuffle groups above the viewport (window chaining anchored on the
// oldest *loaded* post did, teleporting the scroll position).
export const STACK_WINDOW_MS = 60 * 60 * 1000;

// Minimum number of posts within the window to fold them into a stack.
export const STACK_MIN_SIZE = 3;

// Returns the representative status id of a timeline item: the anchor id
// for a stack, the item itself otherwise. Used where native code indexes
// into the timeline list (LoadGap keys/params, load-more fallback).
export const stackAnchorId = (item) => (ImmutableList.isList(item) ? item.first() : item);

const collectCandidates = (statusIds, statuses, ownAccountId) => {
  const byAuthor = new Map();

  statusIds.forEach((id) => {
    const status = statuses.get(id);

    // Non-status markers (gaps, suggestions...) and unknown ids are never
    // part of a stack and keep their slot untouched.
    if (!status) {
      return;
    }

    // Reblogs are curation by a followed account; never fold them.
    if (status.get('reblog', null) !== null) {
      return;
    }

    const accountId = status.get('account');

    // Never fold the user's own posts.
    if (ownAccountId && accountId === ownAccountId) {
      return;
    }

    const time = Date.parse(status.get('created_at'));

    if (Number.isNaN(time)) {
      return;
    }

    const posts = byAuthor.get(accountId);

    if (posts) {
      posts.push({ id, time });
    } else {
      byAuthor.set(accountId, [{ id, time }]);
    }
  });

  return byAuthor;
};

// Session memory implementing "fold on entry only" — what the user has
// seen on screen is never taken away from them:
// - displaySlotByGroup: per author and clock bucket, the timeline slot the
//   stack is anchored at. Fixed once chosen, so a stack never re-seats.
// - stickyFlatIds: posts that have been rendered flat (below threshold at
//   the time). They stay flat for the whole session even if their author
//   later crosses the threshold — only never-rendered posts fold.
// Both reset on full page load: a fresh session folds everything cleanly.
const displaySlotByGroup = new Map();
const stickyFlatIds = new Set();

// Test-only helper: clears the fold-on-entry memory between test cases.
export const resetStackDisplayMemory = () => {
  displaySlotByGroup.clear();
  stickyFlatIds.clear();
};

const buildStacks = (byAuthor) => {
  const stackBySlot = new Map();
  const hidden = new Set();

  byAuthor.forEach((posts, accountId) => {
    const buckets = new Map();

    posts.forEach((post) => {
      const bucket = Math.floor(post.time / STACK_WINDOW_MS);
      const group = buckets.get(bucket);

      if (group) {
        group.push(post);
      } else {
        buckets.set(bucket, [post]);
      }
    });

    buckets.forEach((group, bucket) => {
      group.sort((a, b) => a.time - b.time);

      const groupKey = `${accountId}:${bucket}`;
      const remembered = displaySlotByGroup.get(groupKey);
      const memberIds = group.map((post) => post.id);

      // Below threshold and no stack yet: everything renders flat and is
      // locked flat for the session.
      if (group.length < STACK_MIN_SIZE && !remembered) {
        memberIds.forEach((id) => stickyFlatIds.add(id));
        return;
      }

      // Anchor: the remembered slot if still loaded; otherwise the oldest
      // member already on screen (it owns a stable slot); otherwise the
      // oldest member.
      const anchorId = (remembered && memberIds.includes(remembered) && remembered) ||
        memberIds.find((id) => stickyFlatIds.has(id)) ||
        memberIds[0];

      // Fold only members that have never been rendered; sticky-flat
      // siblings keep their place on screen.
      const folded = memberIds.filter((id) => id !== anchorId && !stickyFlatIds.has(id));

      if (folded.length === 0) {
        // Nothing foldable (all members already on screen): no stack
        // chrome, the anchor stays a plain flat post.
        stickyFlatIds.add(anchorId);
        return;
      }

      displaySlotByGroup.set(groupKey, anchorId);
      stackBySlot.set(anchorId, ImmutableList([anchorId, ...folded]));
      folded.forEach((id) => hidden.add(id));
    });
  });

  return { stackBySlot, hidden };
};

/**
 * Collapses prolific authors into "stacks": when an author has
 * STACK_MIN_SIZE or more posts within the same clock-aligned one-hour
 * bucket, one anchor keeps a slot in the timeline and the others fold
 * into it — but only on entry: a post that has already been rendered
 * flat is never folded afterwards (what the user saw stays). The
 * logged-in user's own posts and reblogs are never folded.
 *
 * Input and output are ImmutableLists in timeline order (newest first).
 * Each output item is either a status id, a non-status marker, or an
 * ImmutableList([anchorId, ...foldedIds ascending]) representing a stack
 * (the anchor is shown, the rest are hidden behind the expand button).
 * @param {import('immutable').List} statusIds - filtered timeline ids
 * @param {import('immutable').Map} statuses - state.get('statuses')
 * @param {string|null} ownAccountId - the logged-in user's account id
 * @returns {import('immutable').List}
 */
export const collapseIntoStacks = (statusIds, statuses, ownAccountId) => {
  const byAuthor = collectCandidates(statusIds, statuses, ownAccountId);
  const { stackBySlot, hidden } = buildStacks(byAuthor);

  // Fast path: nothing to fold, keep the input reference so pure
  // components skip re-rendering.
  if (stackBySlot.size === 0) {
    return statusIds;
  }

  return statusIds
    .filterNot((id) => hidden.has(id))
    .map((id) => stackBySlot.get(id) ?? id);
};
