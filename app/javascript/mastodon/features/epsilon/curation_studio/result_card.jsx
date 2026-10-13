// Epsilon — curation studio search result card.
//
// The full native status — same UI as the timelines (formatted content, media
// gallery / video player, preview card, poll, quote…) — with one attribution
// toggle button per curated feed: none → draft (queued on the board),
// draft/published → removed. Published state is styled differently so the
// curator sees at a glance what is already live. The search panel imports the
// raw API statuses into the Redux store before rendering, so the native
// StatusContainer resolves them by id.

import PropTypes from 'prop-types';
import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';
import { fromJS } from 'immutable';

import { openModal } from 'mastodon/actions/modal';
import StatusContainer from 'mastodon/containers/status_container';
import { categoryDisplayName } from 'mastodon/features/epsilon/category_names';

const messages = defineMessages({
  removeFromFeed: { id: 'epsilon_curated.studio.remove_from_feed', defaultMessage: 'Remove from this feed' },
  addToDrafts: { id: 'epsilon_curated.studio.add_to_drafts', defaultMessage: 'Add to the drafts of this feed' },
  published: { id: 'epsilon_curated.studio.state_published', defaultMessage: 'Published' },
});

// Opens the native media lightbox (same viewer as clicking an image in a
// timeline) on the previewable attachments of a raw-JSON status. Still used by
// the draft board, whose compact rows keep their own thumbnails.
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
  const handleToggle = useCallback(
    (feed, membership) => {
      onToggle(feed, status, membership);
    },
    [onToggle, status],
  );

  return (
    <div className='epsilon-curation__card'>
      <div className='epsilon-curation__card__status'>
        <StatusContainer id={status.id} />
      </div>

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
