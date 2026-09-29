import { useIntl, defineMessages } from 'react-intl';

import appStoreEnBlack from '@/images/epsilon/badges/app-store-en-black.svg';
import appStoreEnWhite from '@/images/epsilon/badges/app-store-en-white.svg';
import appStoreFrBlack from '@/images/epsilon/badges/app-store-fr-black.svg';
import appStoreFrWhite from '@/images/epsilon/badges/app-store-fr-white.svg';
import googlePlayEn from '@/images/epsilon/badges/google-play-en.svg';
import googlePlayFr from '@/images/epsilon/badges/google-play-fr.svg';

const messages = defineMessages({
  appStore: {
    id: 'epsilon.store_badges.app_store',
    defaultMessage: 'Download on the App Store',
  },
  googlePlay: {
    id: 'epsilon.store_badges.google_play',
    defaultMessage: 'Get it on Google Play',
  },
  comingSoon: {
    id: 'epsilon.store_badges.coming_soon',
    defaultMessage: 'Coming soon',
  },
});

const APP_STORE_URL = 'https://apps.apple.com/app/epsilon-social/id6804720532';
const GOOGLE_PLAY_URL = '';

const GOOGLE_PLAY_AVAILABLE = false;

const EpsilonStoreBadges = () => {
  const intl = useIntl();

  if (document.documentElement.classList.contains('epsilon-in-app')) {
    return null;
  }

  const isFrench = intl.locale.toLowerCase().startsWith('fr');
  const appStoreBlack = isFrench ? appStoreFrBlack : appStoreEnBlack;
  const appStoreWhite = isFrench ? appStoreFrWhite : appStoreEnWhite;
  const googlePlay = isFrench ? googlePlayFr : googlePlayEn;

  return (
    <div className='epsilon-store-badges'>
      <a
        href={APP_STORE_URL}
        target='_blank'
        rel='noopener noreferrer'
        className='epsilon-store-badges__link'
      >
        <img
          src={appStoreBlack}
          alt={intl.formatMessage(messages.appStore)}
          className='epsilon-store-badges__img epsilon-store-badges__img--on-light'
        />
        <img
          src={appStoreWhite}
          alt={intl.formatMessage(messages.appStore)}
          className='epsilon-store-badges__img epsilon-store-badges__img--on-dark'
        />
      </a>

      {GOOGLE_PLAY_AVAILABLE ? (
        <a
          href={GOOGLE_PLAY_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='epsilon-store-badges__link'
        >
          <img
            src={googlePlay}
            alt={intl.formatMessage(messages.googlePlay)}
            className='epsilon-store-badges__img'
          />
        </a>
      ) : (
        <div className='epsilon-store-badges__link epsilon-store-badges__link--soon'>
          <img
            src={googlePlay}
            alt={intl.formatMessage(messages.googlePlay)}
            className='epsilon-store-badges__img'
          />
          <span className='epsilon-store-badges__soon'>
            {intl.formatMessage(messages.comingSoon)}
          </span>
        </div>
      )}
    </div>
  );
};

export default EpsilonStoreBadges;
