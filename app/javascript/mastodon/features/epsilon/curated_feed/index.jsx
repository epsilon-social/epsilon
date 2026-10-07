// Epsilon — public page for the curated editorial feeds ("fils d'actu").
//
// `/discover` (default feed) and `/discover/:slug`. A parent feed AGGREGATES
// its children (anything published in a child shows in the parent too);
// tabs switch between the family's feeds. Publicly accessible (works
// logged-out, like /explore) — signed-in members get the same feeds as
// pills on the home column. The timeline body is the shared
// EpsilonCuratedTimeline (order preserved by the sidecar slice, never the
// native timelines reducer).

import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from '@unhead/react/helmet';
import { NavLink } from 'react-router-dom';

import BreakingNewsIcon from '@/material-icons/400-24px/breaking_news.svg?react';
import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';
import { fetchEpsilonCuratedFeeds, selectEpsilonCuratedFeedsWithContent } from 'mastodon/epsilon/store/curated_feeds_slice';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { categoryDisplayName } from '../category_names';

import { EpsilonCuratedTimeline } from './embedded_timeline';

export const EPSILON_DEFAULT_CURATED_SLUG = 'discover';

const messages = defineMessages({
  title: { id: 'epsilon_curated.column.title', defaultMessage: 'Discovery' },
});

const EpsilonCuratedFeedPage = ({ params, multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const columnRef = useRef(null);
  // Only feeds with published content get tabs; without an explicit slug,
  // land on the first non-empty feed (falls back to the default slug so the
  // page still renders — with its empty state — when everything is empty).
  const feeds = useAppSelector(selectEpsilonCuratedFeedsWithContent);
  const slug = params?.slug ?? feeds[0]?.slug ?? EPSILON_DEFAULT_CURATED_SLUG;

  useEffect(() => {
    dispatch(fetchEpsilonCuratedFeeds());
  }, [dispatch]);

  const handleHeaderClick = useCallback(() => columnRef.current?.scrollTop(), []);

  const currentFeed = feeds.find((feed) => feed.slug === slug);
  const title = currentFeed ? categoryDisplayName(intl, currentFeed) : intl.formatMessage(messages.title);

  return (
    <Column bindToDocument={!multiColumn} ref={columnRef} label={title}>
      <ColumnHeader
        icon='newspaper'
        iconComponent={BreakingNewsIcon}
        title={title}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      {feeds.length > 1 && (
        <div className='account__section-headline'>
          {feeds.map((feed) => (
            <NavLink key={feed.id} exact to={feed.slug === EPSILON_DEFAULT_CURATED_SLUG ? '/discover' : `/discover/${feed.slug}`}>
              <div>{categoryDisplayName(intl, feed)}</div>
            </NavLink>
          ))}
        </div>
      )}

      {/* Redirect only on an explicit unknown slug — never when showing the
          default feed, else an unseeded instance would redirect in a loop. */}
      <EpsilonCuratedTimeline slug={slug} bindToDocument={!multiColumn} notFoundRedirect={params?.slug ? '/discover' : undefined} />

      <Helmet>
        <title>{title}</title>
      </Helmet>
    </Column>
  );
};

EpsilonCuratedFeedPage.propTypes = {
  params: PropTypes.shape({
    slug: PropTypes.string,
  }),
  multiColumn: PropTypes.bool,
};

export default EpsilonCuratedFeedPage;
