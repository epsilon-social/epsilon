// Epsilon — moderation live feed filter.
//
// Sidecar action creators for the moderator-only filter on the live feed
// (Firehose). They reuse the native GENERIC helpers (`expandTimeline`,
// `fillTimelineGaps`, `connectTimelineStream`) so no native action file is
// modified.
//
// `scope` selects what to surface:
//   'media' → sensitive media only
//   'cw'    → content warnings (spoiler_text) only
//   'all'   → either (default)
//
// The dedicated `:sensitive:<scope>` timelineId keeps a separate store; the REST
// call hits the native `/api/v1/timelines/public` endpoint with `sensitive_scope`
// (filtered server-side), while the live stream stays on the native public
// channel and is filtered client-side via `accept` (no Node streaming change).

import { connectTimelineStream } from 'mastodon/actions/streaming';
import { expandTimeline, fillTimelineGaps } from 'mastodon/actions/timelines';

// feedType is one of: 'community', 'public', 'public:remote'.
const moderationTimelineId = (feedType, onlyMedia, scope) => `${feedType}${onlyMedia ? ':media' : ''}:sensitive:${scope}`;

// Native public streaming channel for a given feedType (without the :sensitive
// suffix — the server does not know that channel; we filter client-side).
const streamChannel = (feedType, onlyMedia) => {
  const media = onlyMedia ? ':media' : '';

  if (feedType === 'community') {
    return `public:local${media}`;
  }

  return `public${feedType === 'public:remote' ? ':remote' : ''}${media}`;
};

const publicParams = (feedType) => {
  if (feedType === 'community') {
    return { local: true };
  }

  if (feedType === 'public:remote') {
    return { remote: true };
  }

  return {};
};

const hasSensitiveMedia = (status) => !!status && status.sensitive;
const hasContentWarning = (status) => !!status && typeof status.spoiler_text === 'string' && status.spoiler_text.length > 0;

/**
 * @param {'media' | 'cw' | 'all'} scope
 * @returns {(status: { sensitive?: boolean, spoiler_text?: string, reblog?: object }) => boolean}
 */
const acceptForScope = (scope) => (status) => {
  const target = status?.reblog ?? status;

  if (scope === 'media') {
    return hasSensitiveMedia(target);
  }

  if (scope === 'cw') {
    return hasContentWarning(target);
  }

  return hasSensitiveMedia(target) || hasContentWarning(target);
};

export const expandModerationFeed = ({ feedType, maxId, onlyMedia, scope = 'all' } = {}) =>
  expandTimeline(moderationTimelineId(feedType, onlyMedia, scope), '/api/v1/timelines/public', {
    ...publicParams(feedType),
    max_id: maxId,
    only_media: !!onlyMedia,
    sensitive_scope: scope,
  });

export const fillModerationFeedGaps = ({ feedType, onlyMedia, scope = 'all' } = {}) =>
  fillTimelineGaps(moderationTimelineId(feedType, onlyMedia, scope), '/api/v1/timelines/public', {
    ...publicParams(feedType),
    only_media: !!onlyMedia,
    sensitive_scope: scope,
  });

export const connectModerationFeedStream = ({ feedType, onlyMedia, scope = 'all' } = {}) =>
  connectTimelineStream(moderationTimelineId(feedType, onlyMedia, scope), streamChannel(feedType, onlyMedia), {}, {
    accept: acceptForScope(scope),
    fillGaps: () => fillModerationFeedGaps({ feedType, onlyMedia, scope }),
  });
