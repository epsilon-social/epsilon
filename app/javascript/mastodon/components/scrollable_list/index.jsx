import PropTypes from 'prop-types';
import { Children, cloneElement, PureComponent } from 'react';

import { useLocation } from 'react-router-dom';

import { List as ImmutableList } from 'immutable';
import { connect } from 'react-redux';

import { supportsPassiveEvents } from 'detect-passive-events';
import { throttle } from 'lodash';

import { ScrollContainer } from 'mastodon/containers/scroll_container';

import IntersectionObserverArticleContainer from '../../containers/intersection_observer_article_container';
import { attachFullscreenListener, detachFullscreenListener, isFullscreen } from '../../features/ui/util/fullscreen';
import IntersectionObserverWrapper from '../../features/ui/util/intersection_observer_wrapper';

import { LoadMore } from '../load_more';
import { LoadPending } from '../load_pending';
import { LoadingIndicator } from '../loading_indicator';
import { Scrollable, ItemList } from './components';

const MOUSE_IDLE_DELAY = 300;

const listenerOptions = supportsPassiveEvents ? { passive: true } : false;

/**
 *
 * @param {import('mastodon/store').RootState} state
 * @param {*} props
 */
const mapStateToProps = (state, { scrollKey }) => {
  return {
    preventScroll: scrollKey === state.dropdownMenu.scrollKey,
  };
};

// This component only exists to be able to call useLocation()
const IOArticleContainerWrapper = ({id, index, listLength, intersectionObserverWrapper, trackScroll, scrollKey, children}) => {
  const location = useLocation();

  return (<IntersectionObserverArticleContainer
    id={id}
    index={index}
    listLength={listLength}
    intersectionObserverWrapper={intersectionObserverWrapper}
    saveHeightKey={trackScroll ? `${location.key}:${scrollKey}` : null}
  >
    {children}
  </IntersectionObserverArticleContainer>);
};

IOArticleContainerWrapper.propTypes =  {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  listLength: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  scrollKey: PropTypes.string.isRequired,
  intersectionObserverWrapper: PropTypes.object.isRequired,
  trackScroll: PropTypes.bool.isRequired,
  children: PropTypes.node,
};

class ScrollableList extends PureComponent {

  static propTypes = {
    scrollKey: PropTypes.string.isRequired,
    onLoadMore: PropTypes.func,
    onLoadPending: PropTypes.func,
    onScrollToTop: PropTypes.func,
    onScroll: PropTypes.func,
    trackScroll: PropTypes.bool,
    isLoading: PropTypes.bool,
    showLoading: PropTypes.bool,
    hasMore: PropTypes.bool,
    numPending: PropTypes.number,
    prepend: PropTypes.node,
    append: PropTypes.node,
    alwaysPrepend: PropTypes.bool,
    emptyMessage: PropTypes.node,
    children: PropTypes.node,
    bindToDocument: PropTypes.bool,
    preventScroll: PropTypes.bool,
    footer: PropTypes.node,
    className: PropTypes.string,
  };

  static defaultProps = {
    trackScroll: true,
  };

  state = {
    fullscreen: null,
    cachedMediaWidth: 250, // Default media/card width using default Mastodon theme
  };

  intersectionObserverWrapper = new IntersectionObserverWrapper();

  handleScroll = throttle(() => {
    if (this.node) {
      const scrollTop = this.getScrollTop();
      const scrollHeight = this.getScrollHeight();
      const clientHeight = this.getClientHeight();
      const offset = scrollHeight - scrollTop - clientHeight;

      if (scrollTop > 0 && offset < 400 && this.props.onLoadMore && this.props.hasMore && !this.props.isLoading) {
        this.props.onLoadMore();
      }

      if (scrollTop < 100 && this.props.onScrollToTop) {
        this.props.onScrollToTop();
      } else if (this.props.onScroll) {
        this.props.onScroll();
      }

      if (!this.lastScrollWasSynthetic) {
        // If the last scroll wasn't caused by setScrollTop(), assume it was
        // intentional and cancel any pending scroll reset on mouse idle
        this.scrollToTopOnMouseIdle = false;
      }
      this.lastScrollWasSynthetic = false;
    }
  }, 150, {
    trailing: true,
  });

  mouseIdleTimer = null;
  mouseMovedRecently = false;
  lastScrollWasSynthetic = false;
  scrollToTopOnMouseIdle = false;

