import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, FC, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';

import { FormattedDate, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import type { List as ImmutableList } from 'immutable';

import type {
  OffsetValue,
  UsePopperOptions,
} from 'react-overlays/esm/usePopper';
import Overlay from 'react-overlays/Overlay';

import type { Account, EpsilonBadge } from '@/mastodon/models/account';

// Every Material Symbol available in the shared folder, as a slug -> URL map, so
// a badge can use any icon the admin picked. URLs only (no component code), so
// the bundle stays light; the color tint is done with a CSS mask.
const iconUrls = import.meta.glob<string>(
  '../../../material-icons/400-24px/*.svg',
  { eager: true, import: 'default', query: '?url' },
);

const ICON_URL_BY_SLUG: Record<string, string> = {};
for (const [path, url] of Object.entries(iconUrls)) {
  const slug = path.slice(path.lastIndexOf('/') + 1, -'.svg'.length);
  ICON_URL_BY_SLUG[slug] = url;
}

const FALLBACK_ICON = 'license-fill';

const resolveIconUrl = (slug: string): string =>
  ICON_URL_BY_SLUG[slug] ?? ICON_URL_BY_SLUG[FALLBACK_ICON] ?? '';

interface Props {
  account?: Account;
  className?: string;
  // `inline`: profile header — shows every badge.
  // `compact`: posts / left sidebar (next to the name) — shows up to two badges,
  // then a "+N" hover popover listing them all.
  variant?: 'inline' | 'compact';
}

const offset = [0, 6] as OffsetValue;
const popperConfig = { strategy: 'fixed' } as UsePopperOptions;

// Max badges shown inline on the profile before collapsing into a "+N" popover.
const MAX_INLINE_BADGES = 2;

// Short hover delay so popovers don't flash when the cursor just passes over.
const SHOW_DELAY_MS = 500;
// Grace period when leaving, so the cursor can bridge the gap to the popover.
const CLOSE_DELAY_MS = 250;

// Opens after a short hover, closes immediately on leave. For non-interactive
// tooltips (single badge) — no need to reach into them.
function useDelayedHover() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setOpen(true);
    }, SHOW_DELAY_MS);
  }, [clearTimer]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { open, show, hide };
}

// Like useDelayedHover, but stays open while the cursor is over the trigger OR
// the popover (a "hover bridge"), so an interactive/scrollable popover can be
// reached. `keepOpen` cancels a pending close (call it on popover mouse-enter).
function useHoverBridge() {
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  const clearOpen = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);
  const clearClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearClose();
    if (openTimer.current) return;
    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      setOpen(true);
    }, SHOW_DELAY_MS);
  }, [clearClose]);

  const scheduleClose = useCallback(() => {
    clearOpen();
    if (closeTimer.current) return;
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [clearOpen]);

  useEffect(
    () => () => {
      clearOpen();
      clearClose();
    },
    [clearOpen, clearClose],
  );

  return { open, scheduleOpen, scheduleClose, keepOpen: clearClose };
}

// True on touch devices (no hover) — iOS app (WKWebView) and mobile web alike.
// There, popovers must open on tap instead of hover.
function useIsTouch(): boolean {
  const [isTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none)').matches,
  );
  return isTouch;
}

// Tap-to-toggle for touch. Prevents the surrounding link/row from navigating so
// the popover opens instead. On desktop it's a no-op (hover handles it, and a
// click keeps navigating as before).
function useTapToggle(isTouch: boolean) {
  const [tapOpen, setTapOpen] = useState(false);

  const toggle = useCallback(
    (event: ReactMouseEvent) => {
      if (!isTouch) return;
      event.preventDefault();
      event.stopPropagation();
      setTapOpen((value) => !value);
    },
    [isTouch],
  );

  const close = useCallback(() => {
    setTapOpen(false);
  }, []);

  return { tapOpen, toggle, close };
}

// Full-screen backdrop shown under a popover on touch. It captures the dismiss
// tap (so the element underneath is NOT clicked) and closes on a scroll gesture.
// Rendered in a portal so it isn't inside the popper's transformed container.
const TouchBackdrop: FC<{ onClose: () => void }> = ({ onClose }) => {
  const handleClick = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      onClose();
    },
    [onClose],
  );

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className='epsilon-badge-backdrop'
      onClick={handleClick}
      onTouchMove={onClose}
    />,
    document.body,
  );
};

// The colored, mask-tinted badge icon (any Material Symbol works).
const BadgeIcon: FC<{ badge: EpsilonBadge; className?: string }> = ({
  badge,
  className,
}) => {
  const iconUrl = resolveIconUrl(badge.get('icon'));
  return (
    <span
      className={classNames('epsilon-badge__icon', className)}
      style={
        {
          color: badge.get('color'),
          maskImage: `url("${iconUrl}")`,
          WebkitMaskImage: `url("${iconUrl}")`,
        } as CSSProperties
      }
    />
  );
};

