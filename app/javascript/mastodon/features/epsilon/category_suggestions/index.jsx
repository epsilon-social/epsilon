import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import ArrowRightAltIcon from '@/material-icons/400-24px/arrow_right_alt.svg?react';
import { CircularProgress } from 'mastodon/components/circular_progress';
import { Icon } from 'mastodon/components/icon';
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
  preparing: { id: 'epsilon.category_suggestions.preparing', defaultMessage: 'Preparing your feed…' },
  showMore: { id: 'epsilon.category_suggestions.show_more', defaultMessage: 'Show more' },
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

  const persistSnooze = useCallback((durationMs) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now() + durationMs));
    } catch (error) {
      console.error('Failed to save snooze state:', error);
    }
  }, []);

  const snooze = useCallback((durationMs) => {
    persistSnooze(durationMs);
    setIsHidden(true);
  }, [persistSnooze]);

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
      // Persist the snooze WITHOUT hiding the widget now: the spinner must stay
      // visible until the reload. After reload, isHidden reads it back from
      // localStorage and the widget stays hidden.
      persistSnooze(SNOOZE_AFTER_CONFIRM);
      // Full document reload so the home feed re-fetches with the freshly added
      // category subscriptions. Assigning the same URL doesn't reliably reload
      // (the widget also lives in the home timeline), so force it explicitly.
      if (window.location.pathname === '/home') {
        window.location.reload();
      } else {
        window.location.assign('/home');
      }
      // Keep isSaving=true: the page is unloading. Flipping it back would make
      // the "Confirm" button flash before the reload completes.
    } catch (error) {
      dispatch(showAlertForError(error));
      setIsSaving(false);
    }
  }, [selectedIds, persistSnooze, dispatch]);

  if (isHidden || isLoading || suggestions.length === 0) {
    return null;
  }

  const visibleSuggestions = suggestions.slice(0, MAX_VISIBLE);
  const hasSelection = selectedIds.length > 0;

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
        <div className='epsilon-category-suggestions__action'>
          <Link
            className={classNames('epsilon-category-suggestions__more', {
              'epsilon-category-suggestions__slot--hidden': hasSelection,
            })}
            to='/categories'
            tabIndex={hasSelection ? -1 : undefined}
            aria-hidden={hasSelection || undefined}
          >
            {intl.formatMessage(messages.showMore)}
            <Icon id='arrow-right' icon={ArrowRightAltIcon} />
          </Link>
          <button
            className={classNames('epsilon-category-suggestions__confirm', {
              'epsilon-category-suggestions__slot--hidden': !hasSelection,
            })}
            onClick={handleConfirm}
            type='button'
            disabled={isSaving || !hasSelection}
            tabIndex={hasSelection ? undefined : -1}
            aria-hidden={!hasSelection || undefined}
          >
            {isSaving ? (
              <>
                <CircularProgress size={16} strokeWidth={3} />
                {intl.formatMessage(messages.preparing)}
              </>
            ) : (
              intl.formatMessage(messages.confirm)
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EpsilonCategorySuggestions;
