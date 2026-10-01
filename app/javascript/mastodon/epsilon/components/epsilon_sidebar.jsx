import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import EditSquareIcon from '@/material-icons/400-24px/edit_square.svg?react';
import AlternateEmailIcon from '@/material-icons/400-24px/alternate_email.svg?react';
import BookmarksActiveIcon from '@/material-icons/400-24px/bookmarks-fill.svg?react';
import BookmarksIcon from '@/material-icons/400-24px/bookmarks.svg?react';
import CollectionsActiveIcon from '@/material-icons/400-24px/category-fill.svg?react';
import CollectionsIcon from '@/material-icons/400-24px/category.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import InfoIcon from '@/material-icons/400-24px/info.svg?react';
import LoginIcon from '@/material-icons/400-24px/login.svg?react';
import ListAltActiveIcon from '@/material-icons/400-24px/list_alt-fill.svg?react';
import ListAltIcon from '@/material-icons/400-24px/list_alt.svg?react';
import LogoutIcon from '@/material-icons/400-24px/logout.svg?react';
import NotificationsActiveIcon from '@/material-icons/400-24px/notifications-fill.svg?react';
import NotificationsIcon from '@/material-icons/400-24px/notifications.svg?react';
import HomeActiveIcon from '@/material-icons/400-24px/home-fill.svg?react';
import ProfileIcon from '@/material-icons/400-24px/account_circle.svg?react';
import ProfileActiveIcon from '@/material-icons/400-24px/account_circle-fill.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import StarActiveIcon from '@/material-icons/400-24px/heart-fill.svg?react';
import StarIcon from '@/material-icons/400-24px/heart.svg?react';
import TagIcon from '@/material-icons/400-24px/tag.svg?react';
import TrendingUpIcon from '@/material-icons/400-24px/trending_up.svg?react';
import TuneActiveIcon from '@/material-icons/400-24px/tune-fill.svg?react';
import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import { Icon } from 'mastodon/components/icon';
import { WordmarkLogo } from 'mastodon/components/logo';
import epsilonLogo from '@/images/logo.svg';
import { useLocation, Link } from 'react-router-dom';
import classNames from 'classnames';
import { openModal } from 'mastodon/actions/modal';
import { useAppDispatch } from 'mastodon/store';
import { useEpsilonCompose } from 'mastodon/features/epsilon/compose_modal';

import { ColumnLink } from 'mastodon/features/ui/components/column_link';
import { useIdentity } from 'mastodon/identity_context';
import { me } from 'mastodon/initial_state';
import { LinkFooter} from 'mastodon/features/ui/components/link_footer';
import { useAppSelector } from 'mastodon/store';
import { Avatar } from 'mastodon/components/avatar';
import { EpsilonBadges } from './epsilon_badges';
import EpsilonStoreBadges from './epsilon_store_badges';
import { DisabledAccountBanner } from '../../features/navigation_panel/components/disabled_account_banner'

import { IconWithBadge } from 'mastodon/components/icon_with_badge';
import { selectUnreadNotificationGroupsCount } from 'mastodon/selectors/notifications';
import { useEffect } from 'react';

import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import PersonAddActiveIcon from '@/material-icons/400-24px/person_add-fill.svg?react';

import { fetchFollowRequests } from 'mastodon/actions/accounts';
import { canViewFeed } from 'mastodon/permissions';
import {
  localLiveFeedAccess,
  remoteLiveFeedAccess,
  localTopicFeedAccess,
  remoteTopicFeedAccess,
  trendsEnabled,
} from 'mastodon/initial_state';