  _getScrollingElement = () => {
    if (this.props.bindToDocument) {
      return (document.scrollingElement || document.body);
    } else {
      return this.node;
    }
  };

  setScrollTop = newScrollTop => {
    if (this.getScrollTop() !== newScrollTop) {
      this.lastScrollWasSynthetic = true;

      this._getScrollingElement().scrollTop = newScrollTop;
    }
  };

  clearMouseIdleTimer = () => {
    if (this.mouseIdleTimer === null) {
      return;
    }

    clearTimeout(this.mouseIdleTimer);
    this.mouseIdleTimer = null;
  };

  handleMouseMove = throttle(() => {
    // As long as the mouse keeps moving, clear and restart the idle timer.
    this.clearMouseIdleTimer();
    this.mouseIdleTimer = setTimeout(this.handleMouseIdle, MOUSE_IDLE_DELAY);

    if (!this.mouseMovedRecently && this.getScrollTop() === 0) {
      // Only set if we just started moving and are scrolled to the top.
      this.scrollToTopOnMouseIdle = true;
    }

    // Save setting this flag for last, so we can do the comparison above.
    this.mouseMovedRecently = true;
  }, MOUSE_IDLE_DELAY / 2);

  handleWheel = throttle(() => {
    this.scrollToTopOnMouseIdle = false;
  }, 150, {
    trailing: true,
  });

  handleMouseIdle = () => {
    if (this.scrollToTopOnMouseIdle && !this.props.preventScroll) {
      this.setScrollTop(0);
    }

    this.mouseMovedRecently = false;
    this.scrollToTopOnMouseIdle = false;
  };

  componentDidMount () {
    this.attachScrollListener();
    this.attachIntersectionObserver();

    attachFullscreenListener(this.onFullScreenChange);

    // Handle initial scroll position
    this.handleScroll();

    /* ========================================== */
    /* EPSILON : STATUS STACKS                    */
    /* ========================================== */
    this.maybeFillViewport();
    /* ========================================== */
  }

  /* ========================================== */
  /* EPSILON : STATUS STACKS                    */
  /* Scroll-driven load-more starves when the rendered content is shorter
     than the viewport (scrollTop stays 0) — e.g. when stacks or the home
     filters collapse most of a page. Keep fetching until the screen is
     filled or the timeline is exhausted. */
  /* ========================================== */
  epsilonLastFillAttempt = null;

  maybeFillViewport = throttle(() => {
    if (!this.node || !this.props.onLoadMore || !this.props.hasMore || this.props.isLoading) {
      return;
    }

    if (this.getScrollHeight() > this.getClientHeight() + 400) {
      return;
    }

    // Back off when the previous attempt did not grow the list (failed or
    // empty fetch): on a flaky connection this would otherwise hammer the
    // API in a tight retry loop. One retry per grace period is enough.
    const childrenCount = Children.count(this.props.children);
    const lastAttempt = this.epsilonLastFillAttempt;

    if (lastAttempt && lastAttempt.count === childrenCount && Date.now() - lastAttempt.time < 10000) {
      return;
    }

    this.epsilonLastFillAttempt = { count: childrenCount, time: Date.now() };
    this.props.onLoadMore();
  }, 500, {
    trailing: true,
  });
  /* ========================================== */

  getScrollPosition = () => {
    if (this.node && (this.getScrollTop() > 0 || this.mouseMovedRecently)) {
      return { height: this.getScrollHeight(), top: this.getScrollTop() };
    } else {
      return null;
    }
  };

  getScrollTop = () => {
    return this._getScrollingElement().scrollTop;
  };

  getScrollHeight = () => {
    return this._getScrollingElement().scrollHeight;
  };

  getClientHeight = () => {
    return this._getScrollingElement().clientHeight;
  };

  updateScrollBottom = (snapshot) => {
    const newScrollTop = this.getScrollHeight() - snapshot;

    this.setScrollTop(newScrollTop);
  };

