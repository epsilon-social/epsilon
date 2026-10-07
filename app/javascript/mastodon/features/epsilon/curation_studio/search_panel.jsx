// Epsilon — curation studio search panel.
//
// Four search modes feeding the attribution flow:
//   account  → native account search, then the account's known statuses,
//              plus an ActivityPub outbox import for thin remote accounts
//   hashtag  → native tag timeline
//   url      → native search with resolve (imports the post if needed)
//   category → fork categorization system (custom endpoint)

import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { Button } from 'mastodon/components/button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import {
  apiCreateEpsilonCurationItem,
  apiDeleteEpsilonCurationItem,
  apiEpsilonAccountStatuses,
  apiEpsilonCurationCategories,
  apiEpsilonResolveStatusUrl,
  apiEpsilonSearchAccounts,
  apiEpsilonTagStatuses,
  apiGetEpsilonCategoryStatuses,
  apiGetEpsilonCurationMemberships,
  apiImportEpsilonCurationAccount,
} from 'mastodon/epsilon/api/curation';
import { fetchEpsilonCuratedFeeds, selectEpsilonCuratedFeedsFlat } from 'mastodon/epsilon/store/curated_feeds_slice';
import { categoryDisplayName } from 'mastodon/features/epsilon/category_names';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import ResultCard from './result_card';

const messages = defineMessages({
  modeAccount: { id: 'epsilon_curated.studio.mode_account', defaultMessage: 'Account' },
  modeHashtag: { id: 'epsilon_curated.studio.mode_hashtag', defaultMessage: 'Hashtag' },
  modeUrl: { id: 'epsilon_curated.studio.mode_url', defaultMessage: 'Post URL' },
  modeCategory: { id: 'epsilon_curated.studio.mode_category', defaultMessage: 'Category' },
  placeholderAccount: { id: 'epsilon_curated.studio.placeholder_account', defaultMessage: '@account@domain or name…' },
  placeholderHashtag: { id: 'epsilon_curated.studio.placeholder_hashtag', defaultMessage: 'Hashtag, without the #' },
  placeholderUrl: { id: 'epsilon_curated.studio.placeholder_url', defaultMessage: 'https://… link to a post' },
  search: { id: 'epsilon_curated.studio.search', defaultMessage: 'Search' },
});

const MODES = [
  { value: 'account', message: messages.modeAccount },
  { value: 'hashtag', message: messages.modeHashtag },
  { value: 'url', message: messages.modeUrl },
  { value: 'category', message: messages.modeCategory },
];

const PLACEHOLDERS = {
  account: messages.placeholderAccount,
  hashtag: messages.placeholderHashtag,
  url: messages.placeholderUrl,
};

const AccountButton = ({ account, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(account);
  }, [account, onSelect]);

  return (
    <button type='button' className='epsilon-curation__account' onClick={handleClick}>
      <img src={account.avatar} alt='' />
      <strong>{account.display_name || account.username}</strong>
      <span>@{account.acct}</span>
    </button>
  );
};

AccountButton.propTypes = {
  account: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired,
};

