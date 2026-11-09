// In-app feed shrink — bounds the memory of the unvirtualised feed.
//
// In-app WebKit keeps every feed item mounted (no virtualisation: WebKit has
// no overflow-anchor, un-rendering near the viewport makes the feed jump), so
// long sessions grow an unbounded DOM. Two consequences: degraded scrolling
// performance over time, and — worse — iOS kills the largest WebKit content
// processes while the app is backgrounded, which resurfaces as a dead (black)
// WebView on resume.
//
// This module is the counterweight. Feed articles register here; on every
// sweep, each article measures its own distance to the viewport and
// un-renders into a placeholder of its exact measured height when it is far
// enough away (so layout and scroll position cannot move), re-rendering when
// it comes back within range. Sweeps are self-triggered — a capture-phase
// document scroll listener sees every scroll container, so no wiring into
// native feed components is needed:
//
// - during scroll, restore-only sweeps (never un-render in flight: WebKit
//   scrolling is asynchronous and mid-fling geometry is stale), then a
//   guaranteed two-phase settle sweep shortly after the last scroll event —
//   the settle is the only place un-rendering happens, on exact geometry;
// - after (re)registration bursts, so a freshly remounted feed gets bounded
//   without waiting for the user to scroll;
// - when the page goes hidden, synchronously and with a tight margin — the
//   process footprint collapses during exactly the window where iOS picks
//   its jetsam victims;
// - when the page becomes visible again, back to the scroll margins.

interface ShrinkableArticle {
  epsilonEvaluateShrink: (
    restoreScreens: number,
    shrinkScreens: number,
  ) => void;
}

// Keep screens of real DOM around the viewport, with hysteresis while
// scrolling: articles only un-render beyond SHRINK screens, but re-render as
// soon as they come within RESTORE screens — the gap keeps the swap from
// flapping, and restoring ~10 screens ahead of the viewport gives images
// time to re-load before the user can reach them. Tighter margins (8/6)
// were tried and landed hard flings on unrestored placeholders too often;
// the real memory win is the BACKGROUND clamp anyway — the aggressive
// margin applied while the page is hidden, which is exactly the window
// where iOS picks its jetsam victims.
const SCROLL_RESTORE_SCREENS = 10;
const SCROLL_SHRINK_SCREENS = 14;
const BACKGROUND_KEEP_SCREENS = 2;

const SETTLE_DELAY_MS = 200;

// Settle phase 1 restores only this close band around the viewport — a
// small commit that paints fast; phase 2 does the full pass just after.
const SETTLE_NEAR_SCREENS = 3;
const SETTLE_PHASE2_DELAY_MS = 100;

const articles = new Set<ShrinkableArticle>();
let listening = false;
let sweepScheduled = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let sweepGeneration = 0;

const sweep = (restoreScreens: number, shrinkScreens: number) => {
  articles.forEach((article) => {
    article.epsilonEvaluateShrink(restoreScreens, shrinkScreens);
  });
};

// WebKit has no reliable requestIdleCallback (and idle time can starve
// during momentum scrolling); a short timeout keeps the sweep out of the
// scroll frame and is guaranteed to fire.
const scheduleIdle = (callback: () => void) => {
  setTimeout(callback, 150);
};

const scheduleSweep = () => {
  // WebKit scrolling is asynchronous: while a fling is in flight, the
  // geometry JS can measure lags the visual position by up to several
  // screens. Decisions taken mid-flight are therefore split by risk:
  //
  // - Mid-flight sweeps RESTORE ONLY (shrink margin = Infinity). Restoring
  //   on stale geometry is harmless — at worst too much is re-rendered,
  //   never the wrong thing un-rendered under the user's eyes.
  // - The settle sweep, once scrolling has actually stopped and geometry is
  //   exact, does the full pass — it is the only place un-rendering (and
  //   its height/gap measurements) ever happens.

  sweepGeneration += 1;
  const generation = sweepGeneration;

  if (settleTimer !== null) {
    clearTimeout(settleTimer);
  }
  settleTimer = setTimeout(() => {
    settleTimer = null;

    // Phase 1: snap the band around the viewport back first — after a hard
    // fling lands on placeholders, this small commit paints fast.
    sweep(SETTLE_NEAR_SCREENS, Number.POSITIVE_INFINITY);

    // Phase 2: the full pass — and the only place un-rendering happens.
    // Skipped if scrolling resumed meanwhile (geometry stale again); the
    // new activity has already re-armed its own settle.
    setTimeout(() => {
      if (generation === sweepGeneration) {
        sweep(SCROLL_RESTORE_SCREENS, SCROLL_SHRINK_SCREENS);
      }
    }, SETTLE_PHASE2_DELAY_MS);
  }, SETTLE_DELAY_MS);

  if (sweepScheduled) {
    return;
  }

  sweepScheduled = true;

  scheduleIdle(() => {
    sweepScheduled = false;
    sweep(SCROLL_RESTORE_SCREENS, Number.POSITIVE_INFINITY);
  });
};

const handleScroll = () => {
  if (articles.size > 0) {
    scheduleSweep();
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    // Synchronous: JS gets suspended shortly after the page is hidden, the
    // shrink must land before that.
    sweep(BACKGROUND_KEEP_SCREENS, BACKGROUND_KEEP_SCREENS);
  } else {
    sweep(SCROLL_RESTORE_SCREENS, SCROLL_SHRINK_SCREENS);
  }
};

export const registerShrinkableArticle = (
  article: ShrinkableArticle,
): (() => void) => {
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Capture phase: scroll events don't bubble, but they do capture — this
    // sees scrolling on the document and on any overflow container alike.
    document.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    });
  }

  articles.add(article);

  // Bound a freshly (re)mounted feed without waiting for a scroll; the
  // settle debounce coalesces a whole registration burst into one sweep.
  scheduleSweep();

  return () => {
    articles.delete(article);
  };
};
