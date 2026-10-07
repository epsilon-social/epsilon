// ==========================================
// EPSILON : CURATED EDITORIAL FEEDS
import { epsilonCuratedFeeds } from '../../epsilon/store/curated_feeds_slice';
import { epsilonCuratedTimelines } from '../../epsilon/store/curated_timelines_slice';

import { annualReport } from './annual_report';
import { collections } from './collections';
import { emojis } from './emojis';
import { profileEdit } from './profile_edit';
// ==========================================

export const sliceReducers = {
  annualReport,
  collections,
  emojis,
  profileEdit,
  // ==========================================
  // EPSILON : CURATED EDITORIAL FEEDS
  epsilonCuratedFeeds,
  epsilonCuratedTimelines,
  // ==========================================
};
