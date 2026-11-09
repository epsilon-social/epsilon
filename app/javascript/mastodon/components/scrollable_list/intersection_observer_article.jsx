import PropTypes from 'prop-types';
import { cloneElement, Component } from 'react';

import { registerShrinkableArticle } from '../../epsilon/feed_shrink';
import getRectFromEntry from '../../features/ui/util/get_rect_from_entry';
import scheduleIdleTask from '../../features/ui/util/schedule_idle_task';
import { Article } from './components';

// Diff these props in the "unrendered" state
const updateOnPropsForUnrendered = ['id', 'index', 'listLength', 'cachedHeight'];

// ==========================================
// EPSILON : SCROLL — no virtualisation in-app (WebKit only)
// WebKit lacks overflow-anchor, so virtualising the feed makes it jump on every
// post. Keep all items mounted — but only on WebKit: Android (Chromium) has the
// native anchor, where this would just bloat memory on long feeds. Detected via
// GestureEvent (absent from Chromium), not the UA.
// ==========================================
const EPSILON_IN_APP_WEBKIT =
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('epsilon-in-app') &&
  typeof window.GestureEvent !== 'undefined';

export default class IntersectionObserverArticle extends Component {

  static propTypes = {
    intersectionObserverWrapper: PropTypes.object.isRequired,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    index: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    listLength: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    saveHeightKey: PropTypes.string,
    cachedHeight: PropTypes.number,
    onHeightChange: PropTypes.func,
    children: PropTypes.node,
  };

  state = {
    isHidden: false, // set to true in requestIdleCallback to trigger un-render
    epsilonShrunk: false, // EPSILON : un-rendered by the in-app feed shrink (see epsilon/feed_shrink)
  };

  shouldComponentUpdate (nextProps, nextState) {
    // EPSILON : never virtualised in-app → render normally (see header)
    if (EPSILON_IN_APP_WEBKIT) {
      return true;
    }

    const isUnrendered = !this.state.isIntersecting && (this.state.isHidden || this.props.cachedHeight);
    const willBeUnrendered = !nextState.isIntersecting && (nextState.isHidden || nextProps.cachedHeight);
    if (!!isUnrendered !== !!willBeUnrendered) {
      // If we're going from rendered to unrendered (or vice versa) then update
      return true;
    }
    // If we are and remain hidden, diff based on props
    if (isUnrendered) {
      return !updateOnPropsForUnrendered.every(prop => nextProps[prop] === this.props[prop]);
    }
    // Else, assume the children have changed
    return true;
  }

  componentDidMount () {
    const { intersectionObserverWrapper, id } = this.props;

    this.componentMounted = true;

    // EPSILON : no virtualisation in-app → don't observe (see header);
    // register with the feed shrink instead (bounded DOM, see epsilon/feed_shrink)
    if (EPSILON_IN_APP_WEBKIT) {
      this.epsilonUnregisterShrink = registerShrinkableArticle(this);
      return;
    }

    intersectionObserverWrapper.observe(
      id,
      this.node,
      this.handleIntersection,
    );
  }

  componentWillUnmount () {
    const { intersectionObserverWrapper, id } = this.props;
    intersectionObserverWrapper.unobserve(id, this.node);

    // EPSILON : feed shrink (see epsilon/feed_shrink)
    if (this.epsilonUnregisterShrink) {
      this.epsilonUnregisterShrink();
    }

    this.componentMounted = false;
  }

  // ==========================================
  // EPSILON : SCROLL — feed shrink (see epsilon/feed_shrink)
  // Called on every sweep: un-render into an exact-height placeholder beyond
  // `shrinkScreens` viewport-heights from the viewport, re-render once back
  // within `restoreScreens`. The placeholder is pinned to the height
  // measured at shrink time, so layout and scroll position cannot move.
  // On restore, that height is kept as a min-height floor until the content
  // has grown back to it — otherwise the article renders shorter while its
  // images re-load, shifting everything below it (visible jump).
  // ==========================================
  // Layout-affecting images only: custom emojis are loading="lazy" (they
  // never load while far offscreen, so img.complete would stay false
  // forever and block the shrink) AND they are fixed-size via CSS, so
  // their loading can't move the layout. A failed load counts as complete,
  // so dead media can't hold an article un-shrinkable forever.
  epsilonImagesLoaded = () => {
    const images = this.node.querySelectorAll('img:not([loading="lazy"])');

    for (const image of images) {
      if (!image.complete) {
        return false;
      }
    }

    return true;
  };

