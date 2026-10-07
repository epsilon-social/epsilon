// Epsilon — curated feed timelines (status ids per feed slug).
//
// The native `timelines` reducer merges pages by comparing snowflake ids
// (`expandNormalizedTimeline` / `compareId`), which silently re-sorts any
// timeline into chronological order. Curated feeds are ordered by curation
// rank — NOT chronologically — so their ids live in this sidecar slice
// instead, preserved exactly as the API returns them. Status entities still
// go through the native importer, so all status components work unchanged.
// Pagination cursors (curation `position`) come from the Link headers.

import { createSlice } from '@reduxjs/toolkit';

import { AxiosError } from 'axios';

import { importFetchedStatuses } from 'mastodon/actions/importer';
import api, { getLinks } from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import type { RootState } from 'mastodon/store';
import { createAppAsyncThunk } from 'mastodon/store/typed_functions';

interface EpsilonCuratedTimeline {
  statusIds: string[];
  isLoading: boolean;
  hasMore: boolean;
  nextMaxId: string | null;
  // Feed slug unknown to the server (404) — callers redirect away.
  notFound: boolean;
}

interface EpsilonCuratedTimelinesState {
  bySlug: Record<string, EpsilonCuratedTimeline>;
}

const initialState: EpsilonCuratedTimelinesState = {
  bySlug: {},
};

const emptyTimeline = (): EpsilonCuratedTimeline => ({
  statusIds: [],
  isLoading: false,
  hasMore: true,
  nextMaxId: null,
  notFound: false,
});

export const expandEpsilonCuratedTimeline = createAppAsyncThunk(
  'epsilon/curatedTimelines/expand',
  async (
    { slug, loadMore }: { slug: string; loadMore?: boolean },
    { dispatch, getState, rejectWithValue },
  ) => {
    const timeline = getState().epsilonCuratedTimelines.bySlug[slug];
    const params: Record<string, string> = {};

    if (loadMore && timeline?.nextMaxId) {
      params.max_id = timeline.nextMaxId;
    }

    try {
      const response = await api().get<ApiStatusJSON[]>(
        `/api/v1/epsilon/curated_feeds/${slug}/statuses`,
        { params },
      );

      const next = getLinks(response).refs.find((link) => link.rel === 'next');
      const nextMaxId = next
        ? new URL(next.uri).searchParams.get('max_id')
        : null;

      dispatch(importFetchedStatuses(response.data));

      return {
        statusIds: response.data.map((status) => status.id),
        nextMaxId,
        loadMore: !!loadMore,
      };
    } catch (error) {
      // The rejectValue shape is fixed app-wide; carry the HTTP status in
      // `error` so the reducer can tell a missing feed (404) apart.
      if (error instanceof AxiosError && error.response) {
        return rejectWithValue({
          skipAlert: true,
          error: error.response.status,
        });
      }

      throw error;
    }
  },
  {
    condition: ({ slug }, { getState }) => {
      const timeline = getState().epsilonCuratedTimelines.bySlug[slug];
      return !timeline?.isLoading && !timeline?.notFound;
    },
  },
);

const epsilonCuratedTimelinesSlice = createSlice({
  name: 'epsilonCuratedTimelines',
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(expandEpsilonCuratedTimeline.pending, (state, action) => {
        const timeline = (state.bySlug[action.meta.arg.slug] ??=
          emptyTimeline());
        timeline.isLoading = true;
      })
      .addCase(expandEpsilonCuratedTimeline.fulfilled, (state, action) => {
        const timeline = (state.bySlug[action.meta.arg.slug] ??=
          emptyTimeline());
        const { statusIds, nextMaxId, loadMore } = action.payload;

        if (loadMore) {
          const known = new Set(timeline.statusIds);
          timeline.statusIds = [
            ...timeline.statusIds,
            ...statusIds.filter((id) => !known.has(id)),
          ];
        } else {
          // Fresh first page: replace verbatim, in API (curation) order.
          timeline.statusIds = statusIds;
        }

        timeline.nextMaxId = nextMaxId;
        timeline.hasMore = nextMaxId !== null;
        timeline.isLoading = false;
      })
      .addCase(expandEpsilonCuratedTimeline.rejected, (state, action) => {
        const timeline = (state.bySlug[action.meta.arg.slug] ??=
          emptyTimeline());
        timeline.isLoading = false;
        // Fuse: never keep paginating into an erroring endpoint — without
        // this, StatusList retries "load more" in a tight 404/5xx loop.
        timeline.hasMore = false;
        timeline.notFound = action.payload?.error === 404;
      });
  },
});

export const selectEpsilonCuratedTimeline = (
  state: RootState,
  slug: string,
): EpsilonCuratedTimeline | undefined =>
  state.epsilonCuratedTimelines.bySlug[slug];

export const epsilonCuratedTimelines = epsilonCuratedTimelinesSlice.reducer;
