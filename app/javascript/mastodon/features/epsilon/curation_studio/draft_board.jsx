// Epsilon — curation studio draft board.
//
// Per-feed ordered draft list, arranged before publication: drag to reorder
// (@dnd-kit, same stack as the compose upload form), "shuffle" to break
// single-account blocks, delete, then publish the whole batch — it lands on
// top of the public feed in the exact composed order. The board is
// server-side state, so it survives reloads and is shared between curators.

import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import ShuffleIcon from '@/material-icons/400-24px/sync_alt.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { Button } from 'mastodon/components/button';
import { IconButton } from 'mastodon/components/icon_button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import {
  apiDeleteEpsilonCurationItem,
  apiGetEpsilonCurationDrafts,
  apiPublishEpsilonCurationFeed,
  apiReorderEpsilonCurationDrafts,
} from 'mastodon/epsilon/api/curation';
import { fetchEpsilonCuratedFeeds, selectEpsilonCuratedFeedsFlat } from 'mastodon/epsilon/store/curated_feeds_slice';
import { categoryDisplayName } from 'mastodon/features/epsilon/category_names';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { interleaveByAccount } from './interleave';
import { openEpsilonMediaPreview, statusTextExcerpt } from './result_card';

const messages = defineMessages({
  remove: { id: 'epsilon_curated.studio.remove_draft', defaultMessage: 'Remove from drafts' },
  shuffle: { id: 'epsilon_curated.studio.shuffle', defaultMessage: 'Shuffle' },
  publish: { id: 'epsilon_curated.studio.publish', defaultMessage: 'Publish' },
  publishTitle: { id: 'epsilon_curated.studio.publish_confirm_title', defaultMessage: 'Publish this batch?' },
  publishMessage: { id: 'epsilon_curated.studio.publish_confirm_message', defaultMessage: '{count, plural, one {# post} other {# posts}} will appear on top of the feed, in the order below.' },
});

const DraftRow = ({ item, status, index, onRemove }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const handleRemove = useCallback(() => {
    onRemove(item);
  }, [item, onRemove]);

  const handleThumbClick = useCallback(
    (event) => {
      event.stopPropagation();
      openEpsilonMediaPreview(dispatch, status);
    },
    [dispatch, status],
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames('epsilon-curation__draft-row', { 'epsilon-curation__draft-row--dragging': isDragging })}
      {...attributes}
      {...listeners}
    >
      <span className='epsilon-curation__draft-row__index'>{index + 1}</span>

      {status ? (
        <>
          <img className='epsilon-curation__draft-row__avatar' src={status.account.avatar} alt='' />
          <div className='epsilon-curation__draft-row__body'>
            <strong>{status.account.display_name || status.account.username}</strong>
            <span>{statusTextExcerpt(status.content, 90)}</span>
          </div>
          {status.media_attachments?.[0]?.preview_url && (
            <button
              type='button'
              className={classNames('epsilon-curation__draft-row__thumb', { 'epsilon-curation__draft-row__thumb--sensitive': status.sensitive })}
              onClick={handleThumbClick}
            >
              <img src={status.media_attachments[0].preview_url} alt='' loading='lazy' />
            </button>
          )}
        </>
      ) : (
        <div className='epsilon-curation__draft-row__body'>
          <span>#{item.status_id}</span>
        </div>
      )}

      <IconButton
        className='epsilon-curation__draft-row__remove'
        title={intl.formatMessage(messages.remove)}
        icon='times'
        iconComponent={CloseIcon}
        onClick={handleRemove}
      />
    </div>
  );
};

DraftRow.propTypes = {
  item: PropTypes.object.isRequired,
  status: PropTypes.object,
  index: PropTypes.number.isRequired,
  onRemove: PropTypes.func.isRequired,
};

