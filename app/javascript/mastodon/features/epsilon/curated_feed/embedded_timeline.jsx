// Epsilon — reusable curated-feed timeline body.
//
// Slice-backed, order-preserving status list for a curated feed. Used by the
// public /discover page AND embedded in the home column behind the feed
// pills. Never wire this to the native `timelines` reducer — it re-sorts
// pages chronologically (see curated_timelines_slice).

import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo } from 'react';

import { FormattedMessage } from 'react-intl';

import { List as ImmutableList } from 'immutable';
import { Redirect } from 'react-router-dom';

import StatusList from 'mastodon/components/status_list';
import { expandEpsilonCuratedTimeline, selectEpsilonCuratedTimeline } from 'mastodon/epsilon/store/curated_timelines_slice';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

export const EpsilonCuratedTimeline = ({ slug, bindToDocument, scrollKeyPrefix = 'epsilon_curated_feed', notFoundRedirect }) => {
  const dispatch = useAppDispatch();
  const timeline = useAppSelector((state) => selectEpsilonCuratedTimeline(state, slug));
  const statusIds = useMemo(() => ImmutableList(timeline?.statusIds ?? []), [timeline?.statusIds]);

  useEffect(() => {
    dispatch(expandEpsilonCuratedTimeline({ slug }));
  }, [dispatch, slug]);

  const handleLoadMore = useCallback(() => {
    dispatch(expandEpsilonCuratedTimeline({ slug, loadMore: true }));
  }, [dispatch, slug]);

  // Unknown feed slug (stale URL, renamed/deleted feed): leave the dead page
  // instead of showing a misleading empty state.
  if (timeline?.notFound && notFoundRedirect) {
    return <Redirect to={notFoundRedirect} />;
  }

  return (
    <StatusList
      statusIds={statusIds}
      isLoading={timeline?.isLoading ?? true}
      hasMore={timeline?.hasMore ?? true}
      onLoadMore={handleLoadMore}
      trackScroll
      scrollKey={`${scrollKeyPrefix}-${slug}`}
      emptyMessage={<FormattedMessage id='epsilon_curated.empty' defaultMessage='Nothing here yet. Posts selected by our editorial team will appear here soon.' />}
      bindToDocument={bindToDocument}
    />
  );
};

EpsilonCuratedTimeline.propTypes = {
  slug: PropTypes.string.isRequired,
  bindToDocument: PropTypes.bool,
  scrollKeyPrefix: PropTypes.string,
  notFoundRedirect: PropTypes.string,
};
