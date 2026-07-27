import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { useDispatch } from 'react-redux';

import { useIdentity } from 'mastodon/identity_context';

import { showAlertForError } from '../../../actions/alerts';
import api from '../../../api';
import { categoryDisplayName } from '../category_names';

const MAX_VISIBLE = 10;

const messages = defineMessages({
  title: { id: 'epsilon.category_suggestions.title', defaultMessage: 'Improve your feed relevance' },
  description: { id: 'epsilon.category_suggestions.description', defaultMessage: 'Choose the topics to prioritize in your feed.' },
  descriptionNote: { id: 'epsilon.category_suggestions.description_note', defaultMessage: 'You can change these settings at any time.' },
  confirm: { id: 'epsilon.category_suggestions.confirm', defaultMessage: 'Confirm' },
});

const STORAGE_KEY = 'epsilon_category_suggestions_snoozed_until';
const DAY_MS = 24 * 60 * 60 * 1000;
const SNOOZE_AFTER_CONFIRM = 7 * DAY_MS;
const SNOOZE_AFTER_DISMISS = 30 * DAY_MS;

const EpsilonCategorySuggestions = () => {
  const intl = useIntl();
  const dispatch = useDispatch();
  const { signedIn } = useIdentity();
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isHidden, setIsHidden] = useState(() => {
    try {
      const until = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
      return Date.now() < until;
    } catch {
      return false;
    }
  });

  const snooze = useCallback((durationMs) => {
    setIsHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + durationMs));
    } catch (error) {
      console.error('Failed to save snooze state:', error);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    snooze(SNOOZE_AFTER_DISMISS);
  }, [snooze]);

  useEffect(() => {
    if (isHidden || !signedIn) {
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
  }, [isHidden, signedIn]);

  const handleToggleSelect = useCallback((categoryId) => {
    setSelectedIds(prev => (
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    ));
  }, []);

  const handleConfirm = useCallback(async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        selectedIds.map(id => api().post(`/api/v1/epsilon/categorization/subscriptions/${id}`))
      );
      snooze(SNOOZE_AFTER_CONFIRM);
      window.location.href = '/home';
    } catch (error) {
      dispatch(showAlertForError(error));
    } finally {
      setIsSaving(false);
    }
  }, [selectedIds, snooze, dispatch]);

  if (isHidden || isLoading || suggestions.length === 0) {
    return null;
  }

  const visibleSuggestions = suggestions.slice(0, MAX_VISIBLE);

  return (
    <div className='epsilon-category-suggestions'>
      <h3 className='epsilon-category-suggestions__title'>
        {intl.formatMessage(messages.title)}
      </h3>

      <p className='epsilon-category-suggestions__description'>
        {intl.formatMessage(messages.description)}{' '}
        <em>{intl.formatMessage(messages.descriptionNote)}</em>
      </p>

      <div className='epsilon-category-suggestions__list'>
        {visibleSuggestions.map(category => (
          <button
            key={category.id}
            type='button'
            onClick={() => handleToggleSelect(category.id)}
            className={classNames('epsilon-category-suggestions__pill', {
              'epsilon-category-suggestions__pill--active': selectedIds.includes(category.id),
            })}
          >
            {categoryDisplayName(intl, category)}
          </button>
        ))}
      </div>

      <div className='epsilon-category-suggestions__footer'>
        <button
          className='epsilon-category-suggestions__dismiss'
          onClick={handleDismiss}
          type='button'
        >
          <FormattedMessage id='follow_suggestions.dismiss' defaultMessage="Don't show again" />
        </button>
        <button
          className='epsilon-category-suggestions__confirm'
          onClick={handleConfirm}
          type='button'
          disabled={isSaving}
        >
          {intl.formatMessage(messages.confirm)}
        </button>
      </div>
    </div>
  );
};

export default EpsilonCategorySuggestions;
