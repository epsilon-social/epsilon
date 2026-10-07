// Epsilon — sidebar link to the curation studio (staff with the taxonomies
// permission only). The curated feeds themselves live as pills on the home
// column, not in the sidebar.

import PropTypes from 'prop-types';

import { defineMessages, useIntl } from 'react-intl';

import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import { ColumnLink } from 'mastodon/features/ui/components/column_link';
import { useIdentity } from 'mastodon/identity_context';
import { PERMISSION_MANAGE_TAXONOMIES } from 'mastodon/permissions';

const messages = defineMessages({
  studio: { id: 'epsilon_curated.nav.studio', defaultMessage: 'Curation studio' },
});

export const EpsilonCurationStudioLink = ({ getNavClass }) => {
  const intl = useIntl();
  const { permissions } = useIdentity();

  if ((permissions & PERMISSION_MANAGE_TAXONOMIES) !== PERMISSION_MANAGE_TAXONOMIES) {
    return null;
  }

  return (
    <ColumnLink
      to='/curation'
      icon='article'
      iconComponent={ArticleIcon}
      text={intl.formatMessage(messages.studio)}
      className={getNavClass('/curation')}
    />
  );
};

EpsilonCurationStudioLink.propTypes = {
  getNavClass: PropTypes.func.isRequired,
};
