(function (element) {
  // Detect the Expo shell WebView via its custom User-Agent.
  // Only the stable prefix "EpsilonMobile/" is matched, never the version.
  if (navigator.userAgent.indexOf('EpsilonMobile/') === -1) {
    return;
  }

  element.classList.add('epsilon-in-app');

  // In-app (WKWebView), clamp the resting zoom floor to 1.0 so the page can't
  // sit below the viewport. minimum-scale only — we never use maximum-scale /
  // user-scalable=no (which Apple flags). Web users are untouched: this runs
  // only in-app.
  var viewport = document.querySelector('meta[name="viewport"]');

  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover');
  }

  // WKWebView treats the viewport scale bounds as soft (a pinch rubber-bands
  // past them), so minimum-scale alone can't stop the page floating over the
  // shell background during the gesture. We cancel the WebKit pinch events to
  // disable page zoom outright — like a native app. Images stay zoomable: the
  // media viewer (ZoomableImage) runs its own transform-based zoom and already
  // cancels these same events, so tapping a photo → pinch still works.
  var preventGesture = function (event) {
    event.preventDefault();
  };

  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });
})(document.documentElement);
