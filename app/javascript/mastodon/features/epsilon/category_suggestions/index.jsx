import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { Link } from 'react-router-dom';

import { useDispatch } from 'react-redux';

import { showAlertForError } from '../../../actions/alerts';
import api from '../../../api';
import { categoryDisplayName } from '../category_names';

const MAX_VISIBLE = 15;

const messages = defineMessages({
  title: { id: 'epsilon.category_suggestions.title', defaultMessage: 'What to follow' },
});

const STORAGE_KEY = 'epsilon_category_suggestions_dismissed';

const EpsilonCategorySuggestions = () => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const [suggestions, setSuggestions] = useState([]);
  const [subscribedIds, setSubscribedIds] = useState([]);
  const [pendingIds, setPendingIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (error) {
      console.error('Failed to save dismiss state:', error);
    }
  }, []);

  useEffect(() => {
    if (isDismissed) {
      return;
    }
    const fetchSuggestions = async () => {
      try {
        const response = await api().get('/api/v1/epsilon/categorization/categories/suggested');

        const responseData = response?.data || response;
        setSuggestions(Array.isArray(responseData) ? responseData : []);

      } catch (error) {
        console.error('Erreur API suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [isDismissed]);

  const handleToggle = useCallback(async (categoryId) => {
    if (pendingIds.includes(categoryId)) return;

    const wasSubscribed = subscribedIds.includes(categoryId);

    setSubscribedIds(prev => (
      wasSubscribed ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    ));
    setPendingIds(prev => [...prev, categoryId]);

    try {
      if (wasSubscribed) {
        await api().delete(`/api/v1/epsilon/categorization/subscriptions/${categoryId}`);
      } else {
        await api().post(`/api/v1/epsilon/categorization/subscriptions/${categoryId}`);
      }
    } catch (error) {
      setSubscribedIds(prev => (
        wasSubscribed ? [...prev, categoryId] : prev.filter(id => id !== categoryId)
      ));
      dispatch(showAlertForError(error));
    } finally {
      setPendingIds(prev => prev.filter(id => id !== categoryId));
    }
  }, [dispatch, pendingIds, subscribedIds]);

  if (isDismissed || isLoading || suggestions.length === 0) {
    return null;
  }

  const visibleSuggestions = suggestions.slice(0, MAX_VISIBLE);

  return (
    <div className='epsilon-category-suggestions'>
      <div className='epsilon-category-suggestions__header'>
        <h3 className='epsilon-category-suggestions__title'>
          {intl.formatMessage(messages.title)}
        </h3>

        <div className='epsilon-category-suggestions__header__actions'>
          <button className='link-button' onClick={handleDismiss} type='button'>
            <FormattedMessage
              id='follow_suggestions.dismiss'
              defaultMessage="Don't show again"
            />
          </button>
          <Link to='/categories' className='link-button'>
            <FormattedMessage
              id='follow_suggestions.view_all'
              defaultMessage='View all'
            />
          </Link>
        </div>
      </div>

      <div className='epsilon-category-settings__list'>
        {visibleSuggestions.map(category => {
          const isSubscribed = subscribedIds.includes(category.id);

          return (
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
        })}
      </div>
    </div>
  );
};

export default EpsilonCategorySuggestions;
