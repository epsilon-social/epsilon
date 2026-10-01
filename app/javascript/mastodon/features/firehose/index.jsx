import PropTypes from 'prop-types';
import { useRef, useCallback, useEffect, useMemo } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import { Helmet } from '@unhead/react/helmet';
import classNames from 'classnames';
// EPSILON : MODERATION CATEGORY FEED FILTER
import { List as ImmutableList } from 'immutable';
import { NavLink } from 'react-router-dom';

import { useIdentity } from '@/mastodon/identity_context';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
// EPSILON : MODERATION LIVE FEED FILTER
import ShieldIcon from '@/material-icons/400-24px/shield.svg?react';
import { addColumn } from 'mastodon/actions/columns';
import { changeSetting } from 'mastodon/actions/settings';
import { connectPublicStream, connectCommunityStream } from 'mastodon/actions/streaming';
import { expandPublicTimeline, expandCommunityTimeline } from 'mastodon/actions/timelines';
import { DismissableBanner } from 'mastodon/components/dismissable_banner';
// EPSILON : MODERATION LIVE FEED FILTER — sidecar actions (native action files untouched)
import { expandModerationFeed, connectModerationFeedStream, moderationTimelineId } from 'mastodon/epsilon/actions/moderation_feed';
// EPSILON : MODERATION CATEGORY FEED FILTER — sidecar category pills
import { ModerationCategoryFilter } from 'mastodon/epsilon/components/moderation_category_filter';
import { localLiveFeedAccess, remoteLiveFeedAccess, domain } from 'mastodon/initial_state';
import { canViewFeed, canManageReports } from 'mastodon/permissions';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import Column from '../../components/column';
import ColumnHeader from '../../components/column_header';
import SettingToggle from '../notifications/components/setting_toggle';
import StatusListContainer from '../ui/containers/status_list_container';

const messages = defineMessages({
  title: { id: 'column.firehose', defaultMessage: 'Live feeds' },
  title_local: {
    id: 'column.firehose_local',
    defaultMessage: 'Live feed for this server',
  },
  title_singular: {
    id: 'column.firehose_singular',
    defaultMessage: 'Live feed',
  },
  // EPSILON : MODERATION LIVE FEED FILTER
  mediaOnly: { id: 'community.column_settings.media_only', defaultMessage: 'Media only' },
  filterToggle: { id: 'firehose.moderation_filter.toggle', defaultMessage: 'Content to moderate' },
  filterMedia: { id: 'firehose.moderation_filter.media', defaultMessage: 'Sensitive media' },
  filterCw: { id: 'firehose.moderation_filter.cw', defaultMessage: 'Content warnings' },
  filterAll: { id: 'firehose.moderation_filter.all', defaultMessage: 'Both' },
  // EPSILON : MODERATION CATEGORY FEED FILTER
  filterCategories: { id: 'firehose.moderation_filter.categories', defaultMessage: 'Categories' },
  // EPSILON : LIVE FEED RENAME
  epsilonTitle: { id: 'epsilon.firehose.title', defaultMessage: 'Epsilon feed' },
});

// EPSILON : MODERATION CATEGORY FEED FILTER — stable default for the selector
const emptyCategoryIds = ImmutableList();

// EPSILON : MODERATION LIVE FEED FILTER — segmented scope choices (default 'all')
const SENSITIVE_SCOPES = [
  { value: 'media', message: messages.filterMedia },
  { value: 'cw', message: messages.filterCw },
  { value: 'all', message: messages.filterAll },
];

const ColumnSettings = () => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.getIn(['settings', 'firehose']));
  const onChange = useCallback(
    (key, checked) => dispatch(changeSetting(['firehose', ...key], checked)),
    [dispatch],
  );

  return (
    <div className='column-settings'>
      <section>
        <div className='column-settings__row'>
          <SettingToggle
            settings={settings}
            settingPath={['onlyMedia']}
            onChange={onChange}
            label={<FormattedMessage id='community.column_settings.media_only' defaultMessage='Media only' />}
          />
        </div>
      </section>
    </div>
  );
};