  getSnapshotBeforeUpdate (prevProps) {
    const someItemInserted = Children.count(prevProps.children) > 0 &&
      Children.count(prevProps.children) < Children.count(this.props.children) &&
      this.getFirstChildKey(prevProps) !== this.getFirstChildKey(this.props);
    const pendingChanged = (prevProps.numPending > 0) !== (this.props.numPending > 0);

    /* ========================================== */
    /* EPSILON : STATUS STACKS                    */
    /* Capture the topmost visible articles so the update handler can keep
       them anchored on screen (manual scroll anchoring). */
    /* ========================================== */
    const anchors = this.epsilonCaptureScrollAnchors();

    if (pendingChanged || someItemInserted && (this.getScrollTop() > 0 || this.mouseMovedRecently || this.props.preventScroll)) {
      return { height: this.getScrollHeight() - this.getScrollTop(), anchors };
    } else {
      return anchors ? { height: null, anchors } : null;
    }
    /* ========================================== */
  }

  /* ========================================== */
  /* EPSILON : STATUS STACKS                    */
  /* Manual scroll anchoring. Paginating can reshape content ABOVE the
     viewport (posts folding into a stack, a stack's anchor migrating into
     the newly loaded page): the browser keeps a numeric scrollTop while
     the height above changes, teleporting the reader. Chrome's native
     anchoring absorbs some of it, but iOS WebKit (the app shell) has
     none, and native anchoring bails when the anchor node is remounted.
     Measuring AFTER layout makes this a no-op wherever the browser
     already compensated. */
  /* ========================================== */
  epsilonCaptureScrollAnchors = () => {
    if (!this.node || this.getScrollTop() <= 0) {
      return null;
    }

    const viewTop = this.props.bindToDocument ? 0 : this.node.getBoundingClientRect().top;
    const articles = this.node.querySelectorAll('article[data-id]');
    const anchors = [];
    const stackAnchors = [];

    for (const article of articles) {
      const rect = article.getBoundingClientRect();

      // First few articles whose bottom edge is below the top of the view:
      // several candidates, in case the first ones get folded away. Plain
      // statuses are preferred — a stack can itself migrate down the list
      // (older bucket members loading), and pinning it would drag the
      // viewport along with it.
      if (rect.bottom > viewTop + 1) {
        const id = article.getAttribute('data-id');

        (id.startsWith('epsilon-stack:') ? stackAnchors : anchors).push({ id, top: rect.top });

        if (anchors.length >= 5) {
          break;
        }
      }
    }

    anchors.push(...stackAnchors);

    return anchors.length > 0 ? anchors : null;
  };

  epsilonRestoreScrollAnchors = (anchors) => {
    for (const anchor of anchors) {
      const article = this.node?.querySelector(`article[data-id="${CSS.escape(anchor.id)}"]`);

      if (article) {
        const delta = article.getBoundingClientRect().top - anchor.top;

        if (Math.abs(delta) > 1) {
          this.setScrollTop(this.getScrollTop() + delta);
        }

        return true;
      }
    }

    return false;
  };
  /* ========================================== */

  componentDidUpdate (prevProps, prevState, snapshot) {
    // Reset the scroll position when a new child comes in in order not to
    // jerk the scrollbar around if you're already scrolled down the page.
    if (snapshot !== null) {
      /* ========================================== */
      /* EPSILON : STATUS STACKS                    */
      /* Prefer anchor-based restore; fall back to the native height-based
         compensation (prepend case) when no anchor survived the update. */
      /* ========================================== */
      const restored = snapshot.anchors ? this.epsilonRestoreScrollAnchors(snapshot.anchors) : false;

      if (!restored && snapshot.height !== null) {
        this.setScrollTop(this.getScrollHeight() - snapshot.height);
      }
      /* ========================================== */
    }

    /* ========================================== */
    /* EPSILON : STATUS STACKS                    */
    /* ========================================== */
    this.maybeFillViewport();
    /* ========================================== */
  }

  cacheMediaWidth = (width) => {
    if (width && this.state.cachedMediaWidth !== width) {
      this.setState({ cachedMediaWidth: width });
    }
  };

  componentWillUnmount () {
    this.clearMouseIdleTimer();
    this.detachScrollListener();
    this.detachIntersectionObserver();

    detachFullscreenListener(this.onFullScreenChange);
  }

  onFullScreenChange = () => {
    this.setState({ fullscreen: isFullscreen() });
  };

  attachIntersectionObserver () {
    let nodeOptions = {
      root: this.node,
      rootMargin: '300% 0px',
    };

    this.intersectionObserverWrapper
      .connect(this.props.bindToDocument ? {} : nodeOptions);
  }

