import { useEffect, useState } from 'react';

import { InlineFollowSuggestions } from 'mastodon/features/home_timeline/components/inline_follow_suggestions';

import EpsilonCategorySuggestions from 'mastodon/features/epsilon/category_suggestions';

const STORAGE_KEY = 'epsilon:last_shown_carousel';
const CATEGORIES = 'categories';
const ACCOUNTS = 'accounts';

const decideVariant = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === CATEGORIES ? ACCOUNTS : CATEGORIES;
  } catch {
    return CATEGORIES;
  }
};

export const AlternatingSuggestions = () => {
  const [variant] = useState(decideVariant);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch {
    }
  }, [variant]);

  if (variant === CATEGORIES) {
    return <EpsilonCategorySuggestions />;
  }

  return <InlineFollowSuggestions />;
};

export default AlternatingSuggestions;
