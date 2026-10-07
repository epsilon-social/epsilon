// Epsilon — curation studio (staff only).
//
// The workbench where moderators build the curated feeds: search posts (by
// account, hashtag, single URL or fork category), attribute them to feeds,
// then arrange and publish the per-feed draft board. Server-side gated by the
// taxonomies permission; this page just mirrors the gate for the UI.

import PropTypes from 'prop-types';
import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from '@unhead/react/helmet';
import classNames from 'classnames';

import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';
import { useIdentity } from 'mastodon/identity_context';
import { PERMISSION_MANAGE_TAXONOMIES } from 'mastodon/permissions';

import DraftBoard from './draft_board';
import SearchPanel from './search_panel';

const messages = defineMessages({
  title: { id: 'epsilon_curated.studio.title', defaultMessage: 'Curation studio' },
});

const EpsilonCurationStudio = ({ multiColumn }) => {
  const intl = useIntl();
  const { signedIn, permissions } = useIdentity();
  const [tab, setTab] = useState('search');

  const handleSearchTab = useCallback(() => setTab('search'), []);
  const handleDraftsTab = useCallback(() => setTab('drafts'), []);

  const canCurate = signedIn && (permissions & PERMISSION_MANAGE_TAXONOMIES) === PERMISSION_MANAGE_TAXONOMIES;

  if (!canCurate) {
    return (
      <Column bindToDocument={!multiColumn} label={intl.formatMessage(messages.title)}>
        <div className='epsilon-curation__forbidden'>
          <FormattedMessage id='epsilon_curated.studio.forbidden' defaultMessage='This page is reserved for the moderation team.' />
        </div>
      </Column>
    );
  }

  return (
    <Column bindToDocument={!multiColumn} label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        icon='article'
        iconComponent={ArticleIcon}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn}
      />

      <div className='epsilon-curation__tabs'>
        <button type='button' className={classNames('epsilon-curation__tab', { active: tab === 'search' })} onClick={handleSearchTab}>
          <FormattedMessage id='epsilon_curated.studio.tab_search' defaultMessage='Search' />
        </button>
        <button type='button' className={classNames('epsilon-curation__tab', { active: tab === 'drafts' })} onClick={handleDraftsTab}>
          <FormattedMessage id='epsilon_curated.studio.tab_drafts' defaultMessage='Drafts' />
        </button>
      </div>

      {tab === 'search' ? <SearchPanel /> : <DraftBoard />}

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

EpsilonCurationStudio.propTypes = {
  multiColumn: PropTypes.bool,
};

export default EpsilonCurationStudio;
