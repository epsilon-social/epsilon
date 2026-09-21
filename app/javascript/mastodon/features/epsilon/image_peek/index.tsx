import { useEffect } from 'react';

// In-app only (WKWebView): peek a feed/profile image by pinching it, Instagram
// style — it lifts above the feed, follows the fingers, and springs back to its
// place on release. Relies on the Safari-only gesture events (native `scale` +
// midpoint), the same ones ZoomableImage uses. On the web this mounts nothing.
const IN_APP =
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('epsilon-in-app');

const MAX_SCALE = 3;
const SETTLE_MS = 260;
const MAX_BACKDROP_OPACITY = 0.7;

// The WebKit gesture events are not in every TS DOM lib config; type loosely.
type PinchGestureEvent = Event & {
  scale: number;
  clientX: number;
  clientY: number;
};

export const EpsilonImagePeek: React.FC = () => {
  useEffect(() => {
    if (!IN_APP) {
      return undefined;
    }

    let backdrop: HTMLDivElement | null = null;
    let clone: HTMLImageElement | null = null;
    let source: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let active = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const teardown = () => {
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      clone?.remove();
      backdrop?.remove();
      if (source) {
        source.style.visibility = '';
      }
      clone = null;
      backdrop = null;
      source = null;
      active = false;
    };

    const handleStart = (event: PinchGestureEvent) => {
      // In-app we are the single authority for pinch gestures: swallow every
      // one so WKWebView can never sticky-zoom the page (on avatars, text, …).
      // The peek itself only runs when the pinch lands on a media image.
      event.preventDefault();

      const target = event.target as HTMLElement | null;
      const item = target?.closest('.media-gallery__item');
      const img = item?.querySelector<HTMLImageElement>('img');

      // No <img> (e.g. an avatar, a video/gifv item) or not yet loaded → the
      // gesture is already swallowed above; just don't start a peek.
      if (!img?.currentSrc) {
        return;
      }

      // Drop any peek still settling, then stand a clone over the source.
      teardown();
      active = true;
      source = img;
      startX = event.clientX;
      startY = event.clientY;

      const rect = img.getBoundingClientRect();
      const computed = window.getComputedStyle(img);

      backdrop = document.createElement('div');
      backdrop.className = 'epsilon-image-peek__backdrop';
      document.body.appendChild(backdrop);

      clone = document.createElement('img');
      clone.className = 'epsilon-image-peek__clone';
      clone.src = img.currentSrc;
      clone.style.top = `${rect.top}px`;
      clone.style.left = `${rect.left}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.height = `${rect.height}px`;
      clone.style.objectFit = computed.objectFit || 'cover';
      clone.style.objectPosition = computed.objectPosition || 'center';
      document.body.appendChild(clone);

      // Hide the original while the clone stands in (seamless at scale 1).
      img.style.visibility = 'hidden';
    };

    const handleChange = (event: PinchGestureEvent) => {
      // Always swallow the gesture (see handleStart); only drive a live peek.
      event.preventDefault();

      if (!active || !clone || !backdrop) {
        return;
      }

      const scale = Math.min(Math.max(event.scale, 1), MAX_SCALE);
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;

      const progress = (scale - 1) / (MAX_SCALE - 1);
      backdrop.style.opacity = `${Math.min(progress, 1) * MAX_BACKDROP_OPACITY}`;
    };

    const handleEnd = (event: PinchGestureEvent) => {
      // Always swallow the gesture (see handleStart); only settle a live peek.
      event.preventDefault();

      if (!active || !clone || !backdrop) {
        return;
      }

      active = false;

      const settlingClone = clone;
      const settlingBackdrop = backdrop;
      const settlingSource = source;

      settlingClone.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      settlingBackdrop.style.transition = `opacity ${SETTLE_MS}ms ease`;
      // Commit the current transform before switching to the eased target.
      void settlingClone.offsetWidth;
      settlingClone.style.transform = 'translate(0px, 0px) scale(1)';
      settlingBackdrop.style.opacity = '0';

      settleTimer = setTimeout(() => {
        settlingClone.remove();
        settlingBackdrop.remove();
        if (settlingSource) {
          settlingSource.style.visibility = '';
        }
        if (clone === settlingClone) {
          clone = null;
        }
        if (backdrop === settlingBackdrop) {
          backdrop = null;
        }
        if (source === settlingSource) {
          source = null;
        }
        settleTimer = null;
      }, SETTLE_MS + 30);
    };

    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener(
      'gesturestart',
      handleStart as EventListener,
      opts,
    );
    document.addEventListener(
      'gesturechange',
      handleChange as EventListener,
      opts,
    );
    document.addEventListener('gestureend', handleEnd as EventListener, opts);

    return () => {
      document.removeEventListener(
        'gesturestart',
        handleStart as EventListener,
      );
      document.removeEventListener(
        'gesturechange',
        handleChange as EventListener,
      );
      document.removeEventListener('gestureend', handleEnd as EventListener);
      teardown();
    };
  }, []);

  return null;
};
