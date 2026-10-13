// Epsilon — curated feed pills on top of the home column.
//
// [Home | Découverte | Monde | …] — data-driven from the published feeds
// list, so a feed created in the admin shows up without a deploy. Rendered
// by EpsilonLayout above the inline compose; the active pill swaps the home
// column body (route /home/:slug). The bar reuses the themed
// .account__section-headline pills — same gradient active state as the
// Explore tabs.

import { useEffect } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { NavLink } from 'react-router-dom';

import { fetchEpsilonCuratedFeeds, selectEpsilonCuratedFeedsWithContent } from 'mastodon/epsilon/store/curated_feeds_slice';
import { categoryDisplayName } from 'mastodon/features/epsilon/category_names';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  home: { id: 'tabs_bar.home', defaultMessage: 'Home' },
});

export const EpsilonHomeFeedPills = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  // Feeds with published content only — an empty feed never gets a pill,
  // and with zero non-empty feeds the whole bar disappears.
  const feeds = useAppSelector(selectEpsilonCuratedFeedsWithContent);

  useEffect(() => {
    dispatch(fetchEpsilonCuratedFeeds());
  }, [dispatch]);

  if (feeds.length === 0) {
    return null;
  }

  return (
    <div className='account__section-headline epsilon-home-pills'>
      <NavLink exact to='/home'>
        {intl.formatMessage(messages.home)}
      </NavLink>

      {feeds.map((feed) => (
        <NavLink key={feed.id} exact to={`/home/${feed.slug}`}>
          {categoryDisplayName(intl, feed)}
          {/* Non-live feed: the API only serves it to staff curators. */}
          {feed.state === 'draft' && (
            <span className='epsilon-curated-feed-badge'>
              <FormattedMessage id='epsilon_curated.feed_state_badge' defaultMessage='Draft' />
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
};
