import { fromJS, List as ImmutableList, Map as ImmutableMap } from 'immutable';

import {
  collapseIntoStacks,
  stackAnchorId,
  STACK_MIN_SIZE,
  STACK_WINDOW_MS,
} from '../status_stacks';

const BASE_TIME = Date.parse('2026-01-01T12:00:00.000Z');

const accounts = fromJS({
  remote1: { acct: 'spammer@remote.example' },
  remote2: { acct: 'other@remote.example' },
  local1: { acct: 'alice' },
});

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

    expect(collapseIntoStacks(ids, statuses, accounts)).toBe(ids);
  });

  test('folds posts of a prolific remote author into a stack at the oldest slot', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10),
      c: status('remote1', 20),
      x: status('remote2', 15),
    });
    const ids = timeline(['a', 'x', 'b', 'c']);

    const result = collapseIntoStacks(ids, statuses, accounts);

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
    expect(collapseIntoStacks(ids, statuses, accounts)).toBe(ids);
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

    const result = collapseIntoStacks(ids, statuses, accounts);

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
    const firstPage = collapseIntoStacks(timeline(['b', 'c', 'd', 'x']), fromJS({}).merge(base), accounts);

    // An OLDER post (a) of the same bucket arrives via pagination: existing
    // members keep their membership, the stack only extends downwards.
    const statuses = fromJS({}).merge(base, { a: status('remote1', 5) });
    const secondPage = collapseIntoStacks(timeline(['a', 'b', 'c', 'd', 'x']), statuses, accounts);

    expect(firstPage.toJS()).toEqual(['x', ['b', 'c', 'd']]);
    expect(secondPage.toJS()).toEqual(['x', ['a', 'b', 'c', 'd']]);
    // The newest member (stable React key) is unchanged
    expect(firstPage.last().last()).toBe(secondPage.last().last());
  });

  test('never stacks local authors', () => {
    const statuses = ImmutableMap({
      a: status('local1', 0),
      b: status('local1', 10),
      c: status('local1', 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    expect(collapseIntoStacks(ids, statuses, accounts)).toBe(ids);
  });

  test('ignores reblogs', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10, { reblog: 'some-status' }),
      c: status('remote1', 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    expect(collapseIntoStacks(ids, statuses, accounts)).toBe(ids);
  });

  test('ignores statuses with an unparsable created_at', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10).set('created_at', 'not-a-date'),
      c: status('remote1', 20),
    });
    const ids = timeline(['a', 'b', 'c']);

    expect(collapseIntoStacks(ids, statuses, accounts)).toBe(ids);
  });

  test('keeps non-status markers in place', () => {
    const statuses = ImmutableMap({
      a: status('remote1', 0),
      b: status('remote1', 10),
      c: status('remote1', 20),
    });
    const ids = ImmutableList(['c', 'b', null, 'inline-follow-suggestions', 'a']);

    const result = collapseIntoStacks(ids, statuses, accounts);

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

    const result = collapseIntoStacks(ids, statuses, accounts);

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
