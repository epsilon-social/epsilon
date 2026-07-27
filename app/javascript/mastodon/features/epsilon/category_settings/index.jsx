import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import { useHistory } from 'react-router-dom';

import CancelIcon from '@/material-icons/400-24px/cancel-fill.svg?react';
import TileIcon from '@/material-icons/400-24px/tile.svg?react';

import api from '../../../api';
import Column from '../../../components/column';
import { ColumnHeader } from '../../../components/column_header';
import { Icon } from '../../../components/icon';
import { categoryDisplayName } from '../category_names';

const messages = defineMessages({
  title: { id: 'epsilon_cat.column.title', defaultMessage: 'Category subscriptions' },
  hint: { id: 'epsilon_cat.settings.hint', defaultMessage: 'Subscribe to the topics of your choice to build your feed. Each click is saved instantly.' },
  searchPlaceholder: { id: 'epsilon_cat.settings.search_placeholder', defaultMessage: 'Search for a category…' },
  loading: { id: 'epsilon_cat.settings.loading', defaultMessage: 'Loading…' },
  clearSearch: { id: 'epsilon_cat.settings.clear_search', defaultMessage: 'Clear search' },
  empty: { id: 'epsilon_cat.settings.empty', defaultMessage: 'No category found for "{query}".' },
  error: { id: 'epsilon_cat.settings.error', defaultMessage: '❌ Connection problem, your changes were not saved.' },
});

const EpsilonCategorySettings = () => {
  const intl = useIntl();
  const history = useHistory();

  const [categories, setCategories] = useState([]);
  const [subscribedIds, setSubscribedIds] = useState([]);
  const [pendingIds, setPendingIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasChanged, setHasChanged] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);

    Promise.all([
      api().get('/api/v1/epsilon/categorization/categories'),
      api().get('/api/v1/epsilon/categorization/subscriptions'),
    ]).then(([categoriesRes, subscriptionsRes]) => {
      if (cancelled) return;

      setCategories(categoriesRes.data);
      setSubscribedIds(subscriptionsRes.data);
      setIsLoading(false);
    }).catch(error => {
      if (cancelled) return;

      console.error('Erreur lors du chargement des catégories:', error);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback((categoryId) => {
    if (pendingIds.includes(categoryId)) return;

    const wasSubscribed = subscribedIds.includes(categoryId);

    setHasChanged(true);
    setSubscribedIds(prev => (
      wasSubscribed ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    ));
    setPendingIds(prev => [...prev, categoryId]);

    const request = wasSubscribed
      ? api().delete(`/api/v1/epsilon/categorization/subscriptions/${categoryId}`)
      : api().post(`/api/v1/epsilon/categorization/subscriptions/${categoryId}`);

    request.catch(error => {
      console.error('Erreur lors de la mise à jour de l’abonnement:', error);

      setSubscribedIds(prev => (
        wasSubscribed ? [...prev, categoryId] : prev.filter(id => id !== categoryId)
      ));
      alert(intl.formatMessage(messages.error));
    }).finally(() => {
      setPendingIds(prev => prev.filter(id => id !== categoryId));
    });
  }, [subscribedIds, pendingIds, intl]);

  const handleClickBack = useCallback(() => {
    if (hasChanged) {
      window.location.href = '/home';
    } else {
      history.goBack();
    }
  }, [hasChanged, history]);

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const renderCategoryItem = (category, isSubscribed) => (
    <div
      key={category.id}
      role='button'
      tabIndex={0}
      onClick={() => handleToggle(category.id)}
      className={classNames('epsilon-category-settings__item', {
        'epsilon-category-settings__item--active': isSubscribed,
        'epsilon-category-settings__item--pending': pendingIds.includes(category.id),
      })}
    >
      <span>{categoryDisplayName(intl, category)}</span>
    </div>
  );

  const filteredCategories = categories.filter(c =>
    categoryDisplayName(intl, c).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Column>
      <ColumnHeader
        icon='tile'
        iconComponent={TileIcon}
        title={intl.formatMessage(messages.title)}
        showBackButton
        onClickBack={handleClickBack}
      />

      <div className='scrollable epsilon-category-settings'>
        <div className='epsilon-category-settings__card'>
          <p className='epsilon-category-settings__hint'>
            {intl.formatMessage(messages.hint)}
          </p>

          <div className='epsilon-category-settings__search'>
            <input
              type='text'
              placeholder={intl.formatMessage(messages.searchPlaceholder)}
              value={searchQuery}
              onChange={handleSearchChange}
              className='epsilon-category-settings__search-input'
            />
            {searchQuery && (
              <button
                type='button'
                className='epsilon-category-settings__search-clear'
                onClick={handleClearSearch}
                aria-label={intl.formatMessage(messages.clearSearch)}
                title={intl.formatMessage(messages.clearSearch)}
              >
                <Icon id='times-circle' icon={CancelIcon} />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className='epsilon-category-settings__loading'>
              {intl.formatMessage(messages.loading)}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className='epsilon-category-settings__empty'>
              {intl.formatMessage(messages.empty, { query: searchQuery })}
            </div>
          ) : (
            <div className='epsilon-category-settings__list'>
              {filteredCategories.map(category => (
                renderCategoryItem(category, subscribedIds.includes(category.id))
              ))}
            </div>
          )}
        </div>
      </div>
    </Column>
  );
};

export default EpsilonCategorySettings;