  epsilonEvaluateShrink = (restoreScreens, shrinkScreens) => {
    if (!this.componentMounted || !this.node) {
      return;
    }

    const restoreOnly = shrinkScreens === Number.POSITIVE_INFINITY;

    // Mid-flight (restore-only) sweeps: a rendered article with no pending
    // pin cannot change state — skip before any DOM read.
    if (restoreOnly && !this.state.epsilonShrunk && !this.epsilonPinnedHeight) {
      return;
    }

    // Release the min-height pin once every layout-affecting image has
    // (re)loaded — bridging image reloads is the pin's only job. The box
    // height can't be used as the signal: min-height forces it to the
    // pinned value, so it would always pass. Settle sweeps only: releasing
    // mid-fling could collapse a legitimately-shorter article above the
    // viewport. Done before measuring, so the rect below is pin-free.
    if (!restoreOnly && this.epsilonPinnedHeight && this.epsilonImagesLoaded()) {
      this.epsilonPinnedHeight = null;
      this.node.style.minHeight = '';
    }

    const rect = this.node.getBoundingClientRect();

    // rect.height of 0 means we're not laid out (display: none ancestor,
    // detached tab...) — no trustworthy geometry, leave the article alone.
    if (rect.height === 0) {
      return;
    }

    const viewportHeight = window.innerHeight;
    const distance =
      rect.bottom < 0 ? -rect.bottom : Math.max(0, rect.top - viewportHeight);

    if (this.state.epsilonShrunk) {
      if (distance <= viewportHeight * restoreScreens) {
        this.epsilonPinnedHeight = this.epsilonShrunkHeight;
        this.setState({ epsilonShrunk: false });
      }
      return;
    }

    if (distance > viewportHeight * shrinkScreens) {
      // Never shrink while an image is still loading: the measured height
      // would be the pre-image one, and the article would grow past its
      // placeholder after restore — shifting the viewport content when it
      // happens above it.
      if (!this.epsilonImagesLoaded()) {
        return;
      }

      // The inter-card spacing is a margin on .status INSIDE the article,
      // which escapes through the auto-height article by margin collapse.
      // The fixed-height placeholder blocks that collapse and would swallow
      // the spacing (a layout drift of ~16px per un-rendered post), so the
      // real gap to the next sibling is measured and reproduced as an
      // explicit margin — except in flex/grid lists (notifications), where
      // the container's own `gap` survives the swap untouched.
      let gapBelow = 0;
      const parent = this.node.parentElement;
      const parentDisplay = parent
        ? window.getComputedStyle(parent).display
        : '';

      if (!parentDisplay.includes('flex') && !parentDisplay.includes('grid')) {
        const next = this.node.nextElementSibling;

        if (next) {
          gapBelow = Math.max(
            0,
            next.getBoundingClientRect().top - rect.bottom,
          );
        }
      }

      this.epsilonShrunkHeight = rect.height;
      this.epsilonShrunkGap = gapBelow;
      this.epsilonPinnedHeight = null;
      this.setState({ epsilonShrunk: true });
    }
  };
  // ==========================================

  handleIntersection = (entry) => {
    this.entry = entry;

    scheduleIdleTask(this.calculateHeight);
    this.setState(this.updateStateAfterIntersection);
  };

  updateStateAfterIntersection = (prevState) => {
    if (prevState.isIntersecting !== false && !this.entry.isIntersecting) {
      scheduleIdleTask(this.hideIfNotIntersecting);
    }
    return {
      isIntersecting: this.entry.isIntersecting,
      isHidden: false,
    };
  };

  calculateHeight = () => {
    const { onHeightChange, saveHeightKey, id } = this.props;
    // save the height of the fully-rendered element (this is expensive
    // on Chrome, where we need to fall back to getBoundingClientRect)
    this.height = getRectFromEntry(this.entry).height;

    if (onHeightChange && saveHeightKey) {
      onHeightChange(saveHeightKey, id, this.height);
    }
  };

  hideIfNotIntersecting = () => {
    if (!this.componentMounted) {
      return;
    }

    // When the browser gets a chance, test if we're still not intersecting,
    // and if so, set our isHidden to true to trigger an unrender. The point of
    // this is to save DOM nodes and avoid using up too much memory.
    // See: https://github.com/mastodon/mastodon/issues/2900
    this.setState((prevState) => ({ isHidden: !prevState.isIntersecting }));
  };

  handleRef = (node) => {
    this.node = node;
  };

  render () {
    const { children, id, index, listLength, cachedHeight } = this.props;
    const { isIntersecting, isHidden, epsilonShrunk } = this.state;

    // ==========================================
    // EPSILON : SCROLL — feed shrink placeholder (see epsilon/feed_shrink)
    // ==========================================
    if (EPSILON_IN_APP_WEBKIT && epsilonShrunk) {
      return (
        <Article
          ref={this.handleRef}
          aria-posinset={index + 1}
          aria-setsize={listLength}
          className='epsilon-feed-placeholder'
          style={{
            height: `${this.epsilonShrunkHeight}px`,
            marginBottom: this.epsilonShrunkGap ? `${this.epsilonShrunkGap}px` : undefined,
            overflow: 'hidden',
          }}
          data-id={id}
        >
          {children && cloneElement(children, { hidden: true })}
        </Article>
      );
    }

    // EPSILON : in-app, never hide (no invisible placeholder)
    if (!EPSILON_IN_APP_WEBKIT && !isIntersecting && (isHidden || cachedHeight)) {
      return (
        <Article
          ref={this.handleRef}
          aria-posinset={index + 1}
          aria-setsize={listLength}
          style={{ height: `${this.height || cachedHeight}px`, opacity: 0, overflow: 'hidden' }}
          data-id={id}
        >
          {children && cloneElement(children, { hidden: true })}
        </Article>
      );
    }

    // EPSILON : feed shrink — the style prop carries the min-height floor
    // while images re-load after a restore (see epsilonEvaluateShrink);
    // undefined outside the in-app context, so browsers are untouched.
    return (
      <Article
        ref={this.handleRef}
        aria-posinset={index + 1}
        aria-setsize={listLength}
        data-id={id}
        style={EPSILON_IN_APP_WEBKIT && this.epsilonPinnedHeight ? { minHeight: `${this.epsilonPinnedHeight}px` } : undefined}
      >
        {children && cloneElement(children, { hidden: false })}
      </Article>
    );
  }

}
