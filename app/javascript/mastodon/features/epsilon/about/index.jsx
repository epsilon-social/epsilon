import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from '@unhead/react/helmet';

import CategoryIcon from '@/material-icons/400-24px/category.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import ShieldIcon from '@/material-icons/400-24px/shield.svg?react';
import VisibilityOffIcon from '@/material-icons/400-24px/visibility_off.svg?react';
import Column from '@/mastodon/components/column';
import { Icon } from '@/mastodon/components/icon';
import { WordmarkLogo } from '@/mastodon/components/logo';
import { LinkFooter } from '@/mastodon/features/ui/components/link_footer';

import { getColumnSkipLinkId } from '../../ui/components/skip_links';

const messages = defineMessages({
  columnTitle: { id: 'epsilon.about.title', defaultMessage: 'About' },
  tagline: {
    id: 'epsilon.about.tagline',
    defaultMessage: 'The European social network, sovereign and built to respect you.',
  },
  pillarEuropeanTitle: { id: 'epsilon.about.pillar.european.title', defaultMessage: 'European & sovereign' },
  pillarEuropeanBody: {
    id: 'epsilon.about.pillar.european.body',
    defaultMessage: 'Hosted in Europe, on European services, under European law. Your data stays in the EU and is GDPR-compliant.',
  },
  pillarModerationTitle: { id: 'epsilon.about.pillar.moderation.title', defaultMessage: 'Human moderation' },
  pillarModerationBody: {
    id: 'epsilon.about.pillar.moderation.body',
    defaultMessage: 'Moderation happens before publishing: every post is first checked by AI. Sensitive content, cases where the AI is unsure, and anything flagged go through human review.',
  },
  pillarNoManipTitle: { id: 'epsilon.about.pillar.no_manip.title', defaultMessage: 'No manipulation' },
  pillarNoManipBody: {
    id: 'epsilon.about.pillar.no_manip.body',
    defaultMessage: 'No addictive algorithm, no dark patterns, no psychological exploitation. You decide what you see, and when you stop.',
  },
  pillarPrivacyTitle: { id: 'epsilon.about.pillar.privacy.title', defaultMessage: 'Privacy respected' },
  pillarPrivacyBody: {
    id: 'epsilon.about.pillar.privacy.body',
    defaultMessage: 'No advertising trackers, no profiling, no selling your data. Your attention is not for sale.',
  },
  pillarOpenTitle: { id: 'epsilon.about.pillar.open.title', defaultMessage: 'Open & interoperable' },
  pillarOpenBody: {
    id: 'epsilon.about.pillar.open.body',
    defaultMessage: 'Built on open standards (ActivityPub). You are never locked in. Take your audience with you.',
  },
  pillarTopicsTitle: { id: 'epsilon.about.pillar.topics.title', defaultMessage: 'Topics, not addiction' },
  pillarTopicsBody: {
    id: 'epsilon.about.pillar.topics.body',
    defaultMessage: 'Discover through the content categories you care about, not through a machine engineered to keep you scrolling.',
  },
});

const PILLARS = [
  { key: 'european', icon: PublicIcon, title: messages.pillarEuropeanTitle, body: messages.pillarEuropeanBody },
  { key: 'moderation', icon: ShieldIcon, title: messages.pillarModerationTitle, body: messages.pillarModerationBody },
  { key: 'no_manip', icon: VisibilityOffIcon, title: messages.pillarNoManipTitle, body: messages.pillarNoManipBody },
  { key: 'privacy', icon: LockIcon, title: messages.pillarPrivacyTitle, body: messages.pillarPrivacyBody },
  { key: 'open', icon: ShareIcon, title: messages.pillarOpenTitle, body: messages.pillarOpenBody },
  { key: 'topics', icon: CategoryIcon, title: messages.pillarTopicsTitle, body: messages.pillarTopicsBody },
];

const EpsilonAbout = ({ multiColumn }) => {
  const intl = useIntl();

  return (
    <Column bindToDocument={!multiColumn} label={intl.formatMessage(messages.columnTitle)}>
      <div className='scrollable epsilon-about' id={getColumnSkipLinkId(1)}>
        <header className='epsilon-about__hero'>
          <WordmarkLogo />
          <h1 className='epsilon-about__hero-title'>
            {intl.formatMessage(messages.tagline)}
          </h1>
          <p className='epsilon-about__hero-lead'>
            <FormattedMessage
              id='epsilon.about.intro'
              defaultMessage='Epsilon is a social network made in Europe. No manipulative algorithms, no attention traps, no data resale. Just people, conversations, and the topics you choose.'
            />
          </p>
        </header>

        <section className='epsilon-about__pillars'>
          {PILLARS.map((pillar) => (
            <article className='epsilon-about__pillar' key={pillar.key}>
              <span className='epsilon-about__pillar-icon'>
                <Icon id={pillar.key} icon={pillar.icon} />
              </span>
              <h2 className='epsilon-about__pillar-title'>
                {intl.formatMessage(pillar.title)}
              </h2>
              <p className='epsilon-about__pillar-body'>
                {intl.formatMessage(pillar.body)}
              </p>
            </article>
          ))}
        </section>

        <section className='epsilon-about__manifesto'>
          <h2 className='epsilon-about__manifesto-title'>
            <FormattedMessage id='epsilon.about.manifesto.title' defaultMessage='Our commitment' />
          </h2>
          <p>
            <FormattedMessage
              id='epsilon.about.manifesto.body'
              defaultMessage='Epsilon exists because social media should serve people, not exploit them. We believe a network can be engaging without being addictive, safe without being authoritarian, and open without being chaotic. That is the balance we are building in Europe, for everyone.'
            />
          </p>
        </section>

        <LinkFooter context='about' />
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.columnTitle)}</title>
        <meta name='robots' content='all' />
      </Helmet>
    </Column>
  );
};

export default EpsilonAbout;
