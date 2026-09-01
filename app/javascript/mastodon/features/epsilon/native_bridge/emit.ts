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

// Emitted on open AND close, one signal per source: the native side aggregates
// sources independently, so we never send a global counter.
export const emitWebOverlay = (source: string, visible: boolean): void => {
  postToNative({ type: 'epsilon:web-overlay', payload: { visible, source } });
};
