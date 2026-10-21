import { fromJS, List as ImmutableList, Map as ImmutableMap } from 'immutable';

import {
  collapseIntoStacks,
  resetStackDisplayMemory,
  stackAnchorId,
  STACK_MIN_SIZE,
  STACK_WINDOW_MS,
} from '../status_stacks';

beforeEach(resetStackDisplayMemory);

const BASE_TIME = Date.parse('2026-01-01T12:00:00.000Z');

// The logged-in user's account id, passed as ownAccountId
const ME = 'me1';

// Builds a status map entry; minutes is the offset from BASE_TIME.
const status = (accountId, minutes, extra = {}) =>
  ImmutableMap({
    account: accountId,
    created_at: new Date(BASE_TIME + minutes * 60 * 1000).toISOString(),
    reblog: null,
    ...extra,
  });

// Timeline lists are newest first; ids are declared oldest first here and
// reversed, so tests read chronologically.
const timeline = (ids) => ImmutableList(ids).reverse();

describe('collapseIntoStacks', () => {
  test('keeps the input reference when no author reaches the threshold', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10),
      c: status('remote2', 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    expect(collapseIntoStacks(ids, statuses, ME)).toBe(ids);
  });

  test('folds posts of a prolific remote author into a stack at the oldest slot', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10),
      c: status('remote1', 20),
      x: status('remote2', 15),
    });
    const ids = timeline(['a', 'x', 'b', 'c']);

    const result = collapseIntoStacks(ids, statuses, ME);

    expect(result.toJS()).toEqual(['x', ['a', 'b', 'c']]);
  });

  test('exposes the configured threshold and window', () => {
    expect(STACK_MIN_SIZE).toBe(3);
    expect(STACK_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  test('splits groups on clock-hour boundaries (fixed buckets)', () => {
    // 12:00 and 12:30 share the 12:00-13:00 bucket; 13:00 opens the next one
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 30),
      c: status('remote1', 60),
    });
    const ids = timeline(['a', 'b', 'c']);

    // 2 + 1 posts: no bucket reaches the threshold
    expect(collapseIntoStacks(ids, statuses, ME)).toBe(ids);
  });

  test('stacks each hour bucket independently', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 20),
      c: status('remote1', 40),
      d: status('remote1', 70),
      e: status('remote1', 80),
    });
    const ids = timeline(['a', 'b', 'c', 'd', 'e']);

    const result = collapseIntoStacks(ids, statuses, ME);

    // d and e are in the 13:00-14:00 bucket and only two: they stay unfolded.
    expect(result.toJS()).toEqual(['e', 'd', ['a', 'b', 'c']]);
  });

  test('grouping is stable when older posts of the same bucket load later', () => {
    const base = {
      b: status('remote1', 10),
      c: status('remote1', 20),
      d: status('remote1', 30),
      x: status('remote2', 25),
    };
    const firstPage = collapseIntoStacks(timeline(['b', 'c', 'd', 'x']), fromJS({}).merge(base), ME);

    // An OLDER post (a) of the same bucket arrives via pagination: existing
    // members keep their membership, the stack only grows (anchor first,
    // then folded members in chronological order).
    const statuses = fromJS({}).merge(base, { a: status('remote1', 5) });
    const secondPage = collapseIntoStacks(timeline(['a', 'b', 'c', 'd', 'x']), statuses, ME);

    expect(firstPage.toJS()).toEqual(['x', ['b', 'c', 'd']]);
    expect(secondPage.toJS()).toEqual(['x', ['b', 'a', 'c', 'd']]);
    // The newest member (stable React key) is unchanged
    expect(firstPage.last().last()).toBe(secondPage.last().last());
  });

  test('never folds a post that was already rendered flat (fold on entry only)', () => {
    const base = {
      a: status('remote1', 0),
      b: status('remote1', 10),
    };

    // First render: two posts, below threshold -> flat (and locked flat)
    const firstIds = timeline(['a', 'b']);
    expect(collapseIntoStacks(firstIds, fromJS({}).merge(base), ME)).toBe(firstIds);

    // The 3rd post of the bucket arrives: only IT folds — under the oldest
    // already-visible post (which becomes the anchor); b stays flat.
    const withC = fromJS({}).merge(base, { c: status('remote1', 20) });
    const second = collapseIntoStacks(timeline(['a', 'b', 'c']), withC, ME);

    expect(second.toJS()).toEqual(['b', ['a', 'c']]);

    // More spam keeps folding into the same anchor; b still never folds.
    const withD = fromJS({}).merge(base, { c: status('remote1', 20), d: status('remote1', 30) });
    const third = collapseIntoStacks(timeline(['a', 'b', 'c', 'd']), withD, ME);

    expect(third.toJS()).toEqual(['b', ['a', 'c', 'd']]);
  });

  test('a displayed stack keeps its slot when older bucket members load', () => {
    const base = {
      b: status('remote1', 10),
      c: status('remote1', 20),
      d: status('remote1', 30),
      f: status('remote2', 8),
    };
    const firstPage = collapseIntoStacks(timeline(['f', 'b', 'c', 'd']), fromJS({}).merge(base), ME);

    // Stack displayed at b's slot (oldest loaded), above the older filler f
    expect(firstPage.toJS()).toEqual([['b', 'c', 'd'], 'f']);

    // An older member (a, minute 5) loads below f: the stack must NOT
    // migrate below f — it stays at its remembered slot and absorbs a.
    const statuses = fromJS({}).merge(base, { a: status('remote1', 5) });
    const secondPage = collapseIntoStacks(timeline(['a', 'f', 'b', 'c', 'd']), statuses, ME);

    expect(secondPage.toJS()).toEqual([['b', 'a', 'c', 'd'], 'f']);
  });

  test('stacks local authors too', () => {
    const statuses = ImmutableMap({
      a: status('local1', 0),
      b: status('local1', 10),
      c: status('local1', 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    const result = collapseIntoStacks(ids, statuses, ME);

    expect(result.toJS()).toEqual([['a', 'b', 'c']]);
  });

  test('never folds the logged-in user own posts', () => {
    const statuses = ImmutableMap({
      a: status(ME, 0),
      b: status(ME, 10),
      c: status(ME, 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    expect(collapseIntoStacks(ids, statuses, ME)).toBe(ids);
  });

  test('ignores reblogs', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10, { reblog: 'some-status' }),
      c: status('remote1', 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    expect(collapseIntoStacks(ids, statuses, ME)).toBe(ids);
  });

  test('ignores statuses with an unparsable created_at', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10).set('created_at', 'not-a-date'),
      c: status('remote1', 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    expect(collapseIntoStacks(ids, statuses, ME)).toBe(ids);
  });

  test('keeps non-status markers in place', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10),
      c: status('remote1', 20),
    });
    const ids = ImmutableList(['c', 'b', null, 'inline-follow-suggestions', 'a']);

    const result = collapseIntoStacks(ids, statuses, ME);

    expect(result.toJS()).toEqual([null, 'inline-follow-suggestions', ['a', 'b', 'c']]);
  });

  test('stacks several authors independently', () => {
    const statuses = ImmutableMap({
      a1: status('remote1', 0),
      a2: status('remote1', 5),
      a3: status('remote1', 10),
      b1: status('remote2', 2),
      b2: status('remote2', 6),
      b3: status('remote2', 12),
    });
    const ids = timeline(['a1', 'b1', 'a2', 'b2', 'a3', 'b3']);

    const result = collapseIntoStacks(ids, statuses, ME);

    expect(result.toJS()).toEqual([
      ['b1', 'b2', 'b3'],
      ['a1', 'a2', 'a3'],
    ]);
  });
});

describe('stackAnchorId', () => {
  test('unwraps a stack to its anchor id', () => {
    expect(stackAnchorId(ImmutableList(['a', 'b', 'c']))).toBe('a');
  });

  test('returns plain items unchanged', () => {
    expect(stackAnchorId('a')).toBe('a');
    expect(stackAnchorId(null)).toBeNull();
  });
});
