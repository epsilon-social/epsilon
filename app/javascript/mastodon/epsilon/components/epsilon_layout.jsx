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

import { InlineFollowSuggestions } from 'mastodon/features/home_timeline/components/inline_follow_suggestions';
import { useIdentity } from 'mastodon/identity_context';
import EpsilonCategorySuggestions from 'mastodon/features/epsilon/category_suggestions';
import { EpsilonComposeProvider, useEpsilonCompose } from 'mastodon/features/epsilon/compose_modal';
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

  return (
    <div className='epsilon-layout'>
      <div
        className={classNames('epsilon-layout__backdrop', { 'epsilon-layout__backdrop--open': isNavOpen })}
        onClick={handleCloseMenu}
      />
      <EpsilonNavigationBar/>
      <aside className={classNames('epsilon-layout__left', { 'epsilon-layout__left--open': isNavOpen })}>
        <EpsilonSidebar />
      </aside>

      <main className='epsilon-layout__center'>
        <EpsilonTopNavbar />

        <div className='epsilon-home-top-bar'>
          <div className='epsilon-mobile-search'>
            {showSearchBar && <Search singleColumn />}
          </div>

          {isHome && <EpsilonHomeFilter />}
        </div>


          {showInlineCompose && <ComposeFormContainer singleColumn />}
        {children}
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
    <EpsilonScrollRestore />
    <EpsilonLayoutContent>{children}</EpsilonLayoutContent>
  </EpsilonComposeProvider>
);

EpsilonLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default EpsilonLayout;
