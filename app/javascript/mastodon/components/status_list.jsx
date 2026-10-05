import PropTypes from 'prop-types';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';

import { debounce } from 'lodash';

import { TIMELINE_GAP, TIMELINE_PINNED_VIEW_ALL, TIMELINE_SUGGESTIONS } from 'mastodon/actions/timelines';
import { RegenerationIndicator } from 'mastodon/components/regeneration_indicator';
import { PinnedShowAllButton } from '@/mastodon/features/account_timeline/components/pinned_statuses';

import { StatusQuoteManager } from '../components/status_quoted';

import { LoadGap } from './load_gap';
import ScrollableList from './scrollable_list';

/* ========================================== */
/* EPSILON : CATEGORY SUGGESTIONS             */
/* ========================================== */
import EpsilonCategorySuggestions from '../features/epsilon/category_suggestions';
import { AlternatingSuggestions } from '../features/epsilon/categorization/components/alternating_suggestions';
/* ========================================== */

/* ========================================== */
/* EPSILON : STATUS STACKS                    */
/* ========================================== */
import { List as ImmutableList } from 'immutable';

import { EpsilonStatusStack } from '../epsilon/components/status_stack';
import { stackAnchorId } from '../epsilon/selectors/status_stacks';
/* ========================================== */


export default class StatusList extends ImmutablePureComponent {

  static propTypes = {
    scrollKey: PropTypes.string.isRequired,
    statusIds: ImmutablePropTypes.list.isRequired,
    featuredStatusIds: ImmutablePropTypes.list,
    onLoadMore: PropTypes.func,
    onScrollToTop: PropTypes.func,
    onScroll: PropTypes.func,
    trackScroll: PropTypes.bool,
    isLoading: PropTypes.bool,
    isPartial: PropTypes.bool,
    hasMore: PropTypes.bool,
    prepend: PropTypes.node,
    emptyMessage: PropTypes.node,
    alwaysPrepend: PropTypes.bool,
    withCounters: PropTypes.bool,
    timelineId: PropTypes.string,
    lastId: PropTypes.string,
    bindToDocument: PropTypes.bool,
    statusProps: PropTypes.object,
  };

  static defaultProps = {
    trackScroll: true,
  };

  handleLoadOlder = debounce(() => {
    const { statusIds, lastId, onLoadMore } = this.props;
    /* ========================================== */
    /* EPSILON : STATUS STACKS                    */
    /* The last item may be a stack: unwrap it to its anchor id. */
    /* ========================================== */
    onLoadMore(lastId || (statusIds.size > 0 ? stackAnchorId(statusIds.last()) : undefined));
    /* ========================================== */
  }, 300, { leading: true });

  setRef = c => {
    this.node = c;
  };

  render () {
    const { statusIds, featuredStatusIds, onLoadMore, timelineId, statusProps, ...other }  = this.props;
    const { isLoading, isPartial } = other;

    if (isPartial) {
      return <RegenerationIndicator />;
    }

    let scrollableContent = (isLoading || statusIds.size > 0) ? (
      statusIds.map((statusId, index) => {
        /* ========================================== */
        /* EPSILON : STATUS STACKS                    */
        /* A nested list is a stack of posts from one prolific remote author. */
        /* ========================================== */
        if (ImmutableList.isList(statusId)) {
          return (
            <EpsilonStatusStack
              /* Key on the NEWEST member: it is loaded first (backward
                 pagination), so the key stays stable while older members
                 join the stack — the anchor id does not. A changing first
                 child key would also misfire ScrollableList's prepend
                 scroll compensation. */
              key={`epsilon-stack:${statusId.last()}`}
              statusIds={statusId}
              contextType={timelineId}
              scrollKey={this.props.scrollKey}
              withCounters={this.props.withCounters}
              statusProps={statusProps}
            />
          );
        }
        /* ========================================== */

        switch(statusId) {
        case TIMELINE_SUGGESTIONS:
          return (
            /* ========================================== */
            /* EPSILON : CATEGORIZATION SYSTEM            */
            /* Alterne carrousel de comptes / de catégories */
            /* ========================================== */
            <AlternatingSuggestions key={TIMELINE_SUGGESTIONS} />
            /* ========================================== */
          );
        case TIMELINE_GAP:
          return (
            <LoadGap
              key={'gap:' + stackAnchorId(statusIds.get(index + 1))} // EPSILON : STATUS STACKS — unwrap stacks
              disabled={isLoading}
              param={index > 0 ? stackAnchorId(statusIds.get(index - 1)) : null} // EPSILON : STATUS STACKS — anchor = oldest rendered id above the gap
              onClick={onLoadMore}
            />
          );
        /* ========================================== */
        /* EPSILON : CATEGORY SUGGESTIONS             */
        /* ========================================== */
        case 'epsilon_category_suggestions':
          return (
            <EpsilonCategorySuggestions
              key={statusId}
            />
          );
        /* ========================================== */
        default:
          return (
            <StatusQuoteManager
              key={statusId}
              id={statusId}
              contextType={timelineId}
              scrollKey={this.props.scrollKey}
              showThread
              withCounters={this.props.withCounters}
              {...statusProps}
            />
          );
        }
      })
    ) : null;

    if (scrollableContent && featuredStatusIds) {
      scrollableContent = featuredStatusIds.map(statusId => {
        if (statusId === TIMELINE_PINNED_VIEW_ALL) {
          return <PinnedShowAllButton key={TIMELINE_PINNED_VIEW_ALL} />
        }
        return (
          <StatusQuoteManager
            key={`f-${statusId}`}
            id={statusId}
            featured
            contextType={timelineId}
            showThread
            withCounters={this.props.withCounters}
            {...statusProps} />
        );
      }).concat(scrollableContent);
    }

    return (
      <ScrollableList {...other} showLoading={isLoading && statusIds.size === 0} onLoadMore={onLoadMore && this.handleLoadOlder} ref={this.setRef}>
        {scrollableContent}
      </ScrollableList>
    );
  }
}
