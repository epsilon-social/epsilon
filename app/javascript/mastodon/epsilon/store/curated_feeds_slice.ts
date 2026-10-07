// Epsilon — curated editorial feeds ("fils d'actu").
//
// Small RTK slice holding the published feeds list (hierarchy included),
// fetched once per session. Used by the sidebar, the public /discover page,
// the staff curation studio and the add-to-feed picker modal.

import { createSlice } from '@reduxjs/toolkit';

import { apiRequestGet } from 'mastodon/api';
import type { RootState } from 'mastodon/store';
import {
  createAppAsyncThunk,
  createAppSelector,
} from 'mastodon/store/typed_functions';

export interface ApiEpsilonCuratedFeed {
  id: string;
  slug: string;
  name: string;
  name_translations: Record<string, string>;
  description_translations: Record<string, string>;
  icon: string | null;
  starts_at: string | null;
  ends_at: string | null;
  statuses_count: number;
  children?: ApiEpsilonCuratedFeed[];
}

type QueryStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EpsilonCuratedFeedsState {
  feeds: ApiEpsilonCuratedFeed[];
  status: QueryStatus;
}

const initialState: EpsilonCuratedFeedsState = {
  feeds: [],
  status: 'idle',
};

export const fetchEpsilonCuratedFeeds = createAppAsyncThunk(
  'epsilon/curatedFeeds/fetch',
  () => apiRequestGet<ApiEpsilonCuratedFeed[]>('v1/epsilon/curated_feeds'),
  {
    condition: (_arg, { getState }) =>
      getState().epsilonCuratedFeeds.status === 'idle',
  },
);

const epsilonCuratedFeedsSlice = createSlice({
  name: 'epsilonCuratedFeeds',
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(fetchEpsilonCuratedFeeds.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEpsilonCuratedFeeds.fulfilled, (state, action) => {
        state.feeds = action.payload;
        state.status = 'ready';
      })
      .addCase(fetchEpsilonCuratedFeeds.rejected, (state) => {
        state.status = 'error';
      });
  },
});

export const selectEpsilonCuratedFeeds = (state: RootState) =>
  state.epsilonCuratedFeeds.feeds;

// Parents and children flattened in display order (parent first, then its
// children) — the shape used by the picker and the studio boards (staff
// tools must see EMPTY feeds too, to put the first post in).
export const selectEpsilonCuratedFeedsFlat = createAppSelector(
  [selectEpsilonCuratedFeeds],
  (feeds) => feeds.flatMap((feed) => [feed, ...(feed.children ?? [])]),
);

// Public surfaces (home pills, /discover tabs): feeds with something to
// show. An empty feed is never displayed to members/visitors. A parent
// aggregates its children, so it counts as non-empty as soon as any child
// has published content.
export const selectEpsilonCuratedFeedsWithContent = createAppSelector(
  [selectEpsilonCuratedFeeds],
  (feeds) =>
    feeds.flatMap((feed) => {
      const children = (feed.children ?? []).filter(
        (child) => child.statuses_count > 0,
      );
      const aggregated =
        feed.statuses_count +
        (feed.children ?? []).reduce(
          (sum, child) => sum + child.statuses_count,
          0,
        );

      return [...(aggregated > 0 ? [feed] : []), ...children];
    }),
);

export const epsilonCuratedFeeds = epsilonCuratedFeedsSlice.reducer;
