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

const collectCandidates = (statusIds, statuses, accounts) => {
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
    const acct = accounts.getIn([accountId, 'acct'], '');

    // Local authors (no domain part) are never stacked.
    if (!acct.includes('@')) {
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

const buildStacks = (byAuthor) => {
  const stackByAnchor = new Map();
  const hidden = new Set();

  byAuthor.forEach((posts) => {
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

    // At most one visible slot per author per clock hour: the oldest post
    // of the bucket keeps its place, the rest fold into it.
    buckets.forEach((group) => {
      if (group.length < STACK_MIN_SIZE) {
        return;
      }

      group.sort((a, b) => a.time - b.time);

      stackByAnchor.set(group[0].id, ImmutableList(group.map((post) => post.id)));

      group.slice(1).forEach((post) => hidden.add(post.id));
    });
  });

  return { stackByAnchor, hidden };
};

/**
 * Collapses prolific remote authors into "stacks": when an author has
 * STACK_MIN_SIZE or more posts within the same clock-aligned one-hour
 * bucket, only the oldest (the anchor) keeps its slot in the timeline and
 * the rest are folded into it.
 *
 * Input and output are ImmutableLists in timeline order (newest first).
 * Each output item is either a status id, a non-status marker, or an
 * ImmutableList([anchorId, ...hiddenIds]) in ascending chronological
 * order representing a stack. Pure function of its arguments.
 * @param {import('immutable').List} statusIds - filtered timeline ids
 * @param {import('immutable').Map} statuses - state.get('statuses')
 * @param {import('immutable').Map} accounts - state.get('accounts')
 * @returns {import('immutable').List}
 */
export const collapseIntoStacks = (statusIds, statuses, accounts) => {
  const byAuthor = collectCandidates(statusIds, statuses, accounts);
  const { stackByAnchor, hidden } = buildStacks(byAuthor);

  // Fast path: nothing to fold, keep the input reference so pure
  // components skip re-rendering.
  if (stackByAnchor.size === 0) {
    return statusIds;
  }

  return statusIds
    .filterNot((id) => hidden.has(id))
    .map((id) => stackByAnchor.get(id) ?? id);
};
