import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import ImmutablePropTypes from 'react-immutable-proptypes';

import PropTypes from 'prop-types';

import { StatusQuoteManager } from 'mastodon/components/status_quoted';

/**
 * Renders a "stack" of posts from one prolific remote author: the anchor
 * (oldest post of the group) is shown with a stacked-cards visual, the
 * remaining posts are folded behind an expand button. statusIds is in
 * ascending chronological order, anchor first.
 */
// The stacked timelines scroll either on the document (epsilon layout) or
// on a .scrollable column: adjust whichever one actually scrolls.
const scrollByDelta = (node, delta) => {
  const scroller = node.closest('.scrollable');

  if (scroller && scroller.scrollHeight > scroller.clientHeight) {
    scroller.scrollTop += delta;
  } else {
    window.scrollBy(0, delta);
  }
};

export const EpsilonStatusStack = ({ statusIds, contextType, scrollKey, withCounters, statusProps }) => {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const containerRef = useRef(null);
  const toggleRef = useRef(null);
  const collapseFromTop = useRef(null);

  const anchorId = statusIds.first();
  const hiddenIds = statusIds.rest();

  const handleToggle = useCallback(() => {
    if (expanded && toggleRef.current) {
      // Remember where the button sits on screen before the fold
      collapseFromTop.current = toggleRef.current.getBoundingClientRect().top;
    }

    setExpanded(!expanded);
  }, [expanded]);

  // Collapsing removes the unfolded posts' height above the viewport, which
  // would leave the user stranded further down the feed. FLIP-style scroll
  // compensation: keep the clicked button exactly where it was on screen,
  // so nothing the eye is tracking moves — the anchor lands right above it.
  useLayoutEffect(() => {
    if (expanded || collapseFromTop.current === null) {
      return;
    }

    const desiredTop = collapseFromTop.current;
    collapseFromTop.current = null;

    // Re-pin over a few frames: content above the viewport rehydrates
    // (IntersectionObserver placeholders swap back to real posts) and can
    // nudge the layout right after the fold.
    const pin = (attempts) => {
      const button = toggleRef.current;

      if (!button) {
        return;
      }

      const delta = button.getBoundingClientRect().top - desiredTop;

      if (Math.abs(delta) > 1) {
        scrollByDelta(button, delta);
      }

      if (attempts > 0) {
        requestAnimationFrame(() => pin(attempts - 1));
      }
    };

    pin(3);

    // Safety net: if clamping prevented full compensation, make sure the
    // stack is still on screen ('nearest' is a no-op when it already is).
    const rect = containerRef.current?.getBoundingClientRect();

    if (rect && (rect.bottom < 0 || rect.top > window.innerHeight)) {
      containerRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [expanded]);

  return (
    <div ref={containerRef} className={classNames('epsilon-status-stack', { 'epsilon-status-stack--expanded': expanded })}>
      <div className='epsilon-status-stack__anchor'>
        <StatusQuoteManager
          id={anchorId}
          contextType={contextType}
          scrollKey={scrollKey}
          showThread
          withCounters={withCounters}
          {...statusProps}
        />
      </div>

      <div id={panelId} className='epsilon-status-stack__items' hidden={!expanded}>
        {expanded && hiddenIds.map((id) => (
          <StatusQuoteManager
            key={id}
            id={id}
            contextType={contextType}
            scrollKey={scrollKey}
            showThread
            withCounters={withCounters}
            {...statusProps}
          />
        ))}
      </div>

      <button
        type='button'
        ref={toggleRef}
        className='epsilon-status-stack__toggle'
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        {expanded ? (
          <FormattedMessage
            id='epsilon.status_stack.collapse'
            defaultMessage='Hide grouped posts'
          />
        ) : (
          <FormattedMessage
            id='epsilon.status_stack.expand'
            defaultMessage='{count, plural, one {Show 1 more post} other {Show # more posts}}'
            values={{ count: hiddenIds.size }}
          />
        )}
      </button>
    </div>
  );
};

EpsilonStatusStack.propTypes = {
  statusIds: ImmutablePropTypes.list.isRequired,
  contextType: PropTypes.string,
  scrollKey: PropTypes.string,
  withCounters: PropTypes.bool,
  statusProps: PropTypes.object,
};
