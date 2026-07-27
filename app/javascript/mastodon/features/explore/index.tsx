import { useCallback, useRef } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { NavLink, Switch, Route } from 'react-router-dom';

import { Helmet } from '@unhead/react/helmet';

import TrendingUpIcon from '@/material-icons/400-24px/trending_up.svg?react';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Search } from 'mastodon/features/compose/components/search';
import { useIdentity } from 'mastodon/identity_context';

import Links from './links';
import Statuses from './statuses';
import Suggestions from './suggestions';
import Tags from './tags';

const messages = defineMessages({
  title: { id: 'explore.title', defaultMessage: 'Trending' },
});

const Explore: React.FC<{ multiColumn: boolean }> = ({ multiColumn }) => {
  const { signedIn } = useIdentity();
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  return (
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.title)}
    >
      {/* EPSILON: always use the page icon, never swap to the site logo at wide breakpoints */}
      <ColumnHeader
        icon={'explore'}
        iconComponent={TrendingUpIcon}
        title={intl.formatMessage(messages.title)}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      <div className='explore__search-header'>
        <Search singleColumn />
      </div>

      <div className='account__section-headline'>
        {/* ========================================== */}
        {/* EPSILON : DEFAULT EXPLORE TAB TO PEOPLE    */}
        {/* ========================================== */}

        {signedIn && (
          <NavLink exact to='/explore/suggestions'>
            <FormattedMessage
              tagName='div'
              id='explore.suggested_follows'
              defaultMessage='People'
            />
          </NavLink>
        )}

        <NavLink exact to='/explore/tags'>
          <FormattedMessage
            tagName='div'
            id='explore.trending_tags'
            defaultMessage='Hashtags'
          />
        </NavLink>

        <NavLink exact to='/explore/links'>
          <FormattedMessage
            tagName='div'
            id='explore.trending_links'
            defaultMessage='News'
          />
        </NavLink>

        <NavLink exact to='/explore'>
          <FormattedMessage
            tagName='div'
            id='explore.trending_statuses'
            defaultMessage='Posts'
          />
        </NavLink>
        {/* ========================================== */}
      </div>

      <Switch>
        <Route path='/explore/suggestions' component={Suggestions} />
        <Route path='/explore/tags' component={Tags} />
        <Route path='/explore/links' component={Links} />
        <Route exact path={['/explore', '/explore/posts']}>
          <Statuses multiColumn={multiColumn} />
        </Route>
      </Switch>

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='all' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Explore;