const SearchPanel = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const feeds = useAppSelector(selectEpsilonCuratedFeedsFlat);

  const [mode, setMode] = useState('account');
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [statuses, setStatuses] = useState([]);
  const [memberships, setMemberships] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [importState, setImportState] = useState('idle');

  useEffect(() => {
    dispatch(fetchEpsilonCuratedFeeds());
  }, [dispatch]);

  useEffect(() => {
    if (mode !== 'category' || categories.length > 0) {
      return;
    }

    apiEpsilonCurationCategories()
      .then((data) => {
        setCategories(data);
        return '';
      })
      .catch(() => {
        // Nothing
      });
  }, [mode, categories.length]);

  const refreshMemberships = useCallback((statusList) => {
    const ids = statusList.map((status) => status.id);

    if (ids.length === 0) {
      setMemberships({});
      return;
    }

    apiGetEpsilonCurationMemberships(ids)
      .then((items) => {
        setMemberships((current) => {
          const next = { ...current };
          ids.forEach((id) => {
            next[id] = {};
          });
          items.forEach((item) => {
            next[item.status_id] = { ...next[item.status_id], [item.curated_feed_id]: item };
          });
          return next;
        });
        return '';
      })
      .catch(() => {
        // Nothing
      });
  }, []);

  const showStatuses = useCallback(
    (list, { append = false, more } = {}) => {
      setStatuses((current) => {
        const next = append ? [...current, ...list] : list;
        refreshMemberships(next);
        return next;
      });
      setHasMore(more ?? list.length >= 20);
    },
    [refreshMemberships],
  );

  const loadAccountStatuses = useCallback(
    (account, { append = false, maxId } = {}) => {
      setLoading(true);

      apiEpsilonAccountStatuses(account.id, maxId)
        .then((list) => {
          showStatuses(list, { append });
          return '';
        })
        .catch(() => {
          // Nothing
        })
        .finally(() => setLoading(false));
    },
    [showStatuses],
  );

  const handleSelectAccount = useCallback(
    (account) => {
      setSelectedAccount(account);
      setImportState('idle');
      loadAccountStatuses(account);
    },
    [loadAccountStatuses],
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();

      const trimmed = query.trim();

      setStatuses([]);
      setSelectedAccount(null);
      setAccounts([]);
      setHasMore(false);

      if (mode === 'account') {
        if (trimmed === '') return;
        setLoading(true);
        apiEpsilonSearchAccounts(trimmed)
          .then((list) => {
            setAccounts(list);
            return '';
          })
          .catch(() => {
            // Nothing
          })
          .finally(() => setLoading(false));
      } else if (mode === 'hashtag') {
        if (trimmed === '') return;
        setLoading(true);
        apiEpsilonTagStatuses(trimmed.replace(/^#/, ''))
          .then((list) => {
            showStatuses(list);
            return '';
          })
          .catch(() => {
            // Nothing
          })
          .finally(() => setLoading(false));
      } else if (mode === 'url') {
        if (trimmed === '') return;
        setLoading(true);
        apiEpsilonResolveStatusUrl(trimmed)
          .then((results) => {
            showStatuses(results.statuses, { more: false });
            return '';
          })
          .catch(() => {
            // Nothing
          })
          .finally(() => setLoading(false));
      } else if (mode === 'category') {
        if (categoryId === '') return;
        setLoading(true);
        apiGetEpsilonCategoryStatuses(categoryId)
          .then((list) => {
            showStatuses(list);
            return '';
          })
          .catch(() => {
            // Nothing
          })
          .finally(() => setLoading(false));
      }
    },
    [mode, query, categoryId, showStatuses],
  );

  const handleLoadMore = useCallback(() => {
    const last = statuses[statuses.length - 1];

    if (!last) return;

    if (mode === 'account' && selectedAccount) {
      loadAccountStatuses(selectedAccount, { append: true, maxId: last.id });
    } else if (mode === 'hashtag') {
      setLoading(true);
      apiEpsilonTagStatuses(query.trim().replace(/^#/, ''), last.id)
        .then((list) => {
          showStatuses(list, { append: true });
          return '';
        })
        .catch(() => {
          // Nothing
        })
        .finally(() => setLoading(false));
    } else if (mode === 'category') {
      setLoading(true);
      apiGetEpsilonCategoryStatuses(categoryId, last.id)
        .then((list) => {
          showStatuses(list, { append: true });
          return '';
        })
        .catch(() => {
          // Nothing
        })
        .finally(() => setLoading(false));
    }
  }, [mode, statuses, selectedAccount, query, categoryId, loadAccountStatuses, showStatuses]);

  const handleImport = useCallback(() => {
    if (!selectedAccount) return;

    setImportState('queued');

    apiImportEpsilonCurationAccount(selectedAccount.id).catch(() => setImportState('idle'));
  }, [selectedAccount]);

  const handleRefreshAccount = useCallback(() => {
    if (selectedAccount) {
      loadAccountStatuses(selectedAccount);
    }
  }, [selectedAccount, loadAccountStatuses]);

  const handleToggleAttribution = useCallback((feed, status, membership) => {
    if (membership) {
      apiDeleteEpsilonCurationItem(membership.id)
        .then(() => {
          setMemberships((current) => {
            const forStatus = Object.fromEntries(
              Object.entries(current[status.id] ?? {}).filter(([key]) => key !== feed.id),
            );
            return { ...current, [status.id]: forStatus };
          });
          return '';
        })
        .catch(() => {
          // Nothing
        });
    } else {
      apiCreateEpsilonCurationItem({ feedId: feed.id, statusId: status.id, mode: 'draft' })
        .then((item) => {
          setMemberships((current) => ({
            ...current,
            [status.id]: { ...current[status.id], [feed.id]: item },
          }));
          return '';
        })
        .catch(() => {
          // Nothing
        });
    }
  }, []);

  const handleModeClick = useCallback((event) => {
    setMode(event.currentTarget.dataset.mode);
    setStatuses([]);
    setAccounts([]);
    setSelectedAccount(null);
    setHasMore(false);
  }, []);

  const handleQueryChange = useCallback((event) => setQuery(event.target.value), []);
  const handleCategoryChange = useCallback((event) => setCategoryId(event.target.value), []);

  const isRemoteAccount = selectedAccount && selectedAccount.acct.includes('@');

  return (
    <div className='epsilon-curation__search'>
      <div className='epsilon-curation__modes' role='group'>
        {MODES.map((option) => (
          <button
            key={option.value}
            type='button'
            data-mode={option.value}
            className={classNames('epsilon-curation__mode', { active: mode === option.value })}
            onClick={handleModeClick}
          >
            {intl.formatMessage(option.message)}
          </button>
        ))}
      </div>

      <form className='epsilon-curation__form' onSubmit={handleSubmit}>
        {mode === 'category' ? (
          <select className='epsilon-curation__input' value={categoryId} onChange={handleCategoryChange}>
            <option value=''>—</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryDisplayName(intl, category)}
              </option>
            ))}
          </select>
        ) : (
          <input
            className='epsilon-curation__input'
            type='text'
            value={query}
            onChange={handleQueryChange}
            placeholder={intl.formatMessage(PLACEHOLDERS[mode])}
          />
        )}

        <Button type='submit' text={intl.formatMessage(messages.search)} />
      </form>

      {mode === 'account' && accounts.length > 0 && !selectedAccount && (
        <div className='epsilon-curation__accounts'>
          {accounts.map((account) => (
            <AccountButton key={account.id} account={account} onSelect={handleSelectAccount} />
          ))}
        </div>
      )}

      {selectedAccount && (
        <div className='epsilon-curation__selected-account'>
          <span>
            <strong>{selectedAccount.display_name || selectedAccount.username}</strong> @{selectedAccount.acct}
          </span>

          {isRemoteAccount && importState === 'idle' && (
            <Button secondary onClick={handleImport}>
              <FormattedMessage id='epsilon_curated.studio.import_recent' defaultMessage='Import recent posts' />
            </Button>
          )}

          {importState === 'queued' && (
            <Button secondary onClick={handleRefreshAccount}>
              <FormattedMessage id='epsilon_curated.studio.import_refresh' defaultMessage='Import started — refresh' />
            </Button>
          )}
        </div>
      )}

      {loading && statuses.length === 0 && <LoadingIndicator />}

      <div className='epsilon-curation__results'>
        {statuses.map((status) => (
          <ResultCard
            key={status.id}
            status={status}
            feeds={feeds}
            memberships={memberships[status.id]}
            onToggle={handleToggleAttribution}
          />
        ))}
      </div>

      {hasMore && statuses.length > 0 && (
        <button type='button' className='epsilon-curation__load-more' onClick={handleLoadMore} disabled={loading}>
          <FormattedMessage id='epsilon_curated.studio.load_more' defaultMessage='Load more' />
        </button>
      )}
    </div>
  );
};

export default SearchPanel;
