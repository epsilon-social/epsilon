import { useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';
import PropTypes from 'prop-types';

import { useDispatch } from 'react-redux';

import { expandHomeTimeline } from 'mastodon/actions/timelines';

// Pull-to-refresh natif-like pour le feed home in-app. Wrapper : on translate le
// CONTENU (compose + fil) vers le bas en suivant le doigt (geste iOS), et la roue
// apparaît dans le gap qui s'ouvre au-dessus (entre la barre de recherche et le
// compose). La coque scrolle le document → on écoute le geste sur window ; le
// listener touchmove non-passif n'est attaché QUE pendant un geste démarré en
// haut (scrollY 0) → aucun impact sur le scroll normal. will-change n'est posé
// que le temps du geste (le fil n'est pas virtualisé in-app = gros calque).

const THRESHOLD = 64; // tirage (px) pour armer le refresh
const RESTING = 56; // gap conservé pendant le refresh (la roue tient dedans)
const MAX_PULL = 130; // tirage max (rubber-band)
const ICON = 28; // taille visuelle de la roue (cf. pull_to_refresh.scss)
const MIN_SPIN_MS = 650; // durée mini d'affichage (évite le flash)

// Résistance : 1:1 jusqu'au seuil, puis rubber-band au-delà.
const rubber = (raw) => {
  if (raw <= THRESHOLD) {
    return raw;
  }
  return Math.min(THRESHOLD + (raw - THRESHOLD) * 0.4, MAX_PULL);
};

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

const SETTLE =
  'transform 0.34s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease';

export const EpsilonPullToRefresh = ({ children }) => {
  const dispatch = useDispatch();
  const contentRef = useRef(null);
  const indicatorRef = useRef(null);
  const iconRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullRef = useRef(0);
  const rafRef = useRef(0);
  const refreshingRef = useRef(false);
  const decidedRef = useRef(null); // null | 'pull' | 'scroll' (verrou de direction)

  const setWillChange = useCallback((on) => {
    if (contentRef.current) {
      contentRef.current.style.willChange = on ? 'transform' : '';
    }
  }, []);

  // Peinture 1:1 pendant le drag (impérative, pas de re-render React).
  const paint = useCallback(() => {
    rafRef.current = 0;
    const c = contentRef.current;
    const ind = indicatorRef.current;
    const ic = iconRef.current;
    const pull = pullRef.current;
    const progress = Math.min(pull / THRESHOLD, 1);
    if (c) {
      c.style.transition = 'none';
      c.style.transform = `translate3d(0, ${pull}px, 0)`;
    }
    if (ind) {
      ind.style.transition = 'none';
      ind.style.opacity = String(Math.min(progress * 1.3, 1));
      ind.style.transform = `translate3d(0, ${Math.max(0, (pull - ICON) / 2)}px, 0)`;
    }
    if (ic) {
      ic.style.transform = `rotate(${progress * 300}deg)`;
    }
  }, []);

  const requestPaint = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(paint);
    }
  }, [paint]);

  // Anime (ressort) le contenu + la roue vers une cible.
  const animateTo = useCallback((contentY, indicatorOpacity) => {
    // Annule un repaint 1:1 encore en attente : sinon il tournerait APRÈS et
    // écraserait l'animation (transition:none + dernière position du doigt) →
    // saut/téléport au lâcher au lieu du ressort.
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const c = contentRef.current;
    const ind = indicatorRef.current;
    if (c) {
      c.style.transition = SETTLE;
      c.style.transform = `translate3d(0, ${contentY}px, 0)`;
    }
    if (ind) {
      ind.style.transition = SETTLE;
      ind.style.opacity = String(indicatorOpacity);
      ind.style.transform = `translate3d(0, ${Math.max(0, (contentY - ICON) / 2)}px, 0)`;
    }
  }, []);

  const finishRefresh = useCallback(() => {
    refreshingRef.current = false;
    setRefreshing(false);
    pullRef.current = 0;
    pullingRef.current = false;
    animateTo(0, 0); // retour ressort + fondu
    window.setTimeout(() => setWillChange(false), 360);
  }, [animateTo, setWillChange]);

  const triggerRefresh = useCallback(() => {
    refreshingRef.current = true;
    setRefreshing(true);
    if (iconRef.current) {
      iconRef.current.style.transform = ''; // le spin CSS prend le relais
    }
    animateTo(RESTING, 1); // le contenu reste poussé, la roue tourne dans le gap
    const started = now();
    Promise.resolve(dispatch(expandHomeTimeline())).finally(() => {
      const wait = Math.max(0, MIN_SPIN_MS - (now() - started));
      window.setTimeout(finishRefresh, wait);
    });
  }, [animateTo, dispatch, finishRefresh]);

  const cancelPull = useCallback(() => {
    pullRef.current = 0;
    pullingRef.current = false;
    animateTo(0, 0);
    window.setTimeout(() => setWillChange(false), 360);
  }, [animateTo, setWillChange]);

  useEffect(() => {
    const overlayOpen = () =>
      !!document.querySelector('.modal-root__overlay, .epsilon-compose-overlay');

    const onTouchMove = (e) => {
      if (refreshingRef.current || decidedRef.current === 'scroll') {
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;

      // Hystérésis : on attend ~6px avant de décider de la direction, pour ne pas
      // « voler » le toucher sur un micro-jitter vers le bas (sinon preventDefault
      // fige le scroll natif pour tout le reste du geste → « il faut réessayer »).
      if (decidedRef.current === null) {
        if (Math.abs(dy) < 6) {
          return;
        }
        if (dy > 0 && window.scrollY <= 0) {
          decidedRef.current = 'pull';
          setWillChange(true);
        } else {
          // Scroll : on se retire complètement → le natif gère sans « collant ».
          decidedRef.current = 'scroll';
          window.removeEventListener('touchmove', onTouchMove);
          return;
        }
      }

      // decidedRef === 'pull'
      if (window.scrollY > 0) {
        decidedRef.current = 'scroll';
        pullingRef.current = false;
        pullRef.current = 0;
        window.removeEventListener('touchmove', onTouchMove);
        requestPaint();
        return;
      }
      e.preventDefault();
      pullingRef.current = true;
      pullRef.current = Math.max(0, rubber(dy));
      requestPaint();
    };

    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      decidedRef.current = null;
      if (!pullingRef.current) {
        return;
      }
      const pulled = pullRef.current;
      pullingRef.current = false;
      if (pulled >= THRESHOLD) {
        triggerRefresh();
      } else {
        cancelPull();
      }
    };

    const onTouchStart = (e) => {
      if (refreshingRef.current || window.scrollY > 0 || overlayOpen()) {
        return;
      }
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
      decidedRef.current = null;
      window.addEventListener('touchmove', onTouchMove, { passive: false });
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('touchmove', onTouchMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [requestPaint, triggerRefresh, cancelPull, setWillChange]);

  return (
    <div
      className={classNames('epsilon-ptr', {
        'epsilon-ptr--refreshing': refreshing,
      })}
    >
      <div className='epsilon-ptr__indicator' ref={indicatorRef} aria-hidden='true'>
        <div className='epsilon-ptr__icon' ref={iconRef} />
      </div>
      <div className='epsilon-ptr__content' ref={contentRef}>
        {children}
      </div>
    </div>
  );
};

EpsilonPullToRefresh.propTypes = {
  children: PropTypes.node,
};

export default EpsilonPullToRefresh;
