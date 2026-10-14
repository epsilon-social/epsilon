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

// Remembers, per author and clock bucket, which timeline slot the stack
// was first displayed at. Pagination loads ever older bucket members; the
// natural slot (oldest loaded member) would keep migrating down the list,
// visibly re-seating a stack the user may be looking at. Once seen, a
// stack keeps its slot and only grows. Resets on full page load.
const displaySlotByGroup = new Map();

// Test-only helper: clears the display-slot memory between test cases.
export const resetStackDisplayMemory = () => displaySlotByGroup.clear();

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

    // At most one visible slot per author per clock hour: the stack sits
    // at its remembered slot (or the oldest loaded member's slot the
    // first time), every other member folds into it.
    buckets.forEach((group, bucket) => {
      if (group.length < STACK_MIN_SIZE) {
        return;
      }

      group.sort((a, b) => a.time - b.time);

      const groupKey = `${accountId}:${bucket}`;
      const remembered = displaySlotByGroup.get(groupKey);
      const slotId = remembered && group.some((post) => post.id === remembered) ? remembered : group[0].id;

      displaySlotByGroup.set(groupKey, slotId);
      stackBySlot.set(slotId, ImmutableList(group.map((post) => post.id)));

      group.forEach((post) => {
        if (post.id !== slotId) {
          hidden.add(post.id);
        }
      });
    });
  });

  return { stackBySlot, hidden };
};

/**
 * Collapses prolific authors into "stacks": when an author has
 * STACK_MIN_SIZE or more posts within the same clock-aligned one-hour
 * bucket, only the oldest (the anchor) keeps its slot in the timeline and
 * the rest are folded into it. The logged-in user's own posts and reblogs
 * are never folded.
 *
 * Input and output are ImmutableLists in timeline order (newest first).
 * Each output item is either a status id, a non-status marker, or an
 * ImmutableList([anchorId, ...hiddenIds]) in ascending chronological
 * order representing a stack. Pure function of its arguments.
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
