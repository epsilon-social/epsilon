import { useEffect, useRef } from 'react';

import { openNavigation } from 'mastodon/actions/navigation';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { emitWebOverlay } from './emit';

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

  // ── Native -> web: open the sidebar on demand ────────────────────────────
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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [dispatch]);

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