const DraftBoard = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const feeds = useAppSelector(selectEpsilonCuratedFeedsFlat);

  const [activeFeedId, setActiveFeedId] = useState(null);
  const [items, setItems] = useState([]);
  const [statusesById, setStatusesById] = useState({});
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    dispatch(fetchEpsilonCuratedFeeds());
  }, [dispatch]);

  useEffect(() => {
    if (!activeFeedId && feeds.length > 0) {
      setActiveFeedId(feeds[0].id);
    }
  }, [activeFeedId, feeds]);

  const fetchDrafts = useCallback((feedId) => {
    setLoading(true);

    apiGetEpsilonCurationDrafts(feedId)
      .then((data) => {
        setItems(data.items);
        setStatusesById(Object.fromEntries(data.statuses.map((status) => [status.id, status])));
        return '';
      })
      .catch(() => {
        // Nothing
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeFeedId) {
      fetchDrafts(activeFeedId);
    }
  }, [activeFeedId, fetchDrafts]);

  const persistOrder = useCallback(
    (orderedItems) => {
      apiReorderEpsilonCurationDrafts(activeFeedId, orderedItems.map((item) => item.id)).catch(() => {
        fetchDrafts(activeFeedId);
      });
    },
    [activeFeedId, fetchDrafts],
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      setItems((current) => {
        const oldIndex = current.findIndex((item) => item.id === active.id);
        const newIndex = current.findIndex((item) => item.id === over.id);
        const next = arrayMove(current, oldIndex, newIndex);
        persistOrder(next);
        return next;
      });
    },
    [persistOrder],
  );

  const handleShuffle = useCallback(() => {
    setItems((current) => {
      const next = interleaveByAccount(current, (item) => statusesById[item.status_id]?.account?.id ?? item.status_id);
      persistOrder(next);
      return next;
    });
  }, [persistOrder, statusesById]);

  const handleRemove = useCallback(
    (item) => {
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));

      apiDeleteEpsilonCurationItem(item.id).catch(() => {
        fetchDrafts(activeFeedId);
      });
    },
    [activeFeedId, fetchDrafts],
  );

  const handlePublish = useCallback(() => {
    dispatch(
      openModal({
        modalType: 'CONFIRM',
        modalProps: {
          title: intl.formatMessage(messages.publishTitle),
          message: intl.formatMessage(messages.publishMessage, { count: items.length }),
          confirm: intl.formatMessage(messages.publish),
          onConfirm: () => {
            apiPublishEpsilonCurationFeed(activeFeedId)
              .then(() => {
                fetchDrafts(activeFeedId);
                return '';
              })
              .catch(() => {
                // Nothing
              });
          },
        },
      }),
    );
  }, [dispatch, intl, items.length, activeFeedId, fetchDrafts]);

  const handleFeedTabClick = useCallback((event) => {
    setActiveFeedId(event.currentTarget.dataset.feedId);
  }, []);

  return (
    <div className='epsilon-curation__drafts'>
      <div className='epsilon-curation__modes' role='group'>
        {feeds.map((feed) => (
          <button
            key={feed.id}
            type='button'
            data-feed-id={feed.id}
            className={classNames('epsilon-curation__mode', { active: feed.id === activeFeedId })}
            onClick={handleFeedTabClick}
          >
            {categoryDisplayName(intl, feed)}
          </button>
        ))}
      </div>

      {loading && <LoadingIndicator />}

      {!loading && items.length === 0 && (
        <div className='epsilon-curation__empty'>
          <FormattedMessage id='epsilon_curated.studio.drafts_empty' defaultMessage='No drafts for this feed. Use the search tab to add posts.' />
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className='epsilon-curation__drafts-toolbar'>
            <span className='epsilon-curation__drafts-count'>
              <FormattedMessage
                id='epsilon_curated.studio.drafts_count'
                defaultMessage='{count, plural, one {# post in drafts} other {# posts in drafts}}'
                values={{ count: items.length }}
              />
            </span>

            <Button secondary onClick={handleShuffle}>
              <ShuffleIcon className='epsilon-curation__shuffle-icon' />
              {intl.formatMessage(messages.shuffle)}
            </Button>

            <Button onClick={handlePublish}>{intl.formatMessage(messages.publish)}</Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className='epsilon-curation__draft-list'>
                {items.map((item, index) => (
                  <DraftRow
                    key={item.id}
                    item={item}
                    status={statusesById[item.status_id]}
                    index={index}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
};

export default DraftBoard;
