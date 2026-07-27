import { useEffect, useRef } from 'react';

import PropTypes from 'prop-types';

import { epsilonSetInlineReply, resetCompose } from 'mastodon/actions/compose';
import ComposeFormContainer from 'mastodon/features/compose/containers/compose_form_container';
import { useEpsilonCompose } from 'mastodon/features/epsilon/compose_modal';
import { useIdentity } from 'mastodon/identity_context';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

export const EpsilonInlineReply = ({ statusId }) => {
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();
  const { open, setInlineReplyActive } = useEpsilonCompose();

  const inReplyTo = useAppSelector((state) =>
    state.compose.get('in_reply_to'),
  );
  const quotedStatusId = useAppSelector((state) =>
    state.compose.get('quoted_status_id'),
  );
  const composeIsFree = useAppSelector(
    (state) =>
      (state.compose.get('text') ?? '').trim().length === 0 &&
      state.compose.get('media_attachments').isEmpty() &&
      !state.compose.get('in_reply_to') &&
      !state.compose.get('quoted_status_id'),
  );

  const ownsRef = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      return undefined;
    }

    setInlineReplyActive(true);

    return () => {
      setInlineReplyActive(false);
      if (ownsRef.current) {
        dispatch(resetCompose());
        ownsRef.current = false;
      }
    };
  }, [signedIn, dispatch, setInlineReplyActive]);

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    if (open) {
      if (ownsRef.current) {
        dispatch(resetCompose());
        ownsRef.current = false;
      }
      return;
    }

    if (!inReplyTo && !quotedStatusId && (composeIsFree || ownsRef.current)) {
      dispatch(epsilonSetInlineReply(statusId));
      ownsRef.current = true;
    }
  }, [signedIn, open, inReplyTo, quotedStatusId, composeIsFree, statusId, dispatch]);

  if (!signedIn || open) {
    return null;
  }

  return (
    <div className='epsilon-inline-reply'>
      <ComposeFormContainer singleColumn />
    </div>
  );
};

EpsilonInlineReply.propTypes = {
  statusId: PropTypes.string.isRequired,
};

export default EpsilonInlineReply;
