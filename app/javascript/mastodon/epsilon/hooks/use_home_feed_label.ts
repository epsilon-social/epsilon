// Epsilon — label of the home feed entry (pills bar, sidebar, mobile nav).
// FR/EN get a bespoke label ("Mon fil" / "Your feed"); every other language
// keeps its native translation of the Home tab.

import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  home: { id: 'tabs_bar.home', defaultMessage: 'Home' },
  yourFeed: { id: 'epsilon_home.your_feed', defaultMessage: 'Your feed' },
});

export const useHomeFeedLabel = (): string => {
  const intl = useIntl();
  const localeBase = intl.locale.split('-')[0];

  return intl.formatMessage(
    localeBase === 'fr' || localeBase === 'en'
      ? messages.yourFeed
      : messages.home,
  );
};
