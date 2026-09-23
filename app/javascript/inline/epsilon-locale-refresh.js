(function () {
  'use strict';

  // EPSILON — live UI-locale refresh inside the native shell.
  //
  // The iOS shell keeps one persistent WebView per tab (4 total) and never
  // reloads them on tab switch or foreground; back navigation is history.go(-1)
  // (a bfcache restore, not a reload). The React app reads its UI locale ONCE at
  // boot from <html lang>, which the server bakes from user.locale. So changing
  // the language — a full server render on the settings page — only updates the
  // tab that rendered it; the other tabs (and any bfcache-restored page) stay on
  // the old locale until the app is killed and relaunched.
  //
  // Fix (web-only, no native change): treat the freshly-rendered <html lang> as
  // the source of truth, mirror it into localStorage (shared across all same-
  // origin WebViews) plus a cookie, and broadcast the change. Any page whose
  // baked lang differs from that shared truth reloads itself — instantly in the
  // other tabs (storage / BroadcastChannel), on bfcache restore (pageshow), or
  // when the tab next becomes visible or is touched.

  // In-app only: this whole dance exists for the persistent-WebView shell. Web
  // and PWA users get a normal reload-on-navigation and are left untouched.
  if (navigator.userAgent.indexOf('EpsilonMobile/') === -1) {
    return;
  }

  var KEY = 'epsilon_ui_locale';

  // A ?lang= override is a deliberate, transient preview (e.g. the logged-out
  // language switcher). Don't treat it as the user's preference, and don't fight
  // it with reloads.
  var hasLangOverride = /[?&]lang=/.test(window.location.search);

  // Captured at first execution and closed over, so it stays correct even after
  // a bfcache restore (where this script does NOT re-run but the DOM — and thus
  // <html lang> — is preserved).
  var renderedLang = (document.documentElement.getAttribute('lang') || '').trim();

  function readCookie() {
    var match = document.cookie.match(/(?:^|;\s*)epsilon_ui_locale=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function readStore() {
    try {
      return window.localStorage.getItem(KEY) || '';
    } catch (e) {
      return '';
    }
  }

  // Freshest known "what the server would render now": localStorage is written
  // by the most recent full render across any tab; the cookie is the fallback in
  // case cross-WebView localStorage isn't shared on a given WebKit build.
  function truthLocale() {
    return readStore() || readCookie();
  }

  // Loop guard: if a reload for a given target locale didn't actually change
  // <html lang> (e.g. offline — the navigation hits the network and fails, never
  // the shell cache), don't keep re-firing on every tap. Remember the last
  // reload target per tab (sessionStorage survives a reload within the same tab)
  // and suppress a repeat for the same target within a short window; after it,
  // one more attempt is allowed so a reconnect can still recover.
  var RELOAD_MARK = KEY + '_reload';
  var RELOAD_SUPPRESS_MS = 8000;

  function recentlyTried(target) {
    try {
      var raw = window.sessionStorage.getItem(RELOAD_MARK);
      if (!raw) {
        return false;
      }
      var sep = raw.lastIndexOf('|');
      return (
        raw.slice(0, sep) === target &&
        Date.now() - parseInt(raw.slice(sep + 1), 10) < RELOAD_SUPPRESS_MS
      );
    } catch (e) {
      return false;
    }
  }

  var reloading = false;
  function reloadIfStale() {
    if (reloading || hasLangOverride || !renderedLang) {
      return;
    }
    var truth = truthLocale();
    if (truth && truth !== renderedLang && !recentlyTried(truth)) {
      reloading = true;
      try {
        window.sessionStorage.setItem(RELOAD_MARK, truth + '|' + Date.now());
      } catch (e) {
        /* ignore */
      }
      window.location.reload();
    }
  }

  // On a FRESH render (this runs only on real loads, never on bfcache restore),
  // publish the just-rendered locale as the new shared truth. Writing an
  // unchanged value is a no-op and fires no storage event, so ordinary browsing
  // never churns the other tabs — only an actual language change does.
  if (renderedLang && !hasLangOverride) {
    var previous = readStore();

    document.cookie =
      KEY + '=' + encodeURIComponent(renderedLang) + ';path=/;max-age=31536000;samesite=Lax';
    try {
      window.localStorage.setItem(KEY, renderedLang);
    } catch (e) {
      /* private mode / storage disabled — cookie still carries the truth */
    }

    if (previous && previous !== renderedLang && typeof BroadcastChannel === 'function') {
      try {
        var out = new BroadcastChannel(KEY);
        out.postMessage(renderedLang);
        out.close();
      } catch (e) {
        /* ignore */
      }
    }
  }

  // Other tabs: react the instant the shared truth changes.
  window.addEventListener('storage', function (event) {
    if (event.key === KEY) {
      reloadIfStale();
    }
  });

  if (typeof BroadcastChannel === 'function') {
    try {
      new BroadcastChannel(KEY).addEventListener('message', reloadIfStale);
    } catch (e) {
      /* ignore */
    }
  }

  // Coverage for WebKit builds where cross-WebView events don't reach a
  // backgrounded tab: re-check when it comes forward, is restored from bfcache,
  // or is first touched.
  window.addEventListener('pageshow', reloadIfStale);
  window.addEventListener('focus', reloadIfStale);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      reloadIfStale();
    }
  });
  document.addEventListener('pointerdown', reloadIfStale, { passive: true });
})();
