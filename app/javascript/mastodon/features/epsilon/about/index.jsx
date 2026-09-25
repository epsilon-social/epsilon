import PropTypes from 'prop-types';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { Helmet } from '@unhead/react/helmet';

import CategoryIcon from '@/material-icons/400-24px/category.svg?react';
import FlagIcon from '@/material-icons/400-24px/flag.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import MailIcon from '@/material-icons/400-24px/mail.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import ShieldIcon from '@/material-icons/400-24px/shield.svg?react';
import VisibilityOffIcon from '@/material-icons/400-24px/visibility_off.svg?react';
import Column from '@/mastodon/components/column';
import { Icon } from '@/mastodon/components/icon';
import { WordmarkLogo } from '@/mastodon/components/logo';
import { LinkFooter } from '@/mastodon/features/ui/components/link_footer';

import { getColumnSkipLinkId } from '../../ui/components/skip_links';

const SUPPORT_EMAIL = 'support@epsilon.social';
const MODERATION_EMAIL = 'moderation@epsilon.social';

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
  contactTitle: { id: 'epsilon.about.contact.title', defaultMessage: 'Contact & administration' },
  supportTitle: { id: 'epsilon.about.contact.support.title', defaultMessage: 'General support' },
  supportBody: {
    id: 'epsilon.about.contact.support.body',
    defaultMessage: 'A question, a technical issue, or feedback about Epsilon? Write to our support team and we will help.',
  },
  reportTitle: { id: 'epsilon.about.contact.report.title', defaultMessage: 'Report content' },
  reportBody: {
    id: 'epsilon.about.contact.report.body',
    defaultMessage: 'To report a post, an account, or any content that breaks our rules, contact our moderation team. We are committed to reviewing every report within 24 hours.',
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

        <section className='epsilon-about__contact'>
          <h2 className='epsilon-about__contact-title'>
            {intl.formatMessage(messages.contactTitle)}
          </h2>

          <div className='epsilon-about__contact-grid'>
            <article className='epsilon-about__contact-card'>
              <span className='epsilon-about__contact-icon'>
                <Icon id='mail' icon={MailIcon} />
              </span>
              <h3 className='epsilon-about__contact-card-title'>
                {intl.formatMessage(messages.supportTitle)}
              </h3>
              <p className='epsilon-about__contact-card-body'>
                {intl.formatMessage(messages.supportBody)}
              </p>
              <a className='epsilon-about__contact-mail' href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </article>

            <article className='epsilon-about__contact-card'>
              <span className='epsilon-about__contact-icon'>
                <Icon id='flag' icon={FlagIcon} />
              </span>
              <h3 className='epsilon-about__contact-card-title'>
                {intl.formatMessage(messages.reportTitle)}
              </h3>
              <p className='epsilon-about__contact-card-body'>
                {intl.formatMessage(messages.reportBody)}
              </p>
              <a className='epsilon-about__contact-mail' href={`mailto:${MODERATION_EMAIL}`}>
                {MODERATION_EMAIL}
              </a>
            </article>
          </div>

          <p className='epsilon-about__contact-legal'>
            <FormattedMessage
              id='epsilon.about.contact.legal'
              defaultMessage='Read our {terms} and our {privacy}.'
              values={{
                terms: (
                  <Link to='/terms-of-service'>
                    <FormattedMessage id='epsilon.about.contact.terms' defaultMessage='Terms of Service' />
                  </Link>
                ),
                privacy: (
                  <Link to='/privacy-policy'>
                    <FormattedMessage id='epsilon.about.contact.privacy' defaultMessage='Privacy Policy' />
                  </Link>
                ),
              }}
            />
          </p>
        </section>

        <LinkFooter context='about' />

        <p className='epsilon-about__credit'>
          <FormattedMessage
            id='epsilon.about.illustrations_credit'
            defaultMessage='Illustrations by {storyset}'
            values={{ storyset: <a href='https://storyset.com' target='_blank' rel='noopener'>Storyset</a> }}
          />
        </p>
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.columnTitle)}</title>
        <meta name='robots' content='all' />
      </Helmet>
    </Column>
  );
};

EpsilonAbout.propTypes = {
  multiColumn: PropTypes.bool,
};

export default EpsilonAbout;
