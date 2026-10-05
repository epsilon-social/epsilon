import { createSelector } from '@reduxjs/toolkit';
import { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { connect } from 'react-redux';

import { debounce } from 'lodash';

import { scrollTopTimeline, loadPending } from '@/mastodon/actions/timelines';
import { isNonStatusId } from '@/mastodon/actions/timelines_typed';
import StatusList from '@/mastodon/components/status_list';
import { me } from '@/mastodon/initial_state';

// ==========================================
// EPSILON : STATUS STACKS
// ==========================================
import { collapseIntoStacks } from '@/mastodon/epsilon/selectors/status_stacks';
// ==========================================

const makeGetStatusIds = (pending = false) => createSelector([
  (state, { type }) => state.getIn(['settings', type], ImmutableMap()),
  (state, { type, maxItems }) => {
    const items = state.getIn(['timelines', type, pending ? 'pendingItems' : 'items'], ImmutableList());

    if (maxItems) {
      return items.take(maxItems);
    }

    return items;
  },
  (state)           => state.get('statuses'),
  // ==========================================
  // EPSILON : STATUS STACKS
  // ==========================================
  (state)           => state.get('accounts'),
  (state, { type }) => type,
  // ==========================================
], (columnSettings, statusIds, statuses, accounts, type) => {
  const filteredStatusIds = statusIds.filter(id => {
    if (isNonStatusId(id)) return true;

    const statusForId = statuses.get(id);

    if (statusForId.get('account') === me) return true;

    if (columnSettings.getIn(['shows', 'reblog']) === false && statusForId.get('reblog') !== null) {
      return false;
    }

    if (columnSettings.getIn(['shows', 'reply']) === false && statusForId.get('in_reply_to_id') !== null && statusForId.get('in_reply_to_account_id') !== me) {
      return false;
    }

    if (columnSettings.getIn(['shows', 'quote']) === false && statusForId.get('quote') !== null) {
      return false;
    }

    return true;
  });

  // ==========================================
  // EPSILON : STATUS STACKS
  // Collapse prolific remote authors into stacks (home timeline only;
  // pending items stay flat so the "new posts" counter remains exact).
  // ==========================================
  const stacksEnabled = columnSettings.getIn(['epsilon', 'stacks'], true);

  if (!pending && type === 'home' && stacksEnabled) {
    return collapseIntoStacks(filteredStatusIds, statuses, accounts);
  }
  // ==========================================

  return filteredStatusIds;
});

const makeMapStateToProps = () => {
  const getStatusIds = makeGetStatusIds();
  const getPendingStatusIds = makeGetStatusIds(true);

  /**
   * @param {import('mastodon/store').RootState} state
   * @param {Object} props
   * @param {string} props.timelineId
   * @param {boolean} [props.initialLoadingState]
   * @param {number} [props.maxItems]
   */
  const mapStateToProps = (state, { timelineId, initialLoadingState = true, maxItems }) => ({
    statusIds: getStatusIds(state, { type: timelineId, maxItems }),
    lastId:    state.getIn(['timelines', timelineId, 'items'])?.last(),
    isLoading: state.getIn(['timelines', timelineId, 'isLoading'], initialLoadingState),
    isPartial: state.getIn(['timelines', timelineId, 'isPartial'], false),
    hasMore:   state.getIn(['timelines', timelineId, 'hasMore']),
    numPending: getPendingStatusIds(state, { type: timelineId }).size,
  });

  return mapStateToProps;
};

const mapDispatchToProps = (dispatch, { timelineId }) => ({

  onScrollToTop: debounce(() => {
    dispatch(scrollTopTimeline(timelineId, true));
  }, 100),

  onScroll: debounce(() => {
    dispatch(scrollTopTimeline(timelineId, false));
  }, 100),

  onLoadPending: () => dispatch(loadPending(timelineId)),

});

export default connect(makeMapStateToProps, mapDispatchToProps)(StatusList);
