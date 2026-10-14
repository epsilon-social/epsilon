import { useCallback, useState } from 'react';

import { FormattedDate, FormattedMessage, useIntl, defineMessages } from 'react-intl';

import classNames from 'classnames';

import CampaignIcon from '@/material-icons/400-24px/campaign.svg?react';
import KeyboardArrowDownIcon from '@/material-icons/400-24px/keyboard_arrow_down.svg?react';
import KeyboardArrowUpIcon from '@/material-icons/400-24px/keyboard_arrow_up.svg?react';
import { Icon } from 'mastodon/components/icon';
import { Announcements } from 'mastodon/features/home_timeline/components/announcements';
import { useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  show: { id: 'home.show_announcements', defaultMessage: 'Show announcements' },
  hide: { id: 'home.hide_announcements', defaultMessage: 'Hide announcements' },
});

// The Epsilon home is header-less, so the native announcements toggle (the
// bullhorn button in the column header) is never rendered. This wrapper gives
// the panel its own collapse affordance: the collapsed state is persisted in
// localStorage keyed to the newest announcement id, so publishing a new
// announcement automatically re-expands the card.
const STORAGE_KEY = 'epsilon_announcements_collapsed_up_to';

const readCollapsedUpTo = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

// Snowflake ids as strings: longer is bigger, same length compares
// lexicographically.
const idIsNewer = (a, b) =>
  a.length === b.length ? a > b : a.length > b.length;

export const EpsilonAnnouncements = () => {
  const intl = useIntl();
  const items = useAppSelector((state) => state.announcements.get('items'));
  const [collapsedUpTo, setCollapsedUpTo] = useState(readCollapsedUpTo);

  const latest = items.reduce(
    (max, announcement) =>
      max === null || idIsNewer(announcement.get('id'), max.get('id'))
        ? announcement
        : max,
    null,
  );

  const latestId = latest === null ? null : latest.get('id');
  const latestDate =
    latest === null
      ? null
      : latest.get('starts_at') || latest.get('published_at');

  const unreadCount = items.count((announcement) => !announcement.get('read'));

  const collapsed =
    collapsedUpTo !== null &&
    latestId !== null &&
    !idIsNewer(latestId, collapsedUpTo);

  const handleToggle = useCallback(() => {
    try {
      if (collapsed) {
        localStorage.removeItem(STORAGE_KEY);
      } else if (latestId !== null) {
        localStorage.setItem(STORAGE_KEY, latestId);
      }
    } catch {
      // Private mode: the toggle still works for the session.
    }

    setCollapsedUpTo(collapsed ? null : latestId);
  }, [collapsed, latestId]);

  if (items.isEmpty()) {
    return null;
  }

  const toggleLabel = intl.formatMessage(collapsed ? messages.show : messages.hide);

  return (
    <div className={classNames('epsilon-announcements', { 'epsilon-announcements--collapsed': collapsed })}>
      <button
        type='button'
        className='epsilon-announcements__bar'
        onClick={handleToggle}
        title={toggleLabel}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
      >
        <Icon id='bullhorn' icon={CampaignIcon} className='epsilon-announcements__icon' />
        <span className='epsilon-announcements__title'>
          <FormattedMessage id='epsilon.announcements.title' defaultMessage='Announcements' />
        </span>
        {unreadCount > 0 && (
          <span className='epsilon-announcements__badge'>{unreadCount}</span>
        )}
        {latestDate && (
          <time className='epsilon-announcements__date' dateTime={latestDate}>
            <FormattedDate value={latestDate} month='short' day='numeric' />
          </time>
        )}
        <Icon
          id='chevron'
          icon={collapsed ? KeyboardArrowDownIcon : KeyboardArrowUpIcon}
          className='epsilon-announcements__chevron'
        />
      </button>

      <div
        className='epsilon-announcements__content'
        inert={collapsed ? '' : undefined}
        aria-hidden={collapsed}
      >
        <div className='epsilon-announcements__content-inner'>
          <div className='epsilon-announcements__body'>
            <div className='epsilon-announcements__watermark' aria-hidden='true'>
              <Icon id='bullhorn' icon={CampaignIcon} />
            </div>
            <Announcements />
          </div>
        </div>
      </div>
    </div>
  );
};
