// Epsilon — curation studio search result card.
//
// A lightweight status preview (raw API JSON, no store round-trip) with one
// attribution toggle button per curated feed: none → draft (queued on the
// board), draft/published → removed. Published state is styled differently so
// the curator sees at a glance what is already live.

import PropTypes from 'prop-types';
import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';
import { fromJS } from 'immutable';

import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { categoryDisplayName } from 'mastodon/features/epsilon/category_names';
import { useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  removeFromFeed: { id: 'epsilon_curated.studio.remove_from_feed', defaultMessage: 'Remove from this feed' },
  addToDrafts: { id: 'epsilon_curated.studio.add_to_drafts', defaultMessage: 'Add to the drafts of this feed' },
  published: { id: 'epsilon_curated.studio.state_published', defaultMessage: 'Published' },
  viewMedia: { id: 'epsilon_curated.studio.view_media', defaultMessage: 'View media' },
});

// Opens the native media lightbox (same viewer as clicking an image in a
// timeline) on the previewable attachments of a raw-JSON status.
export const openEpsilonMediaPreview = (dispatch, status, index = 0) => {
  const previewable = (status.media_attachments ?? []).filter((attachment) => attachment.preview_url);

  if (previewable.length === 0) {
    return;
  }

  dispatch(openModal({
    modalType: 'MEDIA',
    modalProps: { media: fromJS(previewable), index, lang: status.language },
  }));
};

export const statusTextExcerpt = (html, length = 220) => {
  const text = new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '';

  return text.length > length ? `${text.slice(0, length)}…` : text;
};

const MAX_THUMBNAILS = 4;

const Thumb = ({ attachment, index, onOpen }) => {
  const intl = useIntl();

  const handleClick = useCallback(() => {
    onOpen(index);
  }, [index, onOpen]);

  return (
    <button type='button' className='epsilon-curation__thumb' title={intl.formatMessage(messages.viewMedia)} onClick={handleClick}>
      <img src={attachment.preview_url} alt={attachment.description || ''} loading='lazy' />
      {(attachment.type === 'video' || attachment.type === 'gifv') && (
        <span className='epsilon-curation__thumb__play' aria-hidden='true'>▶</span>
      )}
    </button>
  );
};

Thumb.propTypes = {
  attachment: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onOpen: PropTypes.func.isRequired,
};

// Thumbnails of the post's media (image/video/gifv previews); clicking one
// opens the native lightbox. Sensitive posts are blurred, revealed on hover
// — this is a staff tool, but no need to splash sensitive media by default.
// Falls back to a count badge for attachments without a preview (audio…).
export const MediaStrip = ({ status }) => {
  const dispatch = useAppDispatch();
  const media = status.media_attachments ?? [];
  const previewable = media.filter((attachment) => attachment.preview_url);

  const handleOpen = useCallback(
    (index) => {
      openEpsilonMediaPreview(dispatch, status, index);
    },
    [dispatch, status],
  );

  if (previewable.length === 0) {
    if (media.length === 0) {
      return null;
    }

    return (
      <div className='epsilon-curation__card__media'>
        <Icon id='picture-o' icon={PhotoLibraryIcon} />
        <span>{media.length}</span>
      </div>
    );
  }

  return (
    <div className={classNames('epsilon-curation__thumbs', { 'epsilon-curation__thumbs--sensitive': status.sensitive })}>
      {previewable.slice(0, MAX_THUMBNAILS).map((attachment, index) => (
        <Thumb key={attachment.id} attachment={attachment} index={index} onOpen={handleOpen} />
      ))}

      {previewable.length > MAX_THUMBNAILS && (
        <span className='epsilon-curation__thumb epsilon-curation__thumb--more'>
          +{previewable.length - MAX_THUMBNAILS}
        </span>
      )}
    </div>
  );
};

MediaStrip.propTypes = {
  status: PropTypes.object.isRequired,
};

const FeedButton = ({ feed, membership, onToggle }) => {
  const intl = useIntl();

  const handleClick = useCallback(() => {
    onToggle(feed, membership);
  }, [feed, membership, onToggle]);

  const published = membership?.state === 'published';

  return (
    <button
      type='button'
      className={classNames('epsilon-curation__feed-button', {
        'epsilon-curation__feed-button--draft': membership && !published,
        'epsilon-curation__feed-button--published': published,
      })}
      title={intl.formatMessage(membership ? messages.removeFromFeed : messages.addToDrafts)}
      onClick={handleClick}
    >
      {categoryDisplayName(intl, feed)}
      {published && <span className='epsilon-curation__feed-button__state'>{intl.formatMessage(messages.published)}</span>}
    </button>
  );
};

FeedButton.propTypes = {
  feed: PropTypes.object.isRequired,
  membership: PropTypes.object,
  onToggle: PropTypes.func.isRequired,
};

const ResultCard = ({ status, feeds, memberships, onToggle }) => {
  const account = status.account;

  const handleToggle = useCallback(
    (feed, membership) => {
      onToggle(feed, status, membership);
    },
    [onToggle, status],
  );

  return (
    <div className='epsilon-curation__card'>
      <div className='epsilon-curation__card__meta'>
        <img className='epsilon-curation__card__avatar' src={account.avatar} alt='' />

        <div className='epsilon-curation__card__author'>
          <strong>{account.display_name || account.username}</strong>
          <span>@{account.acct}</span>
        </div>

        <a className='epsilon-curation__card__date' href={status.url || status.uri} target='_blank' rel='noopener noreferrer'>
          <RelativeTimestamp timestamp={status.created_at} />
        </a>
      </div>

      <p className='epsilon-curation__card__text'>{statusTextExcerpt(status.content)}</p>

      <MediaStrip status={status} />

      <div className='epsilon-curation__card__feeds'>
        {feeds.map((feed) => (
          <FeedButton
            key={feed.id}
            feed={feed}
            membership={memberships?.[feed.id]}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
};

ResultCard.propTypes = {
  status: PropTypes.object.isRequired,
  feeds: PropTypes.arrayOf(PropTypes.object).isRequired,
  memberships: PropTypes.object,
  onToggle: PropTypes.func.isRequired,
};

export default ResultCard;
