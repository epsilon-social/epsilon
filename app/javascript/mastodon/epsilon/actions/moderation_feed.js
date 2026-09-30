// Epsilon — moderation live feed filters.
//
// Sidecar action creators for the moderator-only filters on the live feed
// (Firehose). They reuse the native GENERIC helpers (`expandTimeline`,
// `fillTimelineGaps`, `connectTimelineStream`) so no native action file is
// modified.
//
// `scope` selects what sensitive content to surface (null → no sensitive
// filter):
//   'media' → sensitive media only
//   'cw'    → content warnings (spoiler_text) only
//   'all'   → either
//
// `categoryIds` (sorted array) restricts the feed to posts categorized into
// at least one of the given categories (`category_ids[]`, filtered
// server-side). No live stream in that mode: categorization runs async after
// a post is created, so streamed payloads carry no category to filter on —
// the feed is load-on-demand instead.
//
// The dedicated `:sensitive:<scope>` / `:categories:<ids>` timelineId keeps a
// separate store; the REST call hits the native `/api/v1/timelines/public`
// endpoint, while the live stream (sensitive mode only) stays on the native
// public channel and is filtered client-side via `accept` (no Node streaming
// change).

import { connectTimelineStream } from 'mastodon/actions/streaming';
import { expandTimeline, fillTimelineGaps } from 'mastodon/actions/timelines';

// feedType is one of: 'community', 'public', 'public:remote'.
export const moderationTimelineId = (feedType, onlyMedia, scope, categoryIds = []) => {
  let id = `${feedType}${onlyMedia ? ':media' : ''}`;

  if (scope) {
    id += `:sensitive:${scope}`;
  }

  if (categoryIds.length > 0) {
    id += `:categories:${categoryIds.join('-')}`;
  }

  return id;
};

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

const moderationParams = (feedType, onlyMedia, scope, categoryIds) => ({
  ...publicParams(feedType),
  only_media: !!onlyMedia,
  ...(scope ? { sensitive_scope: scope } : {}),
  ...(categoryIds.length > 0 ? { category_ids: categoryIds } : {}),
});

export const expandModerationFeed = ({ feedType, maxId, onlyMedia, scope = null, categoryIds = [] } = {}) =>
  expandTimeline(moderationTimelineId(feedType, onlyMedia, scope, categoryIds), '/api/v1/timelines/public', {
    ...moderationParams(feedType, onlyMedia, scope, categoryIds),
    max_id: maxId,
  });

export const fillModerationFeedGaps = ({ feedType, onlyMedia, scope = 'all' } = {}) =>
  fillTimelineGaps(moderationTimelineId(feedType, onlyMedia, scope), '/api/v1/timelines/public', moderationParams(feedType, onlyMedia, scope, []));

export const connectModerationFeedStream = ({ feedType, onlyMedia, scope = 'all' } = {}) =>
  connectTimelineStream(moderationTimelineId(feedType, onlyMedia, scope), streamChannel(feedType, onlyMedia), {}, {
    accept: acceptForScope(scope),
    fillGaps: () => fillModerationFeedGaps({ feedType, onlyMedia, scope }),
  });
