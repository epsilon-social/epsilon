(function (element) {
  // Detect the Expo shell WebView via its custom User-Agent.
  // Only the stable prefix "EpsilonMobile/" is matched, never the version.
  if (navigator.userAgent.indexOf('EpsilonMobile/') !== -1) {
    element.classList.add('epsilon-in-app');
  }
})(document.documentElement);