const messages = defineMessages({
  home: { id: 'tabs_bar.home', defaultMessage: 'Home' },
  profile: { id: 'navigation_bar.profile', defaultMessage: 'Profile' },
  search: { id: 'tabs_bar.search', defaultMessage: 'Search' },
  notifications: { id: 'tabs_bar.notifications', defaultMessage: 'Notifications' },
  explore: { id: 'explore.title', defaultMessage: 'Trending' },
  firehose: { id: 'epsilon.firehose.title', defaultMessage: 'Epsilon feed' },
  direct: { id: 'navigation_bar.direct', defaultMessage: 'Private mentions' },
  favourites: { id: 'navigation_bar.favourites', defaultMessage: 'Favorites' },
  bookmarks: { id: 'navigation_bar.bookmarks', defaultMessage: 'Bookmarks' },
  tags: { id: 'navigation_bar.followed_tags', defaultMessage: 'Followed tags' },
  preferences: { id: 'navigation_bar.preferences', defaultMessage: 'Preferences' },
  logout: { id: 'navigation_bar.logout', defaultMessage: 'Logout' },
  signIn: { id: 'sign_in_banner.sign_in', defaultMessage: 'Sign In' },
  createAccount: { id: 'sign_in_banner.create_account', defaultMessage: 'Create account' },
  about: { id: 'navigation_bar.about', defaultMessage: 'About' },
  lists: { id: 'navigation_bar.lists', defaultMessage: 'Lists' },
  collections: { id: 'navigation_bar.collections', defaultMessage: 'Collections' },
  followRequests: { id: 'navigation_bar.follow_requests', defaultMessage: 'Follow requests', },
  categories: { id: 'epsilon_cat.column_settings.categories', defaultMessage: 'Categories' },
  compose: { id: 'tabs_bar.publish', defaultMessage: 'New Post' },
});

const EpsilonFollowRequestsLink = ({ getNavClass }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const count = useAppSelector((state) => {
    const items = state.user_lists.getIn(['follow_requests', 'items']);
    return items ? items.size : 0;
  });

  useEffect(() => {
    dispatch(fetchFollowRequests());
  }, [dispatch]);

  if (count === 0) {
    return null;
  }

  return (
    <ColumnLink
      to='/follow_requests'
      className={getNavClass('/follow_requests')}
      text={intl.formatMessage(messages.followRequests)}
      icon={
        <IconWithBadge
          id='user-plus'
          icon={PersonAddIcon}
          count={count}
          className='column-link__icon'
        />
      }
      activeIcon={
        <IconWithBadge
          id='user-plus'
          icon={PersonAddActiveIcon}
          count={count}
          className='column-link__icon'
        />
      }
    />
  );
};

const EpsilonProfileBlock = () => {
  const account = useAppSelector((state) => state.accounts.get(me));

  if (!account) {
    return <div className='epsilon-sidebar__avatar-placeholder' />;
  }

  return (
    <a href={`/@${account.username}`} className='epsilon-sidebar__profile-link'>
      <Avatar account={account} size={44} />
      <div className='epsilon-sidebar__meta'>
        {/* EPSILON : CERTIFIED ACCOUNTS / BADGES */}
        <strong className='epsilon-sidebar__name'>
          {account.display_name || account.username}
          <EpsilonBadges account={account} variant='compact' />
        </strong>
        <span>@{account.acct}</span>
      </div>
    </a>
  );
};

const EpsilonNotificationsLink = ({ getNavClass, intl }) => {
  const count = useAppSelector(selectUnreadNotificationGroupsCount);

  return (
    <ColumnLink
      to='/notifications'
      className={`${getNavClass('/notifications')} epsilon-sidebar__item--in-app-hidden`}
      text={intl.formatMessage(messages.notifications)}
      icon={
        <IconWithBadge
          id='bell'
          icon={NotificationsIcon}
          count={count}
          className='column-link__icon'
        />
      }
      activeIcon={
        <IconWithBadge
          id='bell'
          icon={NotificationsActiveIcon}
          count={count}
          className='column-link__icon'
        />
      }
    />
  );
};

