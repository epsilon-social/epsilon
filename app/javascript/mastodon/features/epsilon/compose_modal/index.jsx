import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

import PropTypes from 'prop-types';

import classNames from 'classnames';

import { useLocation, useHistory } from 'react-router-dom';

import { resetCompose, mountCompose, unmountCompose } from 'mastodon/actions/compose';
import ComposeFormContainer from 'mastodon/features/compose/containers/compose_form_container';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

const EpsilonComposeContext = createContext({
  open: false,
  openCompose: () => {},
  closeCompose: () => {},
  setInlineReplyActive: () => {},
});

export const useEpsilonCompose = () => useContext(EpsilonComposeContext);

const EpsilonComposeOverlay = ({ onClose, concealed }) => {
  const handleContentClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={classNames('epsilon-compose-overlay', {
        'epsilon-compose-overlay--concealed': concealed,
      })}
      onClick={onClose}
    >
      <div
        className='epsilon-compose-overlay__content'
        role='dialog'
        onClick={handleContentClick}
      >
        <ComposeFormContainer singleColumn />
      </div>
    </div>
  );
};

EpsilonComposeOverlay.propTypes = {
  onClose: PropTypes.func.isRequired,
  concealed: PropTypes.bool,
};

export const EpsilonComposeProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const history = useHistory();
  const dispatch = useAppDispatch();
  const prevPath = useRef(location.pathname);

  const hasNativeModal = useAppSelector(
    (state) => state.modal.get('stack').size > 0,
  );

  const inReplyTo = useAppSelector((state) => state.compose.get('in_reply_to'));
  const quotedStatusId = useAppSelector((state) =>
    state.compose.get('quoted_status_id'),
  );
  const focusDate = useAppSelector((state) => state.compose.get('focusDate'));
  const prevReply = useRef(inReplyTo);
  const prevQuote = useRef(quotedStatusId);
  const prevFocus = useRef(focusDate);

  // When an inline reply box (e.g. under a detailed status) is active, it owns
  // the reply itself; the overlay must NOT pop open on in_reply_to changes.
  const inlineReplyActiveRef = useRef(false);
  const setInlineReplyActive = useCallback((active) => {
    inlineReplyActiveRef.current = active;
  }, []);

  useEffect(() => {
    dispatch(mountCompose());
    return () => {
      dispatch(unmountCompose());
    };
  }, [dispatch]);

  const replyStateRef = useRef({ inReplyTo, quotedStatusId });
  replyStateRef.current = { inReplyTo, quotedStatusId };

  useEffect(() => {
    const focusBumped = focusDate !== prevFocus.current;
    const startedReply =
      inReplyTo && inReplyTo !== prevReply.current && focusBumped;
    const startedQuote = quotedStatusId && quotedStatusId !== prevQuote.current;
    prevReply.current = inReplyTo;
    prevQuote.current = quotedStatusId;
    prevFocus.current = focusDate;

    if ((startedReply || startedQuote) && !inlineReplyActiveRef.current) {
      setOpen(true);
    }
  }, [inReplyTo, quotedStatusId, focusDate]);

  const isSubmitting = useAppSelector((state) =>
    state.compose.get('is_submitting'),
  );
  const composeCleared = useAppSelector(
    (state) =>
      (state.compose.get('text') ?? '').trim().length === 0 &&
      state.compose.get('media_attachments').isEmpty(),
  );
  const wasSubmitting = useRef(false);

  useEffect(() => {
    if (wasSubmitting.current && !isSubmitting && open && composeCleared) {
      setOpen(false);
    }
    wasSubmitting.current = isSubmitting;
  }, [isSubmitting, composeCleared, open]);

  const openCompose = useCallback(() => setOpen(true), []);
  const closeCompose = useCallback(() => {
    setOpen(false);
    const { inReplyTo: r, quotedStatusId: q } = replyStateRef.current;
    if (r || q) {
      dispatch(resetCompose());
    }
  }, [dispatch]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    document.body.classList.add('epsilon-compose-open');
    return () => document.body.classList.remove('epsilon-compose-open');
  }, [open]);

  useEffect(() => {
    if (location.pathname === prevPath.current) {
      return;
    }

    if (location.pathname === '/publish') {
      setOpen(true);
      history.replace(prevPath.current);
      return;
    }

    prevPath.current = location.pathname;

    // An inline reply box (mounted on the destination page) owns the compose;
    // don't reset it out from under it on navigation.
    if (inlineReplyActiveRef.current) {
      return;
    }

    closeCompose();
  }, [location.pathname, history, closeCompose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.modal-root__overlay')) {
        closeCompose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeCompose]);

  return (
    <EpsilonComposeContext.Provider value={{ open, openCompose, closeCompose, setInlineReplyActive }}>
      {children}
      {open && <EpsilonComposeOverlay onClose={closeCompose} concealed={hasNativeModal} />}
    </EpsilonComposeContext.Provider>
  );
};

EpsilonComposeProvider.propTypes = {
  children: PropTypes.node,
};

export default EpsilonComposeProvider;
