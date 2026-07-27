import { useCallback, useEffect } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { NavLink, useRouteMatch } from 'react-router-dom';

import EditSquareIcon from '@/material-icons/400-24px/edit_square.svg?react';
import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import HomeActiveIcon from '@/material-icons/400-24px/home-fill.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import MenuIcon from '@/material-icons/400-24px/menu.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { toggleNavigation } from 'mastodon/actions/navigation';
import { fetchNotificationPolicy } from 'mastodon/actions/notification_policies';
import { fetchServer } from 'mastodon/actions/server';
import { Icon } from 'mastodon/components/icon';
import type { MastodonLocationDescriptor } from 'mastodon/components/router';
import { useEpsilonCompose } from 'mastodon/features/epsilon/compose_modal';
import { useIdentity } from 'mastodon/identity_context';
import { registrationsOpen, sso_redirect } from 'mastodon/initial_state';
import { selectUnreadNotificationGroupsCount } from 'mastodon/selectors/notifications';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

export const messages = defineMessages({
  home: { id: 'tabs_bar.home', defaultMessage: 'Home' },
  explore: { id: 'explore.title', defaultMessage: 'Explore' },
  search: { id: 'tabs_bar.search', defaultMessage: 'Search' },
  publish: { id: 'tabs_bar.publish', defaultMessage: 'New Post' },
  notifications: {
    id: 'tabs_bar.notifications',
    defaultMessage: 'Notifications',
  },
  menu: { id: 'tabs_bar.menu', defaultMessage: 'Menu' },
  advancedUiQuickLinks: {
    id: 'tabs_bar.quick_links',
    defaultMessage: 'Quick links',
  },
  bookmarks: { id: 'navigation_bar.bookmarks', defaultMessage: 'Bookmarks' },
});

const IconLabelButton: React.FC<{
  to: MastodonLocationDescriptor;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode;
  title: string;
}> = ({ to, icon, activeIcon, title }) => {
  const match = useRouteMatch(
    typeof to === 'string' ? to : (to.pathname ?? ''),
  );

  return (
    <NavLink
      className='epsilon-bottom-navbar__item'
      activeClassName='active'
      to={to}
      aria-label={title}
    >
      {match && activeIcon ? activeIcon : icon}
    </NavLink>
  );
};

const HamburgerButton = () => {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectUnreadNotificationGroupsCount);
  const pendingRequests = useAppSelector(
    (state) => state.notificationPolicy?.summary.pending_requests_count ?? 0,
  );
  const intl = useIntl();

  useEffect(() => {
    void dispatch(fetchNotificationPolicy());
  }, [dispatch]);

  const handleClick = useCallback(() => {
    dispatch(toggleNavigation());
  }, [dispatch]);

  const hasUnread = count > 0 || pendingRequests > 0;

  return (
    <button
      type='button'
      className='epsilon-bottom-navbar__item'
      onClick={handleClick}
      aria-label={intl.formatMessage(messages.menu)}
    >
      <span className='epsilon-bottom-navbar__icon-wrap'>
        <Icon id='bars' icon={MenuIcon} />
        {hasUnread && <span className='epsilon-bottom-navbar__badge' />}
      </span>
    </button>
  );
};

const ComposeButton = () => {
  const { openCompose } = useEpsilonCompose();
  const intl = useIntl();

  return (
    <button
      type='button'
      className='epsilon-bottom-navbar__item epsilon-bottom-navbar__compose'
      onClick={openCompose}
      aria-label={intl.formatMessage(messages.publish)}
    >
      <Icon id='' icon={EditSquareIcon} />
    </button>
  );
};

const LoginOrSignUp: React.FC = () => {
  const dispatch = useAppDispatch();
  const signupUrl = useAppSelector(
    (state) => state.server.server.item?.registrations.url ?? '/auth/sign_up',
  );

  const openClosedRegistrationsModal = useCallback(() => {
    dispatch(openModal({ modalType: 'CLOSED_REGISTRATIONS', modalProps: {} }));
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchServer());
  }, [dispatch]);

  if (sso_redirect) {
    return (
      <div className='epsilon-bottom-navbar__sign-up'>
        <a
          href={sso_redirect}
          data-method='post'
          className='button button--block button-secondary'
        >
          <FormattedMessage
            id='sign_in_banner.sso_redirect'
            defaultMessage='Login or Register'
          />
        </a>
      </div>
    );
  } else {
    let signupButton;

    if (registrationsOpen) {
      signupButton = (
        <a href={signupUrl} className='button'>
          <FormattedMessage
            id='sign_in_banner.create_account'
            defaultMessage='Create account'
          />
        </a>
      );
    } else {
      signupButton = (
        <button
          className='button'
          onClick={openClosedRegistrationsModal}
          type='button'
        >
          <FormattedMessage
            id='sign_in_banner.create_account'
            defaultMessage='Create account'
          />
        </button>
      );
    }

    return (
      <div className='ui__navigation-bar__sign-up'>
        {signupButton}
        <a href='/auth/sign_in' className='button button-secondary'>
          <FormattedMessage
            id='sign_in_banner.sign_in'
            defaultMessage='Login'
          />
        </a>
      </div>
    );
  }
};

export const EpsilonNavigationBar: React.FC = () => {
  const { signedIn } = useIdentity();
  const intl = useIntl();

  return (
    <div className='epsilon-bottom-navbar'>
      {!signedIn && <LoginOrSignUp />}

      <div
        className={classNames('epsilon-bottom-navbar__items', {
          active: signedIn,
        })}
      >
        {signedIn && (
          <>
            <IconLabelButton
              title={intl.formatMessage(messages.home)}
              to='/home'
              icon={<Icon id='' icon={HomeIcon} />}
              activeIcon={<Icon id='' icon={HomeActiveIcon} />}
            />
            <IconLabelButton
              title={intl.formatMessage(messages.explore)}
              to='/explore'
              icon={<Icon id='' icon={ExploreIcon} />}
            />
            <ComposeButton />
            <IconLabelButton
              title={intl.formatMessage(messages.search)}
              to='/search'
              icon={<Icon id='' icon={SearchIcon} />}
            />
            <HamburgerButton />
          </>
        )}
      </div>
    </div>
  );
};