// The tooltip/popover body for one badge: name + description + obtention date.
const BadgeDetails: FC<{ badge: EpsilonBadge }> = ({ badge }) => {
  const description = badge.get('description');
  const grantedAt = badge.get('granted_at');
  return (
    <>
      <strong>{badge.get('name')}</strong>
      {description && <p>{description}</p>}
      {grantedAt && (
        <p className='epsilon-badge__tooltip-date'>
          <FormattedMessage
            id='epsilon.badges.granted_on'
            defaultMessage='Obtained on {date}'
            values={{
              date: (
                <FormattedDate
                  value={grantedAt}
                  year='numeric'
                  month='long'
                  day='numeric'
                />
              ),
            }}
          />
        </p>
      )}
    </>
  );
};

// A single badge icon with a custom hover tooltip, rendered in a portal (fixed
// strategy) so it escapes the `overflow: hidden` on post headers. It stays a
// <span> (not a <button>) so it is valid inside the avatar link on posts.
const EpsilonBadgeItem: FC<{ badge: EpsilonBadge }> = ({ badge }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const isTouch = useIsTouch();
  const { open: hoverOpen, show, hide } = useDelayedHover();
  const { tapOpen, toggle, close } = useTapToggle(isTouch);
  const open = isTouch ? tapOpen : hoverOpen;

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <span
        ref={triggerRef}
        className='epsilon-badge'
        onMouseEnter={isTouch ? undefined : show}
        onMouseLeave={isTouch ? undefined : hide}
        onClick={toggle}
        aria-describedby={open ? tooltipId : undefined}
        role='img'
        aria-label={badge.get('name')}
      >
        <BadgeIcon badge={badge} />
      </span>

      {isTouch && open && <TouchBackdrop onClose={close} />}

      <Overlay
        show={open}
        target={triggerRef}
        placement='top'
        flip
        offset={offset}
        popperConfig={popperConfig}
      >
        {({ props }) => (
          <div {...props} className='hover-card-controller'>
            <div
              id={tooltipId}
              role='tooltip'
              className='epsilon-badge__tooltip dropdown-animation'
            >
              <BadgeDetails badge={badge} />
            </div>
          </div>
        )}
      </Overlay>
    </>
  );
};

// A "+N" chip whose hover popover lists every badge the account carries.
const EpsilonBadgeMore: FC<{
  badges: ImmutableList<EpsilonBadge>;
  count: number;
}> = ({ badges, count }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();
  const isTouch = useIsTouch();
  const {
    open: hoverOpen,
    scheduleOpen,
    scheduleClose,
    keepOpen,
  } = useHoverBridge();
  const { tapOpen, toggle, close } = useTapToggle(isTouch);
  const open = isTouch ? tapOpen : hoverOpen;

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <span
        ref={triggerRef}
        className='epsilon-badge-more'
        onMouseEnter={isTouch ? undefined : scheduleOpen}
        onMouseLeave={isTouch ? undefined : scheduleClose}
        onClick={toggle}
        aria-describedby={open ? popoverId : undefined}
      >
        +{count}
      </span>

      {isTouch && open && <TouchBackdrop onClose={close} />}

      <Overlay
        show={open}
        target={triggerRef}
        placement='top'
        flip
        offset={offset}
        popperConfig={popperConfig}
      >
        {({ props }) => (
          <div {...props} className='hover-card-controller'>
            <div
              id={popoverId}
              role='tooltip'
              className='epsilon-badge__tooltip epsilon-badge-list dropdown-animation'
              onMouseEnter={isTouch ? undefined : keepOpen}
              onMouseLeave={isTouch ? undefined : scheduleClose}
            >
              {badges
                .map((badge) => (
                  <div
                    key={badge.get('id')}
                    className='epsilon-badge-list__item'
                  >
                    <BadgeIcon badge={badge} />
                    <div className='epsilon-badge-list__body'>
                      <BadgeDetails badge={badge} />
                    </div>
                  </div>
                ))
                .toArray()}
            </div>
          </div>
        )}
      </Overlay>
    </>
  );
};

// EPSILON : CERTIFIED ACCOUNTS / BADGES
// Renders the local-only certification badges carried by an account.
export const EpsilonBadges: FC<Props> = ({
  account,
  className,
  variant = 'inline',
}) => {
  if (!account) {
    return null;
  }

  const badges = account.get('epsilon_badges');

  if (badges.isEmpty()) {
    return null;
  }

  // Compact (posts, sidebar): up to two badges, then a "+N" popover with them all.
  if (variant === 'compact') {
    const shown = badges.take(MAX_INLINE_BADGES);
    const overflow = badges.size - shown.size;

    return (
      <span
        className={classNames(
          'epsilon-badges',
          'epsilon-badges--compact',
          className,
        )}
      >
        {shown
          .map((badge) => (
            <EpsilonBadgeItem key={badge.get('id')} badge={badge} />
          ))
          .toArray()}
        {overflow > 0 && <EpsilonBadgeMore badges={badges} count={overflow} />}
      </span>
    );
  }

  // Inline (profile): every badge.
  return (
    <span className={classNames('epsilon-badges', className)}>
      {badges
        .map((badge) => (
          <EpsilonBadgeItem key={badge.get('id')} badge={badge} />
        ))
        .toArray()}
    </span>
  );
};
