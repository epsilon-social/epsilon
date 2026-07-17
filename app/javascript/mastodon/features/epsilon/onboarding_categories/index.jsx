import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from '@unhead/react/helmet';
import { useHistory } from 'react-router-dom';

import { Button } from 'mastodon/components/button';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import api from 'mastodon/api';
import TileIcon from '@/material-icons/400-24px/tile.svg?react';
import { categoryDisplayName } from '../category_names';

const messages = defineMessages({
  title: { id: 'epsilon.onboarding.categories.title', defaultMessage: 'Choose your interests' },
  columnTitle: { id: 'epsilon.onboarding.categories.column_title', defaultMessage: 'Follow topics to get started' },
  description: { id: 'epsilon.onboarding.categories.description', defaultMessage: 'Select topics you\'re interested in to personalize your feed' },
  continue: { id: 'epsilon.onboarding.categories.continue', defaultMessage: 'Continue' },
  skip: { id: 'epsilon.onboarding.categories.skip', defaultMessage: 'Skip for now' },
  loading: { id: 'epsilon.onboarding.categories.loading', defaultMessage: 'Loading categories...' },
  error: { id: 'epsilon.onboarding.categories.error', defaultMessage: 'Failed to load categories' },
  subscribers: { id: 'epsilon.onboarding.categories.subscribers', defaultMessage: '{count} subscribers' },
  showMore: { id: 'epsilon.onboarding.categories.show_more', defaultMessage: 'Show more categories' },
});

const VISIBLE_LIMIT = 20;

const CategoryTile = ({ category, isSelected, onToggle }) => {
  const intl = useIntl();

  return (
    <button
      type='button'
      className={`epsilon-category-tile ${isSelected ? 'epsilon-category-tile--selected' : ''}`}
      onClick={() => onToggle(category.id)}
    >
      <div className='epsilon-category-tile__content'>
        <div className='epsilon-category-tile__name'>
          {categoryDisplayName(intl, category)}
        </div>
        {/* <div className='epsilon-category-tile__stats'>
          {intl.formatMessage(messages.subscribers, { count: category.subscribers_count })}
        </div>*/}
      </div>
    </button>
  );
};

CategoryTile.propTypes = {
  category: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    subscribers_count: PropTypes.number.isRequired,
  }).isRequired,
  isSelected: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

const EpsilonOnboardingCategories = () => {
  const intl = useIntl();
  const history = useHistory();

  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [categoriesRes, subscriptionsRes] = await Promise.all([
          api().get('/api/v1/epsilon/categorization/categories'),
          api().get('/api/v1/epsilon/categorization/subscriptions'),
        ]);

        const categoriesData = categoriesRes?.data || categoriesRes;
        const nextCategories = Array.isArray(categoriesData) ? categoriesData : [];
        setCategories(nextCategories);

        const subscriptionsData = subscriptionsRes?.data || subscriptionsRes;
        const subscribedIds = Array.isArray(subscriptionsData) ? subscriptionsData : [];
        setSelectedCategories(subscribedIds);

        const hasHiddenSubscription = nextCategories
          .slice(VISIBLE_LIMIT)
          .some(category => subscribedIds.includes(category.id));
        if (hasHiddenSubscription) {
          setIsExpanded(true);
        }

        setError(null);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setError(intl.formatMessage(messages.error));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [intl]);

  const handleToggleCategory = useCallback((categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  }, []);

  const handleContinue = useCallback(async () => {
    try {
      setIsSaving(true);
      await api().put('/api/v1/epsilon/categorization/subscriptions', {
        category_ids: selectedCategories,
      });
      history.push('/start/follows');
    } catch (err) {
      console.error('Failed to save categories:', err);
      setError(intl.formatMessage(messages.error));
    } finally {
      setIsSaving(false);
    }
  }, [selectedCategories, history, intl]);

  const handleSkip = useCallback(() => {
    history.push('/start/follows');
  }, [history]);

  const safeCategories = categories || [];
  const visibleCategories = isExpanded ? safeCategories : safeCategories.slice(0, VISIBLE_LIMIT);
  const hasMoreCategories = safeCategories.length > VISIBLE_LIMIT && !isExpanded;

  if (isLoading) {
    return (
      <Column>
        <ColumnHeader title={intl.formatMessage(messages.columnTitle)} />
        <LoadingIndicator />
      </Column>
    );
  }

  return (
    <Column
       label={intl.formatMessage(messages.columnTitle)}
    >
      <ColumnHeader
      icon='tile'
      iconComponent={TileIcon}
      title={intl.formatMessage(messages.columnTitle)} />

      <div className='scrollable'>
        <div className='epsilon-onboarding-categories'>
          <Helmet>
            <title>{intl.formatMessage(messages.title)}</title>
            <meta name='robots' content='noindex' />
          </Helmet>

          <div className='epsilon-onboarding-categories__description'>
            <p>{intl.formatMessage(messages.description)}</p>
          </div>

          {error && (
            <div className='epsilon-onboarding-categories__error'>
              {error}
            </div>
          )}

          <div className='epsilon-onboarding-categories__grid'>
            {visibleCategories.map(category => (
              <CategoryTile
                key={category.id}
                category={category}
                isSelected={selectedCategories.includes(category.id)}
                onToggle={handleToggleCategory}
              />
            ))}
          </div>

          {hasMoreCategories && (
            <div className='epsilon-onboarding-categories__expand'>
              <Button
                text={intl.formatMessage(messages.showMore)}
                onClick={() => setIsExpanded(true)}
                secondary
              />
            </div>
          )}

          <div className='epsilon-onboarding-categories__actions'>
            <Button
              text={intl.formatMessage(messages.continue)}
              onClick={handleContinue}
              disabled={isSaving}
            />
            <Button
              text={intl.formatMessage(messages.skip)}
              onClick={handleSkip}
              secondary
              disabled={isSaving}
            />
          </div>
        </div>
      </div>
    </Column>
  );
};

export default EpsilonOnboardingCategories;
