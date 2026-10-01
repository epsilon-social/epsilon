import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import HourglassIcon from '@/material-icons/400-24px/hourglass.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import { fetchRelationships, followAccount } from 'mastodon/actions/accounts';
import { openModal } from 'mastodon/actions/modal';
import { Icon } from 'mastodon/components/icon';
import { useIdentity } from 'mastodon/identity_context';
import { me } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  follow: { id: 'epsilon.status_follow.follow', defaultMessage: 'Follow {name}' },
  unfollow: { id: 'epsilon.status_follow.unfollow', defaultMessage: 'Unfollow {name}' },
  requested: { id: 'epsilon.status_follow.requested', defaultMessage: 'Follow request pending' },
});

export const EpsilonStatusFollowButton = ({ accountId }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();

  const account = useAppSelector((state) => (accountId ? state.accounts.get(accountId) : undefined));
  const relationship = useAppSelector((state) => (accountId ? state.relationships.get(accountId) : undefined));

  const engaged = !!(relationship && (relationship.following || relationship.requested));

  const [anim, setAnim] = useState(null);
  const prevEngaged = useRef();

  useEffect(() => {
    if (accountId && signedIn) {
      dispatch(fetchRelationships([accountId]));
    }
  }, [dispatch, accountId, signedIn]);

  useEffect(() => {
    if (!relationship) {
      return;
    }

    if (prevEngaged.current !== undefined && prevEngaged.current !== engaged) {
      setAnim(engaged ? 'in' : 'out');
    }

    prevEngaged.current = engaged;
  }, [relationship, engaged]);

  const handleAnimationEnd = useCallback((e) => {
    if (e.target === e.currentTarget) {
      setAnim(null);
    }
  }, []);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!signedIn) {
      dispatch(openModal({
        modalType: 'INTERACTION',
        modalProps: { intent: 'follow', accountId, url: account?.url },
      }));
      return;
    }

    if (!relationship || !accountId) {
      return;
    }

    if (relationship.following) {
      dispatch(openModal({ modalType: 'CONFIRM_UNFOLLOW', modalProps: { account } }));
    } else if (relationship.requested) {
      dispatch(openModal({ modalType: 'CONFIRM_WITHDRAW_REQUEST', modalProps: { account } }));
    } else {
      dispatch(followAccount(accountId));
    }
  }, [dispatch, signedIn, accountId, account, relationship]);

  if (!accountId || accountId === me) {
    return null;
  }

  const loading = signedIn && !relationship;

  if (relationship && (relationship.blocking || relationship.blocked_by || relationship.muting)) {
    return null;
  }

  if (account && (account.suspended || !!account.moved)) {
    return null;
  }

  const name = account?.display_name || account?.username || '';

  const pendingApproval = !!relationship?.requested && !!account?.locked;

  let label;
  let icon;

  if (pendingApproval) {
    label = intl.formatMessage(messages.requested);
    icon = HourglassIcon;
  } else if (engaged) {
    label = intl.formatMessage(messages.unfollow, { name });
    icon = CheckIcon;
  } else {
    label = intl.formatMessage(messages.follow, { name });
    icon = PersonAddIcon;
  }

  return (
    <button
      type='button'
      className={classNames('epsilon-status-follow', {
        'epsilon-status-follow--ghost': loading,
        'epsilon-status-follow--engaged': engaged,
        'epsilon-status-follow--anim-in': anim === 'in',
        'epsilon-status-follow--anim-out': anim === 'out',
      })}
      disabled={loading}
      aria-hidden={loading || undefined}
      tabIndex={loading ? -1 : undefined}
      title={loading ? undefined : label}
      aria-label={label}
      onClick={handleClick}
      onAnimationEnd={handleAnimationEnd}
    >
      <span className='epsilon-status-follow__bubble' aria-hidden='true' />
      <Icon id='person-add' icon={icon} />
    </button>
  );
};

EpsilonStatusFollowButton.propTypes = {
  accountId: PropTypes.string,
};
