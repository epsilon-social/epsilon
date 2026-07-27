import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { WordmarkLogo } from 'mastodon/components/logo';
import { useAppSelector } from 'mastodon/store';
import { Avatar } from 'mastodon/components/avatar';
import { me } from 'mastodon/initial_state';
import { Icon } from 'mastodon/components/icon';
import MenuIcon from '@/material-icons/400-24px/menu.svg?react';
import { useAppDispatch } from 'mastodon/store';
import { toggleNavigation } from 'mastodon/actions/navigation';

const getOverlayRoot = () => {
  let el = document.getElementById('epsilon-overlay-root');

  if (!el) {
    el = document.createElement('div');
    el.id = 'epsilon-overlay-root';
    document.body.appendChild(el);
  }

  return el;
};

const EpsilonTopNavbar = () => {
  const [overlayRoot] = useState(getOverlayRoot);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const headerHeight = 80;
  const dispatch = useAppDispatch();

  const handleMenuClick = () => {
    dispatch(toggleNavigation());
  };


  const account = useAppSelector((state) => state.accounts.get(me));

  useEffect(() => {
    lastScrollY.current = Math.max(0, window.scrollY);

    const update = () => {
      ticking.current = false;

      const currentScrollY = Math.max(0, window.scrollY);
      const delta = currentScrollY - lastScrollY.current;
      lastScrollY.current = currentScrollY;

      if (currentScrollY < headerHeight) {
        setHidden(false);
        return;
      }

      if (Math.abs(delta) < 4) {
        return;
      }

      setHidden(delta > 0);
    };

    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return createPortal(
    <div
      className={classNames('epsilon-top-navbar', {
        'epsilon-top-navbar--hidden': hidden,
      })}
    >
      <div className='epsilon-top-navbar__scrim' aria-hidden='true' />

      <div className='epsilon-top-navbar__left'>
        <button
          type="button"
          className='epsilon-top-navbar__hamburger'
          aria-label='Menu'
          onClick={handleMenuClick}
        >
          <Icon id='bars' icon={MenuIcon} />
        </button>
      </div>

      <div className='epsilon-top-navbar__center'>
        <Link to={me ? '/home' : '/explore'} className='epsilon-top-navbar__logo-link'>
          <WordmarkLogo />
        </Link>
      </div>

      <div className='epsilon-top-navbar__right'>
        {account && (
          <Link to={`/@${account.acct}`} className='epsilon-top-navbar__avatar'>
            <Avatar account={account} size={36} />
          </Link>
        )}
      </div>
    </div>,
    overlayRoot,
  );
};

export default EpsilonTopNavbar;
