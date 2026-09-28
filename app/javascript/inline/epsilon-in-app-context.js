(function (element) {
  // Match the Expo shell WebView by its custom User-Agent prefix.
  if (navigator.userAgent.indexOf('EpsilonMobile/') === -1) {
    return;
  }

  element.classList.add('epsilon-in-app');

  // Clamp the zoom floor to 1.0 (minimum-scale only; never maximum-scale /
  // user-scalable=no, which Apple flags).
  var viewport = document.querySelector('meta[name="viewport"]');

  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover');
  }

  // WebKit-only zoom guards (iOS). Chromium (Android WebView) has no
  // GestureEvent and the non-passive touchmove would only break its scrolling.
  // Detect the capability, not the UA. `epsilon-in-app` stays on both platforms.
  if (typeof window.GestureEvent !== 'undefined') {
    // WebKit-only styling hook (e.g. `overflow-x: clip`, which breaks scrolling
    // in Chromium). Kept separate from `epsilon-in-app` so CSS can target iOS.
    element.classList.add('epsilon-in-app-webkit');

    // Cancel the WebKit pinch events to disable page zoom. The media viewer
    // runs its own transform zoom, so images stay zoomable there.
    var preventGesture = function (event) {
      event.preventDefault();
    };

    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });

    // A second finger landing mid-scroll starts a pinch without a fresh
    // gesturestart. iOS fixes cancelability at sequence start, so this must be
    // permanent and non-passive. Cancels 2+ finger moves only; scroll passes.
    var preventMultiTouchZoom = function (event) {
      if (event.touches.length < 2) {
        return;
      }

      var node = event.target;
      if (node && node.closest && node.closest('.zoomable-image')) {
        return;
      }

      event.preventDefault();
    };

    document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false });
  }
})(document.documentElement);
