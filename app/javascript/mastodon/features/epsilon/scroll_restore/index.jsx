import { useEffect, useLayoutEffect, useRef } from 'react';

import { useLocation, useHistory } from 'react-router-dom';

// Why this exists
// ---------------
// Our layout scrolls the whole page (the window), unlike vanilla Mastodon which
// scrolls small inner columns. The native scroll-behavior library saves the
// window position keyed by the *current* location, but it reads that location
// from a ref updated in a useEffect — which lags. When you leave a tall page
// (e.g. the home timeline) for a shorter one (a detailed status), the page
// shrinks and the browser clamps the window scroll to 0, emitting a `scroll`
// event. The library saves that 0 under the OLD (still-current, because lagging)
// key, clobbering the position we wanted to restore. Back-navigation then reads
// 0 and jumps to the top.
//
// Rather than fight the vendored library, we keep our own scroll memory:
//  - attribute positions to the current location key *synchronously* (during
//    render), so involuntary post-navigation scrolls never land on the wrong
//    key;
//  - ignore scrolls that fire right after a navigation (the clamp) and while we
//    are actively restoring (those are involuntary);
//  - on POP, re-assert the saved position over several frames while the
//    destination lays out.

const SETTLE_MS = 500;
const RESTORE_DURATION_MS = 1000;
const RETRY_INTERVAL_MS = 50;
const MAX_ENTRIES = 60;

/**
 * EPSILON: full-page scroll restoration for back/forward navigation.
 * Renders nothing.
 */
export const EpsilonScrollRestore = () => {
  const location = useLocation();
  const history = useHistory();

  // Updated synchronously on every render so the scroll handler always
  // attributes a position to the entry that is actually on screen.
  const keyRef = useRef(location.key);
  keyRef.current = location.key;

  const positionsRef = useRef(new Map());
  const lastNavAtRef = useRef(0);
  const restoringRef = useRef(false);
  const timerRef = useRef(null);

  // Continuously remember the user's scroll position per location key.
  useEffect(() => {
    const handleScroll = () => {
      if (restoringRef.current) {
        return;
      }
      // Skip the involuntary scroll(s) that fire right after a navigation.
      if (performance.now() - lastNavAtRef.current < SETTLE_MS) {
        return;
      }
      const key = keyRef.current;
      if (!key) {
        return;
      }
      const positions = positionsRef.current;
      positions.set(key, window.scrollY);
      if (positions.size > MAX_ENTRIES) {
        positions.delete(positions.keys().next().value);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // On navigation: stamp the time (opens the "settle" window) and, for POP,
  // restore the remembered position.
  useLayoutEffect(() => {
    lastNavAtRef.current = performance.now();

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    restoringRef.current = false;

    // PUSH/REPLACE scroll to top by design; only restore on POP (back/forward).
    if (history.action !== 'POP' || !location.key) {
      return undefined;
    }

    const y = positionsRef.current.get(location.key);
    if (typeof y !== 'number' || y <= 0) {
      return undefined;
    }

    restoringRef.current = true;
    const start = performance.now();
    // Last position we set ourselves; an upward move away from it means the
    // user grabbed the scroll, so we stop fighting them.
    let lastSet = -1;

    const tick = () => {
      if (lastSet >= 0 && window.scrollY < lastSet - 4) {
        restoringRef.current = false;
        return;
      }

      const scroller = document.scrollingElement;
      const maxY = scroller ? scroller.scrollHeight - window.innerHeight : y;
      // Clamp to what the (still growing) page can currently offer.
      const desired = Math.max(0, Math.min(y, maxY));

      if (Math.abs(window.scrollY - desired) > 1) {
        window.scrollTo(0, desired);
      }
      lastSet = desired;

      if (
        window.scrollY < y - 1 &&
        performance.now() - start < RESTORE_DURATION_MS
      ) {
        timerRef.current = window.setTimeout(tick, RETRY_INTERVAL_MS);
      } else {
        restoringRef.current = false;
      }
    };

    // Defer one turn so the destination has begun rendering before we start.
    timerRef.current = window.setTimeout(tick, 0);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      restoringRef.current = false;
    };
  }, [location.key, history.action]);

  return null;
};

export default EpsilonScrollRestore;
