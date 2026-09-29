import { useEffect } from 'react';
import ComposeFormContainer from 'mastodon/features/compose/containers/compose_form_container';
import EpsilonSidebar from './epsilon_sidebar';
import EpsilonTopNavbar from './epsilon_top_navbar';
import PropTypes from 'prop-types';
import { useLocation } from 'react-router-dom';
import { Search } from 'mastodon/features/compose/components/search';
import { EpsilonNavigationBar } from './epsilon_navigation_bar'
import classNames from 'classnames';
import { useAppDispatch, useAppSelector } from 'mastodon/store';
import { toggleNavigation } from 'mastodon/actions/navigation';
import { EpsilonHomeFilter } from './epsilon_home_filter';
import EpsilonStoreBadges from './epsilon_store_badges';

import { InlineFollowSuggestions } from 'mastodon/features/home_timeline/components/inline_follow_suggestions';
import { useIdentity } from 'mastodon/identity_context';
import EpsilonCategorySuggestions from 'mastodon/features/epsilon/category_suggestions';
import { EpsilonComposeProvider, useEpsilonCompose } from 'mastodon/features/epsilon/compose_modal';
import { EpsilonImagePeek } from 'mastodon/features/epsilon/image_peek';
import { EpsilonNativeBridge } from 'mastodon/features/epsilon/native_bridge';
import { EpsilonPullToRefresh } from 'mastodon/features/epsilon/pull_to_refresh';
import { EpsilonScrollRestore } from 'mastodon/features/epsilon/scroll_restore';
import { FormattedMessage } from 'react-intl';

const EpsilonLayoutContent = ({ children }) => {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();

  const { open: isComposeOpen } = useEpsilonCompose();

  const isNavOpen = useAppSelector((state) => state.navigation.open);

  const isReplyingOrQuoting = useAppSelector(
    (state) =>
      !!state.compose.get('in_reply_to') ||
      !!state.compose.get('quoted_status_id'),
  );

  useEffect(() => {
    let timer;

    const handleResize = () => {
      document.documentElement.classList.add('epsilon-resizing');
      clearTimeout(timer);
      timer = setTimeout(() => {
        document.documentElement.classList.remove('epsilon-resizing');
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  const handleCloseMenu = () => {
    if (isNavOpen) {
      dispatch(toggleNavigation());
    }
  };

  const showCompose = ['/home', ].some(path =>
      location.pathname.startsWith(path)
    );
  const isHome = location.pathname === '/home';

  const showSearchBar = ['/home', '/public'].some(path =>
      location.pathname.startsWith(path)
    );

  const showInlineCompose =
    showCompose && !isComposeOpen && !isReplyingOrQuoting;

  // Pull-to-refresh : uniquement dans la coque (geste natif-like) et sur le feed
  // home. Hors coque (Safari mobile), on laisse le pull-to-refresh natif du
  // navigateur pour éviter les doublons.
  const isInApp =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('epsilon-in-app');

  return (
    <div className={classNames('epsilon-layout', { 'epsilon-layout--nav-open': isNavOpen })}>
      <div
        className={classNames('epsilon-layout__backdrop', { 'epsilon-layout__backdrop--open': isNavOpen })}
        onClick={handleCloseMenu}
      />
      <EpsilonNavigationBar/>
      <aside className={classNames('epsilon-layout__left', { 'epsilon-layout__left--open': isNavOpen })}>
        <EpsilonSidebar />
      </aside>

      {/* Frère direct de .epsilon-layout (hors de __center) : le push-drawer
          transforme __center, et un position:fixed sous un ancêtre transformé
          changerait de bloc conteneur (saut au démarrage de l'anim). */}
      <EpsilonTopNavbar />

      <main className='epsilon-layout__center'>
        <div className='epsilon-home-top-bar'>
          <div className='epsilon-mobile-search'>
            {showSearchBar && <Search singleColumn />}
          </div>

          {isHome && <EpsilonHomeFilter />}
        </div>

        {isHome && isInApp ? (
          <EpsilonPullToRefresh>
            {showInlineCompose && <ComposeFormContainer singleColumn />}
            {children}
          </EpsilonPullToRefresh>
        ) : (
          <>
            {showInlineCompose && <ComposeFormContainer singleColumn />}
            {children}
          </>
        )}
      </main>

      <aside className='epsilon-layout__right'>
        <div className='epsilon-widgets'>

          <div className='epsilon-widgets__search-wrapper'>
            <Search singleColumn />
          </div>

          {signedIn && (
            <div className='epsilon-widgets__panel'>
              <div className='epsilon-widgets__header'>
                <h4>
                  <FormattedMessage id='follow_suggestions.who_to_follow' defaultMessage="Who to follow"/>
                </h4>
                <a href='/explore/suggestions' className='epsilon-widgets__link'>
                  <FormattedMessage id='follow_suggestions.view_all' defaultMessage="View all"/>
                </a>
              </div>
              <InlineFollowSuggestions />
            </div>
          )}
          {signedIn && (
            <EpsilonCategorySuggestions />
          )}

          <EpsilonStoreBadges />

        </div>
      </aside>
    </div>
  );
};

EpsilonLayoutContent.propTypes = {
  children: PropTypes.node.isRequired,
};

const EpsilonLayout = ({ children }) => (
  <EpsilonComposeProvider>
    <EpsilonNativeBridge />
    <EpsilonImagePeek />
    <EpsilonScrollRestore />
    <EpsilonLayoutContent>{children}</EpsilonLayoutContent>
  </EpsilonComposeProvider>
);

EpsilonLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default EpsilonLayout;
