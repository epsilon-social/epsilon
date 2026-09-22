import { useEffect, useRef } from 'react';

import { openNavigation } from 'mastodon/actions/navigation';
import { useEpsilonCompose } from 'mastodon/features/epsilon/compose_modal';
import { useIdentity } from 'mastodon/identity_context';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import {
  emitWebOverlay,
  closeActiveOverlays,
  reopenActiveOverlays,
} from './emit';

// Named sources for the overlays the native side cares about. Everything else
// that opens in the modal stack falls back to a kebab-cased modalType, so a new
// modal can never be silently missed (the native side ignores what it doesn't
// handle). ACTIONS is resolved from modalProps.overlaySource — the ⋯ menus of a
// post vs a profile share the same modalType.
const MODAL_TYPE_TO_SOURCE: Record<string, string> = {
  CONFIRM_LOG_OUT: 'logout',
  REPORT: 'report',
  BLOCK: 'block',
  MUTE: 'mute', // moderation action — parallel to block/report (Apple 1.2)
  FILTER: 'filter',
  DOMAIN_BLOCK: 'domain-block',
  MEDIA: 'media-viewer',
  IMAGE: 'media-viewer',
  VIDEO: 'media-viewer',
  AUDIO: 'media-viewer',
};

const kebabCase = (modalType: string) =>
  modalType.toLowerCase().replace(/_/g, '-');

const sourceForModal = (modal: { get: (key: string) => unknown }): string => {
  const props = modal.get('modalProps') as
    | { overlaySource?: unknown }
    | undefined;

  if (typeof props?.overlaySource === 'string' && props.overlaySource) {
    return props.overlaySource;
  }

  const modalType = modal.get('modalType') as string;
  return MODAL_TYPE_TO_SOURCE[modalType] ?? kebabCase(modalType);
};

// Emit epsilon:web-overlay whenever a single-source overlay transitions
// open <-> closed. Never emits the initial (mounted, closed) state.
const useOverlayEmitter = (source: string, visible: boolean): void => {
  const previous = useRef(visible);

  useEffect(() => {
    if (previous.current !== visible) {
      previous.current = visible;
      emitWebOverlay(source, visible);
    }
  }, [source, visible]);
};

export const EpsilonNativeBridge: React.FC = () => {
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();
  // Reuse the exact entry point the "New Post" buttons use (sidebar + top
  // navbar): the home-made compose overlay lives in a React context, not a
  // Redux modal. The bridge is mounted inside EpsilonComposeProvider, so the
  // hook resolves here.
  const { openCompose } = useEpsilonCompose();

  // ── Native -> web: open the sidebar / compose on demand ──────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // This listener receives ALL window messages, including from third-party
      // iframes. Guard hard: string data only, safe parse, ignore anything
      // whose type does not start with "epsilon:".
      if (typeof event.data !== 'string') {
        return;
      }

      let message: unknown;

      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (
        typeof message !== 'object' ||
        message === null ||
        !('type' in message) ||
        typeof message.type !== 'string' ||
        !message.type.startsWith('epsilon:')
      ) {
        return;
      }

      if (message.type === 'epsilon:open-menu') {
        // Reuse the existing navigation action — no new route, no simulated click.
        dispatch(openNavigation());
      } else if (message.type === 'epsilon:compose') {
        // The native "New Post" tab is a button, not a destination: open the
        // compose overlay via the same action as the on-screen buttons.
        // Gated on signedIn to match those buttons (hidden for guests); a
        // guest message is ignored. openCompose is idempotent — re-firing it
        // while the overlay is open is a no-op and never touches the draft.
        //
        // Defer one frame: unlike a React onClick, this fires from a native
        // `message` task, so iOS WebKit paints the modal at its final state for
        // one frame before the entrance animation binds (visible flash — the
        // on-screen buttons don't show it). A rAF lets the mount + the
        // animation's initial state commit together on a clean frame.
        if (signedIn) {
          requestAnimationFrame(() => {
            openCompose();
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [dispatch, openCompose, signedIn]);

  // ── Page teardown: balance the overlay signals ───────────────────────────
  // A full-page navigation (e.g. to a Rails /settings/* page) tears down the SPA
  // without running React cleanup, so any open overlay never emits its close and
  // the native tab bar stays hidden. Emit the closes on pagehide; re-assert on a
  // bfcache restore (pageshow with persisted).
  useEffect(() => {
    const handlePageHide = () => {
      closeActiveOverlays();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        reopenActiveOverlays();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // ── Web -> native: sidebar lives in its own Redux slice ──────────────────
  const navigationOpen = useAppSelector((state) => state.navigation.open);
  useOverlayEmitter('navigation', navigationOpen);

  // ── Web -> native: every native modal flows through one stack ────────────
  // We observe the whole stack generically (not a hardcoded list) so no overlay
  // is ever missed, emitting one signal per source on each open/close.
  const modalStack = useAppSelector((state) => state.modal.get('stack'));
  const previousSources = useRef<Set<string>>(new Set());

  useEffect(() => {
    const active = new Set<string>();
    modalStack.forEach((modal) => {
      active.add(sourceForModal(modal));
    });

    const previous = previousSources.current;
    active.forEach((source) => {
      if (!previous.has(source)) {
        emitWebOverlay(source, true);
      }
    });
    previous.forEach((source) => {
      if (!active.has(source)) {
        emitWebOverlay(source, false);
      }
    });

    previousSources.current = active;
  }, [modalStack]);

  return null;
};
