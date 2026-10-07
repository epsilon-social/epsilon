// Regression guard: curated feeds are ordered by curation rank, NOT
// chronologically. The native `timelines` reducer re-sorts pages by
// snowflake id (which is why this sidecar slice exists) — these tests pin
// down that our slice preserves the API order verbatim.

import {
  epsilonCuratedTimelines,
  expandEpsilonCuratedTimeline,
} from '../curated_timelines_slice';

const initial = { bySlug: {} };

const fulfilled = (
  slug: string,
  payload: { statusIds: string[]; nextMaxId: string | null; loadMore: boolean },
) => ({
  type: expandEpsilonCuratedTimeline.fulfilled.type,
  meta: { arg: { slug } },
  payload,
});

describe('epsilonCuratedTimelines', () => {
  it('preserves the API (curation) order verbatim, even when ids are not chronological', () => {
    // Deliberately NOT sorted by id: curated order ≠ snowflake order.
    const curatedOrder = ['30', '10', '20'];

    const state = epsilonCuratedTimelines(
      initial,
      fulfilled('decouverte', {
        statusIds: curatedOrder,
        nextMaxId: '7',
        loadMore: false,
      }),
    );

    expect(state.bySlug.decouverte?.statusIds).toEqual(curatedOrder);
    expect(state.bySlug.decouverte?.hasMore).toBe(true);
    expect(state.bySlug.decouverte?.nextMaxId).toBe('7');
  });

  it('replaces the list on a fresh first page (no id-based merging)', () => {
    let state = epsilonCuratedTimelines(
      initial,
      fulfilled('decouverte', {
        statusIds: ['1', '2'],
        nextMaxId: null,
        loadMore: false,
      }),
    );

    state = epsilonCuratedTimelines(
      state,
      fulfilled('decouverte', {
        statusIds: ['9', '2', '5'],
        nextMaxId: null,
        loadMore: false,
      }),
    );

    expect(state.bySlug.decouverte?.statusIds).toEqual(['9', '2', '5']);
  });

  it('appends older pages at the end, deduplicated, keeping each page order', () => {
    let state = epsilonCuratedTimelines(
      initial,
      fulfilled('monde', {
        statusIds: ['50', '10', '40'],
        nextMaxId: '3',
        loadMore: false,
      }),
    );

    state = epsilonCuratedTimelines(
      state,
      fulfilled('monde', {
        statusIds: ['40', '90', '20'],
        nextMaxId: null,
        loadMore: true,
      }),
    );

    expect(state.bySlug.monde?.statusIds).toEqual([
      '50',
      '10',
      '40',
      '90',
      '20',
    ]);
    expect(state.bySlug.monde?.hasMore).toBe(false);
  });

  it('keeps feeds independent per slug', () => {
    let state = epsilonCuratedTimelines(
      initial,
      fulfilled('decouverte', {
        statusIds: ['1'],
        nextMaxId: null,
        loadMore: false,
      }),
    );

    state = epsilonCuratedTimelines(
      state,
      fulfilled('monde', {
        statusIds: ['2'],
        nextMaxId: null,
        loadMore: false,
      }),
    );

    expect(state.bySlug.decouverte?.statusIds).toEqual(['1']);
    expect(state.bySlug.monde?.statusIds).toEqual(['2']);
  });
});
