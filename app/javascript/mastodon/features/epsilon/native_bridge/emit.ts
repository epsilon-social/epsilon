// Bridge to the Expo shell: post messages to the native layer when running
// inside the WebView. `window.ReactNativeWebView` only exists in the WebView,
// so every call is feature-detected and is a complete no-op in real browsers.

interface NativeMessage {
  type: string;
  payload: Record<string, unknown>;
}

interface ReactNativeWebView {
  postMessage: (message: string) => void;
}

declare global {
  interface Window {
    ReactNativeWebView?: ReactNativeWebView;
  }
}

const postToNative = (message: NativeMessage): void => {
  const bridge = window.ReactNativeWebView;

  if (bridge && typeof bridge.postMessage === 'function') {
    bridge.postMessage(JSON.stringify(message));
  }
};

// Sources are free-form strings (the native side accepts arbitrary names).
// Named sources in use: navigation, compose, logout, report, block, mute,
// filter, domain-block, media-viewer, post-actions, profile-actions — plus a
// kebab-cased fallback derived from any other modalType (see native_bridge).

// Which overlay sources are currently open. Kept so we can tell the native side
// to restore the tab bar if the SPA is torn down without emitting the matching
// close — e.g. a full-page navigation to a Rails page like /settings/* leaves
// the sidebar's `visible:true` unbalanced (the SPA unmounts, no React cleanup
// runs), and the native tab bar stays hidden. See the pagehide/pageshow handlers
// in native_bridge.
const activeSources = new Set<string>();

// Emitted on open AND close, one signal per source: the native side aggregates
// sources independently, so we never send a global counter.
export const emitWebOverlay = (source: string, visible: boolean): void => {
  if (visible) {
    activeSources.add(source);
  } else {
    activeSources.delete(source);
  }

  postToNative({ type: 'epsilon:web-overlay', payload: { visible, source } });
};

// On page teardown (full-page nav / unload), re-send a close for every overlay
// still open so the native side restores the tab bar. The Set is left intact so
// a bfcache restore (pageshow) can re-assert them.
export const closeActiveOverlays = (): void => {
  activeSources.forEach((source) => {
    postToNative({
      type: 'epsilon:web-overlay',
      payload: { visible: false, source },
    });
  });
};

// On bfcache restore, re-assert the overlays that are still open in the DOM.
export const reopenActiveOverlays = (): void => {
  activeSources.forEach((source) => {
    postToNative({
      type: 'epsilon:web-overlay',
      payload: { visible: true, source },
    });
  });
};
