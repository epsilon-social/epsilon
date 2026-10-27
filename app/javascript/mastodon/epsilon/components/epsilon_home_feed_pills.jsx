// Epsilon — curated feed pills on top of the home column.
//
// [Home | Découverte | Monde | …] — data-driven from the published feeds
// list, so a feed created in the admin shows up without a deploy. Rendered
// by EpsilonLayout above the inline compose; the active pill swaps the home
// column body (route /home/:slug). The bar reuses the themed
// .account__section-headline pills — same gradient active state as the
// Explore tabs.

import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
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

  const barRef = useRef(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = barRef.current;

    if (!el) {
      return;
    }

    const maxScroll = el.scrollWidth - el.clientWidth;
    setFadeLeft(el.scrollLeft > 2);
    setFadeRight(el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    dispatch(fetchEpsilonCuratedFeeds());
  }, [dispatch]);

  useEffect(() => {
    const el = barRef.current;

    if (!el) {
      return undefined;
    }

    updateFades();
    const observer = new ResizeObserver(updateFades);
    observer.observe(el);
    el.addEventListener('scroll', updateFades, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateFades);
    };
  }, [updateFades, feeds]);

  if (feeds.length === 0) {
    return null;
  }

  return (
    <div
      ref={barRef}
      className={classNames('account__section-headline epsilon-home-pills', {
        'epsilon-home-pills--fade-left': fadeLeft,
        'epsilon-home-pills--fade-right': fadeRight,
      })}
    >
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
