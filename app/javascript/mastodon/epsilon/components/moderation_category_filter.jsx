import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import classNames from 'classnames';

import api from 'mastodon/api';
import { categoryDisplayName } from 'mastodon/features/epsilon/category_names';

// Epsilon — moderation live feed filter: category pills.
//
// Multi-select list of the active categories for the moderator-only category
// filter on the live feed (Firehose), plus an "All" pill that selects every
// category at once (and clears the selection when everything is already
// selected). The list is fetched once on mount from the categorization API;
// the selection is owned by the parent (persisted in the `firehose`
// settings).

const messages = defineMessages({
  all: { id: 'firehose.moderation_filter.categories_all', defaultMessage: 'All' },
});

export const ModerationCategoryFilter = ({ selectedIds, onToggle, onToggleAll }) => {
  const intl = useIntl();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;

    api().get('/api/v1/epsilon/categorization/categories').then((response) => {
      if (!cancelled) {
        setCategories(response.data);
      }

      return undefined;
    }).catch(() => {
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    (e) => onToggle(Number(e.currentTarget.dataset.categoryId)),
    [onToggle],
  );

  const handleToggleAll = useCallback(
    () => onToggleAll(categories.map((category) => category.id)),
    [onToggleAll, categories],
  );

  if (categories.length === 0) {
    return null;
  }

  const allSelected = categories.every((category) => selectedIds.includes(category.id));

  return (
    <div className='firehose__mod-filter__categories' role='group'>
      <button
        type='button'
        className={classNames('firehose__mod-filter__scope', { active: allSelected })}
        aria-pressed={allSelected}
        onClick={handleToggleAll}
      >
        {intl.formatMessage(messages.all)}
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          type='button'
          data-category-id={category.id}
          className={classNames('firehose__mod-filter__scope', { active: selectedIds.includes(category.id) })}
          aria-pressed={selectedIds.includes(category.id)}
          onClick={handleToggle}
        >
          {categoryDisplayName(intl, category)}
        </button>
      ))}
    </div>
  );
};

ModerationCategoryFilter.propTypes = {
  selectedIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  onToggle: PropTypes.func.isRequired,
  onToggleAll: PropTypes.func.isRequired,
};
