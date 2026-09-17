import { useEffect, useRef, useState } from 'react';

import PropTypes from 'prop-types';

import classNames from 'classnames';

import { epsilonSetInlineReply, resetCompose } from 'mastodon/actions/compose';
import ComposeFormContainer from 'mastodon/features/compose/containers/compose_form_container';
import { useEpsilonCompose } from 'mastodon/features/epsilon/compose_modal';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const ANIM_MS = 320;

// On-demand reply composer shown under a detailed status. It is rendered only
// while `visible` (the post's reply button toggles it); replies to other
// statuses in the thread go through the compose modal instead. Driven by a
// `visible` prop rather than conditional mounting so it can fold up on close
// before unmounting.
export const EpsilonInlineReply = ({ statusId, visible, onClose }) => {
  const dispatch = useAppDispatch();
  const { open, setInlineReplyActive } = useEpsilonCompose();

  const inReplyTo = useAppSelector((state) => state.compose.get('in_reply_to'));
  const quotedStatusId = useAppSelector((state) =>
    state.compose.get('quoted_status_id'),
  );
  const isSubmitting = useAppSelector((state) =>
    state.compose.get('is_submitting'),
  );
  const composeCleared = useAppSelector(
    (state) =>
      (state.compose.get('text') ?? '').trim().length === 0 &&
      state.compose.get('media_attachments').isEmpty(),
  );

  const ownsRef = useRef(false);
  const wasSubmitting = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // `mounted` keeps the composer in the DOM through the fold-out; `expanded`
  // drives the grid unfold; `settled` drops the clip once fully open so
  // autosuggest popups aren't cut off (re-clipped while animating).
  const [mounted, setMounted] = useState(visible);
  const [expanded, setExpanded] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return undefined;
    }

    // Closing: fold up, re-clip, then unmount after the animation.
    setExpanded(false);
    setSettled(false);
    const timer = setTimeout(() => setMounted(false), ANIM_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  // Expand on the frame after the composer enters the DOM; settle once open.
  useEffect(() => {
    if (!mounted) {
      setExpanded(false);
      setSettled(false);
      return undefined;
    }

    const raf = requestAnimationFrame(() => setExpanded(true));
    const timer = setTimeout(() => {
      if (visibleRef.current) {
        setSettled(true);
      }
    }, ANIM_MS + 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [mounted]);

  // Own the composer as a reply to this post while mounted; release on unmount.
  useEffect(() => {
    if (!mounted) {
      return undefined;
    }

    setInlineReplyActive(statusId);
    dispatch(epsilonSetInlineReply(statusId));
    ownsRef.current = true;

    return () => {
      setInlineReplyActive(false);
      if (ownsRef.current) {
        dispatch(resetCompose());
        ownsRef.current = false;
      }
    };
  }, [mounted, dispatch, setInlineReplyActive, statusId]);

  // A modal opened (reply to another status, a quote, or New Post). Hand the
  // composer over and ask the parent to close. Only blank the draft when it is
  // still our own pristine reply (New Post); a real target belongs to the modal.
  useEffect(() => {
    if (!open || !mounted) {
      return;
    }

    if (ownsRef.current) {
      if (inReplyTo === statusId && !quotedStatusId) {
        dispatch(resetCompose());
      }
      ownsRef.current = false;
    }

    onCloseRef.current?.();
  }, [open, mounted, inReplyTo, quotedStatusId, statusId, dispatch]);

  // Reply sent → ask the parent to close.
  useEffect(() => {
    if (wasSubmitting.current && !isSubmitting && composeCleared) {
      onCloseRef.current?.();
    }
    wasSubmitting.current = isSubmitting;
  }, [isSubmitting, composeCleared]);

  if (!mounted || open) {
    return null;
  }

  return (
    <div
      className={classNames('epsilon-inline-reply', {
        'epsilon-inline-reply--entered': expanded,
        'epsilon-inline-reply--settled': settled,
      })}
    >
      <div className='epsilon-inline-reply__inner'>
        <ComposeFormContainer singleColumn />
      </div>
    </div>
  );
};

EpsilonInlineReply.propTypes = {
  statusId: PropTypes.string.isRequired,
  visible: PropTypes.bool,
  onClose: PropTypes.func,
};

export default EpsilonInlineReply;
