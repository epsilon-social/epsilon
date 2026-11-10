import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAppDispatch } from 'mastodon/store';
import { clearTimeline, expandHomeTimeline } from 'mastodon/actions/timelines';
import api from 'mastodon/api';
import { FormattedMessage } from 'react-intl';
import Overlay from 'react-overlays/esm/Overlay';

import { Icon } from 'mastodon/components/icon';
import TranslateIcon from '@/material-icons/400-24px/translate.svg?react';
import classNames from 'classnames';

import { useDropdownDismiss } from '../hooks/use_dropdown_dismiss';

// Language scope for category-injected content. Content from followed
// accounts is never filtered: this only scopes platform recommendations.
// The preference is stored server-side, so web and the mobile shells
// always agree.
const FEED_LANGUAGES = ['fr', 'en', 'all'];

export const EpsilonFeedLanguage = () => {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [feedLanguage, setFeedLanguage] = useState(null);
  const [saving, setSaving] = useState(false);
  const buttonRef = useRef(null);
  const containerRef = useRef(null);
  const accessibleId = useId();

  // The button label is static, so the preference is only needed once the
  // popover opens; the pills stay disabled until it arrives.
  useEffect(() => {
    if (!open || feedLanguage !== null) {
      return;
    }

    api().get('/api/v1/epsilon/categorization/feed_language_preference').then(({ data }) => {
      setFeedLanguage(data.languages?.[0] ?? 'all');
    }).catch(() => {
      setFeedLanguage('all');
    });
  }, [open, feedLanguage]);

  const handleClick = useCallback(() => setOpen((value) => !value), []);
  const handleHide = useCallback(() => setOpen(false), []);

  useDropdownDismiss(open, handleHide, containerRef, buttonRef);

  const handleLanguageClick = useCallback((event) => {
    const { language } = event.currentTarget.dataset;

    if (language === feedLanguage || saving) {
      return;
    }

    setFeedLanguage(language);
    setSaving(true);
    setOpen(false);

    api().put('/api/v1/epsilon/categorization/feed_language_preference', {
      languages: language === 'all' ? [] : [language],
    }).then(() => {
      dispatch(clearTimeline('home'));
      dispatch(expandHomeTimeline());
    }).catch(() => {
      setFeedLanguage(feedLanguage);
    }).finally(() => {
      setSaving(false);
    });
  }, [dispatch, feedLanguage, saving]);

  return (
    <div className='epsilon-home-filter epsilon-feed-language' ref={containerRef}>
      <button
        type='button'
        className={classNames('epsilon-filter-btn', { active: open })}
        ref={buttonRef}
        onClick={handleClick}
        aria-expanded={open}
        aria-controls={`${accessibleId}-wrapper`}
      >
        <Icon id='translate' icon={TranslateIcon} />
        <FormattedMessage id='epsilon.home.filter.language' defaultMessage='Language' />
      </button>

      <Overlay
        show={open}
        target={buttonRef}
        placement='bottom-start'
        popperConfig={{ modifiers: [{ name: 'offset', options: { offset: [0, 10] } }] }}
        container={containerRef}
      >
        {({ props }) => (
          <div
            {...props}
            id={`${accessibleId}-wrapper`}
            className='epsilon-filter-dropdown epsilon-feed-language__dropdown'
          >
            <span className='epsilon-filter-dropdown__title' id={`${accessibleId}-label`}>
              <FormattedMessage id='epsilon.home.filter.suggested_language' defaultMessage='Language of suggested content' />
            </span>

            <p className='epsilon-filter-dropdown__hint'>
              <FormattedMessage
                id='epsilon.home.filter.suggested_language.hint'
                defaultMessage='Only applies to posts suggested through your category subscriptions. Posts from people you follow are never filtered.'
              />
            </p>

            <div className='epsilon-filter-segmented' role='group' aria-labelledby={`${accessibleId}-label`}>
              {FEED_LANGUAGES.map((language) => (
                <button
                  key={language}
                  type='button'
                  data-language={language}
                  className={classNames('epsilon-filter-segmented__option', { active: feedLanguage === language })}
                  disabled={feedLanguage === null || saving}
                  aria-pressed={feedLanguage === language}
                  onClick={handleLanguageClick}
                >
                  {language === 'all'
                    ? <FormattedMessage id='epsilon.home.filter.suggested_language.all' defaultMessage='All' />
                    : language.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </Overlay>
    </div>
  );
};
