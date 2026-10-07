// Epsilon — API client for the curation studio and the add-to-feed picker.
// Staff endpoints (gated server-side by the taxonomies permission).

import {
  apiRequestGet,
  apiRequestPost,
  apiRequestDelete,
  apiRequestPatch,
} from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';

export interface ApiEpsilonCuratedFeedItem {
  id: string;
  curated_feed_id: string;
  status_id: string;
  state: 'draft' | 'published';
  position: number;
}

export interface ApiEpsilonCurationDrafts {
  items: ApiEpsilonCuratedFeedItem[];
  statuses: ApiStatusJSON[];
}

export const apiGetEpsilonCurationMemberships = (statusIds: string[]) =>
  apiRequestGet<ApiEpsilonCuratedFeedItem[]>(
    'v1/epsilon/curation/memberships',
    {
      status_ids: statusIds,
    },
  );

export const apiCreateEpsilonCurationItem = ({
  feedId,
  statusId,
  mode,
}: {
  feedId: string;
  statusId: string;
  mode: 'draft' | 'publish';
}) =>
  apiRequestPost<ApiEpsilonCuratedFeedItem>('v1/epsilon/curation/items', {
    feed_id: feedId,
    status_id: statusId,
    mode,
  });

export const apiDeleteEpsilonCurationItem = (itemId: string) =>
  apiRequestDelete(`v1/epsilon/curation/items/${itemId}`);

export const apiGetEpsilonCurationDrafts = (feedId: string) =>
  apiRequestGet<ApiEpsilonCurationDrafts>('v1/epsilon/curation/drafts', {
    feed_id: feedId,
  });

export const apiReorderEpsilonCurationDrafts = (
  feedId: string,
  itemIds: string[],
) =>
  apiRequestPatch(`v1/epsilon/curation/feeds/${feedId}/reorder`, {
    item_ids: itemIds,
  });

export const apiPublishEpsilonCurationFeed = (feedId: string) =>
  apiRequestPost<{ published: number }>(
    `v1/epsilon/curation/feeds/${feedId}/publish`,
    {},
  );

export const apiGetEpsilonCategoryStatuses = (
  categoryId: string,
  maxId?: string,
) =>
  apiRequestGet<ApiStatusJSON[]>('v1/epsilon/curation/category_statuses', {
    category_id: categoryId,
    max_id: maxId,
  });

export const apiImportEpsilonCurationAccount = (accountId: string) =>
  apiRequestPost<{ queued: boolean }>('v1/epsilon/curation/import_account', {
    account_id: accountId,
  });

// --- Native endpoints used by the studio search modes ---

export const apiEpsilonSearchAccounts = (q: string) =>
  apiRequestGet<ApiAccountJSON[]>('v1/accounts/search', {
    q,
    limit: 5,
    resolve: true,
  });

export const apiEpsilonAccountStatuses = (accountId: string, maxId?: string) =>
  apiRequestGet<ApiStatusJSON[]>(`v1/accounts/${accountId}/statuses`, {
    exclude_replies: true,
    exclude_reblogs: true,
    limit: 20,
    max_id: maxId,
  });

export const apiEpsilonTagStatuses = (tag: string, maxId?: string) =>
  apiRequestGet<ApiStatusJSON[]>(
    `v1/timelines/tag/${encodeURIComponent(tag)}`,
    { limit: 20, max_id: maxId },
  );

export const apiEpsilonResolveStatusUrl = (url: string) =>
  apiRequestGet<{ statuses: ApiStatusJSON[] }>('v2/search', {
    q: url,
    resolve: true,
    type: 'statuses',
    limit: 5,
  });

export interface ApiEpsilonCurationCategory {
  id: number | string;
  name: string;
  name_translations: Record<string, string>;
  slug: string;
}

export const apiEpsilonCurationCategories = () =>
  apiRequestGet<ApiEpsilonCurationCategory[]>(
    'v1/epsilon/categorization/categories',
  );