const Firehose = ({ feedType, multiColumn }) => {
  const dispatch = useAppDispatch();
  const intl = useIntl();
  const { signedIn, permissions } = useIdentity();
  const columnRef = useRef(null);

  const onlyMedia = useAppSelector((state) => state.getIn(['settings', 'firehose', 'onlyMedia'], false));
  // EPSILON : MODERATION LIVE FEED FILTER — settings only honored for moderators
  const onlySensitiveSetting = useAppSelector((state) => state.getIn(['settings', 'firehose', 'onlySensitive'], false));
  const sensitiveScope = useAppSelector((state) => state.getIn(['settings', 'firehose', 'sensitiveScope'], 'all'));
  const onlySensitive = canManageReports(permissions) && onlySensitiveSetting;
  // EPSILON : MODERATION CATEGORY FEED FILTER — settings only honored for moderators
  const categoriesEnabledSetting = useAppSelector((state) => state.getIn(['settings', 'firehose', 'categoriesEnabled'], false));
  const categoryIdsSetting = useAppSelector((state) => state.getIn(['settings', 'firehose', 'categoryIds'], emptyCategoryIds));
  const categoriesEnabled = canManageReports(permissions) && categoriesEnabledSetting;
  const activeCategoryIds = useMemo(
    () => (categoriesEnabled ? categoryIdsSetting.toJS().map(Number).sort((a, b) => a - b) : []),
    [categoriesEnabled, categoryIdsSetting],
  );
  const moderationActive = onlySensitive || activeCategoryIds.length > 0;
  const moderationScope = onlySensitive ? sensitiveScope : null;
  const timelineId = moderationActive
    ? moderationTimelineId(feedType, onlyMedia, moderationScope, activeCategoryIds)
    : `${feedType}${onlyMedia ? ':media' : ''}`;
  const hasUnread = useAppSelector((state) => state.getIn(['timelines', timelineId, 'unread'], 0) > 0);

  const handlePin = useCallback(
    () => {
      switch(feedType) {
      case 'community':
        dispatch(addColumn('COMMUNITY', { other: { onlyMedia } }));
        break;
      case 'public':
        dispatch(addColumn('PUBLIC', { other: { onlyMedia } }));
        break;
      case 'public:remote':
        dispatch(addColumn('REMOTE', { other: { onlyMedia, onlyRemote: true } }));
        break;
      }
    },
    [dispatch, onlyMedia, feedType],
  );

  const handleLoadMore = useCallback(
    (maxId) => {
      // EPSILON : MODERATION LIVE FEED FILTER — route to the sidecar feed when active
      if (moderationActive) {
        dispatch(expandModerationFeed({ feedType, maxId, onlyMedia, scope: moderationScope, categoryIds: activeCategoryIds }));
        return;
      }

      switch(feedType) {
      case 'community':
        dispatch(expandCommunityTimeline({ maxId, onlyMedia }));
        break;
      case 'public':
        dispatch(expandPublicTimeline({ maxId, onlyMedia }));
        break;
      case 'public:remote':
        dispatch(expandPublicTimeline({ maxId, onlyMedia, onlyRemote: true }));
        break;
      }
    },
    [dispatch, onlyMedia, moderationActive, moderationScope, activeCategoryIds, feedType],
  );

  const handleHeaderClick = useCallback(() => columnRef.current?.scrollTop(), []);

  // EPSILON : MODERATION LIVE FEED FILTER — toggle the moderator filter on/off
  const handleToggleSensitive = useCallback(
    () => dispatch(changeSetting(['firehose', 'onlySensitive'], !onlySensitive)),
    [dispatch, onlySensitive],
  );

  // EPSILON : MODERATION LIVE FEED FILTER — pick which content to surface (data-scope avoids inline binds)
  const handleScopeChange = useCallback(
    (e) => dispatch(changeSetting(['firehose', 'sensitiveScope'], e.currentTarget.dataset.scope)),
    [dispatch],
  );

  // EPSILON : MODERATION CATEGORY FEED FILTER — toggle the category filter on/off
  const handleToggleCategories = useCallback(
    () => dispatch(changeSetting(['firehose', 'categoriesEnabled'], !categoriesEnabled)),
    [dispatch, categoriesEnabled],
  );

  // EPSILON : MODERATION CATEGORY FEED FILTER — add/remove a category from the selection
  const handleCategoryToggle = useCallback(
    (categoryId) => {
      const next = categoryIdsSetting.includes(categoryId)
        ? categoryIdsSetting.filterNot((id) => id === categoryId)
        : categoryIdsSetting.push(categoryId);

      dispatch(changeSetting(['firehose', 'categoryIds'], next));
    },
    [dispatch, categoryIdsSetting],
  );

  // EPSILON : MODERATION CATEGORY FEED FILTER — "All" pill: select every
  // category, or clear the selection when everything is already selected
  const handleCategoryToggleAll = useCallback(
    (allIds) => {
      const allSelected = allIds.every((id) => categoryIdsSetting.includes(id));

      dispatch(changeSetting(['firehose', 'categoryIds'], allSelected ? emptyCategoryIds : ImmutableList(allIds)));
    },
    [dispatch, categoryIdsSetting],
  );

  // EPSILON : re-exposed native "Media only" toggle (its column-header control is hidden by the redesign)
  const handleToggleMedia = useCallback(
    () => dispatch(changeSetting(['firehose', 'onlyMedia'], !onlyMedia)),
    [dispatch, onlyMedia],
  );

  useEffect(() => {
    let disconnect;

    // EPSILON : MODERATION LIVE FEED FILTER — route to the sidecar feed when active.
    // With categories selected there is no live stream (categorization runs
    // async after a post is created, so streamed payloads cannot be filtered
    // by category client-side): the feed is load-on-demand instead.
    if (moderationActive) {
      dispatch(expandModerationFeed({ feedType, onlyMedia, scope: moderationScope, categoryIds: activeCategoryIds }));
      if (signedIn && activeCategoryIds.length === 0) {
        disconnect = dispatch(connectModerationFeedStream({ feedType, onlyMedia, scope: moderationScope }));
      }

      return () => disconnect?.();
    }

    switch(feedType) {
    case 'community':
      dispatch(expandCommunityTimeline({ onlyMedia }));
      if (signedIn) {
        disconnect = dispatch(connectCommunityStream({ onlyMedia }));
      }
      break;
    case 'public':
      dispatch(expandPublicTimeline({ onlyMedia }));
      if (signedIn) {
        disconnect = dispatch(connectPublicStream({ onlyMedia }));
      }
      break;
    case 'public:remote':
      dispatch(expandPublicTimeline({ onlyMedia, onlyRemote: true }));
      if (signedIn) {
        disconnect = dispatch(connectPublicStream({ onlyMedia, onlyRemote: true }));
      }
      break;
    }

    return () => disconnect?.();
  }, [dispatch, signedIn, feedType, onlyMedia, moderationActive, moderationScope, activeCategoryIds]);

  const prependBanner = feedType === 'community' ? (
    <DismissableBanner id='community_timeline'>
      <FormattedMessage
        id='dismissable_banner.community_timeline'
        defaultMessage='These are the most recent public posts from people whose accounts are hosted by {domain}.'
        values={{ domain }}
      />
    </DismissableBanner>
  ) : (
    <DismissableBanner id='public_timeline'>
      <FormattedMessage
        id='dismissable_banner.public_timeline'
        defaultMessage='These are the most recent public posts from people on the fediverse that people on {domain} follow.'
        values={{ domain }}
      />
    </DismissableBanner>
  );

  const emptyMessage = feedType === 'community' ? (
    <FormattedMessage
      id='empty_column.community'
      defaultMessage='The local timeline is empty. Write something publicly to get the ball rolling!'
    />
  ) : (
    <FormattedMessage
      id='empty_column.public'
      defaultMessage='There is nothing here! Write something publicly, or manually follow users from other servers to fill it up'
    />
  );

  const canViewSelectedFeed = canViewFeed(signedIn, permissions, feedType === 'community' ? localLiveFeedAccess : remoteLiveFeedAccess);

  const disabledTimelineMessage = (
    <FormattedMessage
      id='empty_column.disabled_feed'
      defaultMessage='This feed has been disabled by your server administrators.'
    />
  );

  let title;

  if (canViewFeed(signedIn, permissions, localLiveFeedAccess) && canViewFeed(signedIn, permissions, remoteLiveFeedAccess)) {
    title = messages.title;
  } else if (canViewFeed(signedIn, permissions, localLiveFeedAccess)) {
    title = messages.title_local;
  } else {
    title = messages.title_singular;
  }

  // ==========================================
  // EPSILON : LIVE FEED RENAME — single "Epsilon feed" title whatever the
  // enabled scopes; the Column label and Helmet below also read `title`
  // (natively they used messages.title).
  // ==========================================
  title = messages.epsilonTitle;
  // ==========================================

  return (
    <Column bindToDocument={!multiColumn} ref={columnRef} label={intl.formatMessage(title)}>
      <ColumnHeader
        icon='globe'
        iconComponent={PublicIcon}
        active={hasUnread}
        title={intl.formatMessage(title)}
        onPin={handlePin}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      >
        <ColumnSettings />
      </ColumnHeader>

      {(canViewFeed(signedIn, permissions, localLiveFeedAccess) && canViewFeed(signedIn, permissions, remoteLiveFeedAccess)) && (
        <div className='account__section-headline'>
          <NavLink exact to='/public/local'>
            <FormattedMessage tagName='div' id='firehose.local' defaultMessage='This server' />
          </NavLink>

          <NavLink exact to='/public/remote'>
            <FormattedMessage tagName='div' id='firehose.remote' defaultMessage='Other servers' />
          </NavLink>

          <NavLink exact to='/public'>
            <FormattedMessage tagName='div' id='firehose.all' defaultMessage='All' />
          </NavLink>
        </div>
      )}

      {/* ========================================== */}
      {/* EPSILON : LIVE FEED FILTERS (in-body — the column-header settings */}
      {/* dropdown is hidden by the Epsilon layout, so we surface them here). */}
      {/* "Media only" is the re-exposed native toggle (all users); the */}
      {/* moderation filter below is moderators only. */}
      {/* ========================================== */}
      <div className='firehose__mod-filter'>
        <div className='firehose__mod-filter__row'>
          <button
            type='button'
            className={classNames('firehose__mod-filter__button', { active: onlyMedia })}
            aria-pressed={onlyMedia}
            onClick={handleToggleMedia}
          >
            {intl.formatMessage(messages.mediaOnly)}
          </button>

          {canManageReports(permissions) && (
            <button
              type='button'
              className={classNames('firehose__mod-filter__button', { active: onlySensitive })}
              aria-pressed={onlySensitive}
              onClick={handleToggleSensitive}
            >
              <ShieldIcon className='firehose__mod-filter__icon' />
              {intl.formatMessage(messages.filterToggle)}
            </button>
          )}

          {canManageReports(permissions) && (
            <button
              type='button'
              className={classNames('firehose__mod-filter__button', { active: categoriesEnabled })}
              aria-pressed={categoriesEnabled}
              onClick={handleToggleCategories}
            >
              {intl.formatMessage(messages.filterCategories)}
            </button>
          )}
        </div>

        {canManageReports(permissions) && onlySensitive && (
          <div className='firehose__mod-filter__scopes' role='group'>
            {SENSITIVE_SCOPES.map((option) => (
              <button
                key={option.value}
                type='button'
                data-scope={option.value}
                className={classNames('firehose__mod-filter__scope', { active: sensitiveScope === option.value })}
                aria-pressed={sensitiveScope === option.value}
                onClick={handleScopeChange}
              >
                {intl.formatMessage(option.message)}
              </button>
            ))}
          </div>
        )}

        {categoriesEnabled && (
          <ModerationCategoryFilter selectedIds={activeCategoryIds} onToggle={handleCategoryToggle} onToggleAll={handleCategoryToggleAll} />
        )}
      </div>
      {/* ========================================== */}

      <StatusListContainer
        prepend={prependBanner}
        timelineId={timelineId}
        onLoadMore={handleLoadMore}
        trackScroll
        scrollKey='firehose'
        emptyMessage={canViewSelectedFeed ? emptyMessage : disabledTimelineMessage}
        bindToDocument={!multiColumn}
      />

      <Helmet>
        <title>{intl.formatMessage(title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

Firehose.propTypes = {
  multiColumn: PropTypes.bool,
  feedType: PropTypes.string,
};

export default Firehose;
