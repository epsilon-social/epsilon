import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Globals } from '@react-spring/web';

import * as perf from '@/mastodon/utils/performance';
import { setupBrowserNotifications } from 'mastodon/actions/notifications';
import Mastodon from 'mastodon/containers/mastodon';
import { me, reduceMotion } from 'mastodon/initial_state';
import ready from 'mastodon/ready';
import { store } from 'mastodon/store';

import { isDevelopment, isProduction } from './utils/environment';

function main() {
  perf.start('main()');

  return ready(async () => {
    const mountNode = document.getElementById('mastodon');
    if (!mountNode) {
      throw new Error('Mount node not found');
    }
    const props = JSON.parse(
      mountNode.getAttribute('data-props') ?? '{}',
    ) as Record<string, unknown>;

    if (reduceMotion) {
      Globals.assign({
        skipAnimation: true,
      });
    }

    const { initializeEmoji } = await import('./features/emoji/index');
    await initializeEmoji();

    const root = createRoot(mountNode);
    root.render(
      <StrictMode>
        <Mastodon {...props} />
      </StrictMode>,
    );
    store.dispatch(setupBrowserNotifications());

    // ==========================================
    // EPSILON : SERVICE WORKER — DÉSACTIVÉ EN IN-APP
    // Dans la coque WKWebView, le SW peut servir un shell d'app périmé depuis son
    // cache. Le push n'en dépend pas non plus (WKWebView ne supporte pas le Web
    // Push, et le push in-app passe par le relais APNs natif). On ne l'enregistre
    // donc pas in-app, et on démonte tout SW + caches « mastodon-* » laissés par
    // un build précédent (les testeurs actuels en ont un d'installé).
    // ==========================================
    const epsilonInApp =
      document.documentElement.classList.contains('epsilon-in-app');

    if (epsilonInApp) {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            registrations.forEach((registration) => {
              void registration.unregister();
            });
          });
      }

      if ('caches' in window) {
        void caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith('mastodon-'))
            .forEach((key) => {
              void caches.delete(key);
            });
        });
      }
    } else if (
      me &&
      'serviceWorker' in navigator &&
      (isDevelopment() || isProduction()) // Disallow testing environment
    ) {
      let swPath = '/sw.js';
      if (isDevelopment()) {
        const { default: swDevUrl } =
          await import('@/mastodon/service_worker/sw?url');
        swPath = swDevUrl;
      }

      await navigator.serviceWorker.register(swPath, {
        scope: '/',
        type: 'module',
      });

      if (isProduction()) {
        if ('Notification' in window && Notification.permission === 'granted') {
          const registerPushNotifications =
            await import('mastodon/actions/push_notifications');

          store.dispatch(registerPushNotifications.register());
        }
      }
    }

    perf.stop('main()');
  });
}

// eslint-disable-next-line import/no-default-export
export default main;
