import { useEffect, useMemo } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { fetchServer } from '@/mastodon/actions/server';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

// Mirrors the native RulesSection translation pick (features/about/components/rules.tsx),
// but auto-selects the UI locale instead of showing a language dropdown.
const localizeRule = (rule, locale) => {
  const translations = rule.translations;

  if (!translations) {
    return rule;
  }

  const translation =
    translations[locale] ?? translations[locale.split('-')[0]];

  return translation
    ? { ...rule, text: translation.text, hint: translation.hint }
    : rule;
};

export const EpsilonRulesSection = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const rules = useAppSelector((state) => state.server.server.item?.rules);

  useEffect(() => {
    if (!rules) {
      dispatch(fetchServer());
    }
  }, [dispatch, rules]);

  const localizedRules = useMemo(
    () => (rules ?? []).map((rule) => localizeRule(rule, intl.locale)),
    [rules, intl.locale],
  );

  if (localizedRules.length === 0) {
    return null;
  }

  return (
    <section className='epsilon-about__rules'>
      <h2 className='epsilon-about__rules-title'>
        <FormattedMessage
          id='epsilon.about.rules.title'
          defaultMessage='Server rules'
        />
      </h2>
      <p className='epsilon-about__rules-lead'>
        <FormattedMessage
          id='epsilon.about.rules.lead'
          defaultMessage='Everyone agrees to these rules when creating an account.'
        />
      </p>

      <ol className='epsilon-about__rules-list'>
        {localizedRules.map((rule, index) => (
          <li className='epsilon-about__rule' key={rule.id}>
            <span className='epsilon-about__rule-number' aria-hidden='true'>
              {index + 1}
            </span>
            <div className='epsilon-about__rule-content'>
              <span className='epsilon-about__rule-text'>{rule.text}</span>
              {!!rule.hint && (
                <span className='epsilon-about__rule-hint'>{rule.hint}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