const EpsilonSidebar = () => {
  const intl = useIntl();
  const { signedIn, permissions, disabledAccountId } = useIdentity();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { openCompose } = useEpsilonCompose();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const account = useAppSelector((state) => state.accounts.get(me));

  const handleLogoutClick = (e) => {
    e.preventDefault();
    dispatch(openModal({ modalType: 'CONFIRM_LOG_OUT', modalProps: {} }));
  };

  const handleComposeClick = () => {
    openCompose();
  };


  const getNavClass = (path, exact = false) => classNames('epsilon-sidebar__item', {
      'epsilon-sidebar__item--active': exact ? location.pathname === path : location.pathname.startsWith(path)
    });

    const showLocalFeed = canViewFeed(signedIn, permissions, localLiveFeedAccess);
    const showRemoteFeed = canViewFeed(signedIn, permissions, remoteLiveFeedAccess);
    const showFirehose = showLocalFeed || showRemoteFeed;

    const firehoseLink = showLocalFeed ? '/public/local' : '/public/remote';
    const firehoseText = messages.firehose;

    const showTrending =
      trendsEnabled &&
      (canViewFeed(signedIn, permissions, localTopicFeedAccess) ||
        canViewFeed(signedIn, permissions, remoteTopicFeedAccess));

  return (
    <div className='epsilon-sidebar'>
      <Link to={me ? '/home' : '/explore'} className='epsilon-sidebar__logo' aria-label='Epsilon'>
        <WordmarkLogo />
        <img src={epsilonLogo} alt='' aria-hidden='true' className='epsilon-sidebar__logo-mark' />
      </Link>

      <div className='epsilon-sidebar__profile'>
        {signedIn && me && <EpsilonProfileBlock />}
      </div>

      {!signedIn && (
        disabledAccountId ? (
          <DisabledAccountBanner />
        ) : (
          <div className='epsilon-sidebar__guest'>
            {showFirehose && (
              <ColumnLink to={firehoseLink} icon='globe' iconComponent={PublicIcon} text={intl.formatMessage(firehoseText)} className={getNavClass('/public')} />
            )}
            {showTrending && (
              <ColumnLink to='/explore' icon='explore' iconComponent={TrendingUpIcon} text={intl.formatMessage(messages.explore)} className={`${getNavClass('/explore')} epsilon-sidebar__item--in-app-hidden`} />
            )}
            <ColumnLink transparent href='/about' icon='info' iconComponent={InfoIcon} text={intl.formatMessage(messages.about)} className={getNavClass('/about')} />

            <div className='epsilon-sidebar__divider' />

            <div className='epsilon-sidebar__guest-actions'>
              <a href='/auth/sign_in' className='epsilon-sidebar__guest-btn epsilon-sidebar__guest-btn--secondary'>
                <Icon id='login' icon={LoginIcon} />
                <span>{intl.formatMessage(messages.signIn)}</span>
              </a>
              <a href='/auth/sign_up' className='epsilon-sidebar__guest-btn'>
                <Icon id='person-add' icon={PersonAddIcon} />
                <span>{intl.formatMessage(messages.createAccount)}</span>
              </a>
            </div>
          </div>
        )
      )}

      <nav className='epsilon-sidebar__nav' aria-label='Primary'>

        {signedIn && (
          <button type='button' className='epsilon-sidebar__compose' onClick={handleComposeClick}>
            <Icon id='pencil' icon={EditSquareIcon} />
            <span>{intl.formatMessage(messages.compose)}</span>
          </button>
        )}

        {signedIn && (
          <ColumnLink to='/home' icon='home' iconComponent={HomeIcon} activeIconComponent={HomeActiveIcon} text={intl.formatMessage(messages.home)} className={`${getNavClass('/home', true)} epsilon-sidebar__item--in-app-hidden`} />
        )}

        {signedIn && showFirehose && (
          <ColumnLink to={firehoseLink} icon='globe' iconComponent={PublicIcon} text={intl.formatMessage(firehoseText)} className={getNavClass('/public')} />
        )}

        {signedIn && (
          <ColumnLink to='/search' icon='search' iconComponent={SearchIcon} text={intl.formatMessage(messages.search)} className={`${getNavClass('/search')} epsilon-sidebar__item--in-app-hidden epsilon-sidebar__item--wide-hidden`} />
        )}

        {signedIn && showTrending && (
          <ColumnLink to='/explore/suggestions' icon='explore' iconComponent={TrendingUpIcon} text={intl.formatMessage(messages.explore)} className={`${getNavClass('/explore')} epsilon-sidebar__item--in-app-hidden`}/>
        )}

        {signedIn && (
          <>
            <div className='epsilon-sidebar__divider' />
            <EpsilonNotificationsLink getNavClass={getNavClass} intl={intl} />

            <EpsilonFollowRequestsLink getNavClass={getNavClass} />

            <ColumnLink to='/conversations' icon='at' iconComponent={AlternateEmailIcon} text={intl.formatMessage(messages.direct)} className={getNavClass('/conversations')} />

            <div className='epsilon-sidebar__divider' />

            <ColumnLink to='/categories' icon='tune' iconComponent={TuneIcon} activeIconComponent={TuneActiveIcon} text={intl.formatMessage(messages.categories)} className={getNavClass('/categories')} />
            {account && (
              <ColumnLink to={`/@${account.acct}`} icon='user' iconComponent={ProfileIcon} activeIconComponent={ProfileActiveIcon} text={intl.formatMessage(messages.profile)} className={getNavClass(`/@${account.acct}`)} />
            )}
            {/* <ColumnLink to='/bookmarks' icon='bookmarks' iconComponent={BookmarksIcon} activeIconComponent={BookmarksActiveIcon} text={intl.formatMessage(messages.bookmarks)} className={getNavClass('/bookmarks')} />*/}
            {/* <ColumnLink to='/followed_tags' icon='tags' iconComponent={TagIcon} text={intl.formatMessage(messages.tags)} className={getNavClass('/followed_tags')} />*/}
            <ColumnLink transparent href='/settings/preferences' icon='cog' iconComponent={SettingsIcon} text={intl.formatMessage(messages.preferences)} className={getNavClass('/settings')} />

            <button
              className={`epsilon-sidebar__more-toggle ${isMoreOpen ? 'epsilon-sidebar__more-toggle--active' : ''}`}
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              type="button"
            >

              <Icon id='plus' icon={AddIcon} />
              <span>{isMoreOpen ? 'Moins' : 'Plus'}</span>
            </button>

            <div className={`epsilon-sidebar__secondary ${isMoreOpen ? 'epsilon-sidebar__secondary--open' : ''}`}>
              <div className={`epsilon-sidebar__secondary-inner ${isMoreOpen && 'epsilon-sidebar__secondary-inner--open'}`}>
                <ColumnLink to='/favourites' icon='star' iconComponent={StarIcon} activeIconComponent={StarActiveIcon} text={intl.formatMessage(messages.favourites)} className={getNavClass('/favourites')} />
                <ColumnLink to='/bookmarks' icon='bookmarks' iconComponent={BookmarksIcon} activeIconComponent={BookmarksActiveIcon} text={intl.formatMessage(messages.bookmarks)} className={getNavClass('/bookmarks')} />
                <ColumnLink to='/followed_tags' icon='tags' iconComponent={TagIcon} text={intl.formatMessage(messages.tags)} className={getNavClass('/followed_tags')} />
                <ColumnLink to='/lists' icon='list-ul' iconComponent={ListAltIcon} activeIconComponent={ListAltActiveIcon} text={intl.formatMessage(messages.lists)} className={getNavClass('/lists')} />
                <ColumnLink
                  transparent
                  to={`/@${account?.acct}/collections`}
                  icon='collections'
                  iconComponent={CollectionsIcon}
                  activeIconComponent={CollectionsActiveIcon}
                  text={intl.formatMessage(messages.collections)}
                  className={getNavClass(`/@${account?.acct}/collections`)}
                />
              </div>
            </div>
          </>
        )}
      </nav>


      <div className='epsilon-sidebar__footer'>
        {signedIn && (
          <a href='/auth/sign_out' data-method='delete' className='epsilon-sidebar__item'
            onClick={handleLogoutClick}
            type='button'
          >
            <Icon id='sign-out' icon={LogoutIcon} />
            <span>{intl.formatMessage(messages.logout)}</span>
          </a>
        )}

        <LinkFooter />
        <EpsilonStoreBadges />
        </div>
    </div>
  );
};

export default EpsilonSidebar;
