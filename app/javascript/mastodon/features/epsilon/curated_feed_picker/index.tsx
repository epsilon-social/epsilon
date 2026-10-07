// Epsilon — add-to-curated-feed picker modal.
//
// Staff two-click flow from the status "…" menu: checking a feed publishes
// the post on top of it right away; unchecking removes it (e.g. fake news
// discovered after publication). Mirrors the native ListAdder modal.

import { useCallback, useEffect, useId, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Toggle } from '@/mastodon/components/form_fields';
import BreakingNewsIcon from '@/material-icons/400-24px/breaking_news.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { Icon } from 'mastodon/components/icon';
import { IconButton } from 'mastodon/components/icon_button';
import { NavigationFocusTarget } from 'mastodon/components/navigation_focus_target';
import type { ApiEpsilonCuratedFeedItem } from 'mastodon/epsilon/api/curation';
import {
  apiGetEpsilonCurationMemberships,
  apiCreateEpsilonCurationItem,
  apiDeleteEpsilonCurationItem,
} from 'mastodon/epsilon/api/curation';
import type { ApiEpsilonCuratedFeed } from 'mastodon/epsilon/store/curated_feeds_slice';
import {
  fetchEpsilonCuratedFeeds,
  selectEpsilonCuratedFeedsFlat,
} from 'mastodon/epsilon/store/curated_feeds_slice';
import { categoryDisplayName } from 'mastodon/features/epsilon/category_names';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  close: { id: 'lightbox.close', defaultMessage: 'Close' },
  draftHint: {
    id: 'epsilon_curated.picker.draft_hint',
    defaultMessage: 'In drafts',
  },
});

const FeedRow: React.FC<{
  feed: ApiEpsilonCuratedFeed;
  membership?: ApiEpsilonCuratedFeedItem;
  onToggle: (feedId: string, checked: boolean) => void;
}> = ({ feed, membership, onToggle }) => {
  const intl = useIntl();
  const uniqueId = useId();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(feed.id, e.target.checked);
    },
    [feed.id, onToggle],
  );

  return (
    <label className='lists__item' htmlFor={uniqueId}>
      <div className='lists__item__title'>
        <Icon id='newspaper' icon={BreakingNewsIcon} />
        <span>{categoryDisplayName(intl, feed)}</span>
        {membership?.state === 'draft' && (
          <span className='epsilon-curated-picker__hint'>
            {intl.formatMessage(messages.draftHint)}
          </span>
        )}
      </div>

      <Toggle id={uniqueId} checked={!!membership} onChange={handleChange} />
    </label>
  );
};

export const EpsilonCuratedFeedPicker: React.FC<{
  statusId: string;
  onClose: () => void;
}> = ({ statusId, onClose }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const feeds = useAppSelector(selectEpsilonCuratedFeedsFlat);
  const [memberships, setMemberships] = useState<
    Record<string, ApiEpsilonCuratedFeedItem>
  >({});

  useEffect(() => {
    void dispatch(fetchEpsilonCuratedFeeds());

    apiGetEpsilonCurationMemberships([statusId])
      .then((items) => {
        const next: Record<string, ApiEpsilonCuratedFeedItem> = {};
        items.forEach((item) => {
          next[item.curated_feed_id] = item;
        });
        setMemberships(next);
        return '';
      })
      .catch(() => {
        // Nothing
      });
  }, [dispatch, statusId]);

  const handleToggle = useCallback(
    (feedId: string, checked: boolean) => {
      if (checked) {
        apiCreateEpsilonCurationItem({ feedId, statusId, mode: 'publish' })
          .then((item) => {
            setMemberships((current) => ({
              ...current,
              [item.curated_feed_id]: item,
            }));
            return '';
          })
          .catch(() => {
            // Nothing
          });
      } else {
        const item = memberships[feedId];

        if (!item) {
          return;
        }

        setMemberships((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([key]) => key !== feedId),
          ),
        );

        apiDeleteEpsilonCurationItem(item.id).catch(() => {
          setMemberships((current) => ({ ...current, [feedId]: item }));
        });
      }
    },
    [memberships, statusId],
  );

  return (
    <div className='modal-root__modal dialog-modal'>
      <div className='dialog-modal__header'>
        <IconButton
          className='dialog-modal__header__close'
          title={intl.formatMessage(messages.close)}
          icon='times'
          iconComponent={CloseIcon}
          onClick={onClose}
        />

        <NavigationFocusTarget as='h1' className='dialog-modal__header__title'>
          <FormattedMessage
            id='epsilon_curated.picker.title'
            defaultMessage='Curated feeds'
          />
        </NavigationFocusTarget>
      </div>

      <div className='dialog-modal__content'>
        <div className='lists-scrollable'>
          <p className='epsilon-curated-picker__note'>
            <FormattedMessage
              id='epsilon_curated.picker.note'
              defaultMessage='Checked feeds show this post immediately, on top.'
            />
          </p>

          {feeds.map((feed) => (
            <FeedRow
              key={feed.id}
              feed={feed}
              membership={memberships[feed.id]}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