  detachIntersectionObserver () {
    this.intersectionObserverWrapper.disconnect();
  }

  attachScrollListener () {
    if (this.props.bindToDocument) {
      document.addEventListener('scroll', this.handleScroll);
      document.addEventListener('wheel', this.handleWheel,  listenerOptions);
    } else {
      this.node.addEventListener('scroll', this.handleScroll);
      this.node.addEventListener('wheel', this.handleWheel, listenerOptions);
    }
  }

  detachScrollListener () {
    if (this.props.bindToDocument) {
      document.removeEventListener('scroll', this.handleScroll);
      document.removeEventListener('wheel', this.handleWheel, listenerOptions);
    } else if (this.node) {
      this.node.removeEventListener('scroll', this.handleScroll);
      this.node.removeEventListener('wheel', this.handleWheel, listenerOptions);
    }
  }

  getFirstChildKey (props) {
    const { children } = props;
    let firstChild     = children;

    if (children instanceof ImmutableList) {
      firstChild = children.get(0);
    } else if (Array.isArray(children)) {
      firstChild = children[0];
    }

    return firstChild && firstChild.key;
  }

  setRef = (c) => {
    this.node = c;
  };

  handleLoadMore = e => {
    e.preventDefault();
    this.props.onLoadMore();
  };

  handleLoadPending = e => {
    e.preventDefault();
    this.props.onLoadPending();
    // Prevent the weird scroll-jumping behavior, as we explicitly don't want to
    // scroll to top, and we know the scroll height is going to change
    this.scrollToTopOnMouseIdle = false;
    this.lastScrollWasSynthetic = false;
    this.clearMouseIdleTimer();
    this.mouseIdleTimer = setTimeout(this.handleMouseIdle, MOUSE_IDLE_DELAY);
    this.mouseMovedRecently = true;
  };

  render () {
    const { children, scrollKey, className, trackScroll, showLoading, isLoading, hasMore, numPending, prepend, alwaysPrepend, append, footer, emptyMessage, onLoadMore } = this.props;
    const { fullscreen } = this.state;
    const childrenCount = Children.count(children);

    const loadMore     = (hasMore && onLoadMore) ? <LoadMore visible={!isLoading} onClick={this.handleLoadMore} /> : null;
    const loadPending  = (numPending > 0) ? <LoadPending count={numPending} onClick={this.handleLoadPending} /> : null;
    let scrollableArea = null;

    if (showLoading) {
      scrollableArea = (
        <Scrollable ref={this.setRef}>
          {prepend}

          <ItemList isLoading />

          {footer}
        </Scrollable>
      );
    } else if (isLoading || childrenCount > 0 || numPending > 0 || hasMore || !emptyMessage) {
      scrollableArea = (
        <Scrollable fullscreen={fullscreen} ref={this.setRef} onMouseMove={this.handleMouseMove}>
          {prepend}

          <ItemList className={className}>
            {loadPending}

            {Children.map(this.props.children, (child, index) => (
              <IOArticleContainerWrapper
                key={child.key}
                id={child.key}
                index={index}
                listLength={childrenCount}
                intersectionObserverWrapper={this.intersectionObserverWrapper}
                trackScroll={trackScroll}
                scrollKey={scrollKey}
              >
                {cloneElement(child, {
                  getScrollPosition: this.getScrollPosition,
                  updateScrollBottom: this.updateScrollBottom,
                  cachedMediaWidth: this.state.cachedMediaWidth,
                  cacheMediaWidth: this.cacheMediaWidth,
                })}
              </IOArticleContainerWrapper>
            ))}

            {loadMore}

            {!hasMore && append}
          </ItemList>

          {footer}
        </Scrollable>
      );
    } else {
      scrollableArea = (
        <Scrollable fullscreen={fullscreen} ref={this.setRef}>
          {alwaysPrepend && prepend}

          <div className='empty-column-indicator'>
            <span>{emptyMessage}</span>
          </div>

          {footer}
        </Scrollable>
      );
    }

    if (trackScroll) {
      return (
        <ScrollContainer scrollKey={scrollKey} childRef={this.setRef}>
          {scrollableArea}
        </ScrollContainer>
      );
    } else {
      return scrollableArea;
    }
  }

}

export default connect(mapStateToProps, null, null, { forwardRef: true })(ScrollableList);
