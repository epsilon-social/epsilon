// Lightweight, dependency-free confirmation modal for server-rendered
// (Haml) pages such as the account-deletion form. The Epsilon SPA already
// has its own React confirmation modals, but settings pages run outside the
// Redux app, so we build the dialog by hand here and match the modal styling
// via styles/epsilon/epsilon_confirm_modal.scss.
//
// A form opts in with `data-confirm-modal="true"` plus the localized strings
// `data-confirm-title` / `data-confirm-message` / `data-confirm-confirm` /
// `data-confirm-cancel` (localized on the Ruby side). Submitting the form is
// intercepted, the dialog is shown, and the form is only submitted once the
// user confirms. Clicking the backdrop, pressing Escape, or choosing the
// cancel action dismisses without deleting.

import { on } from 'delegated-events';

const OVERLAY_CLASS = 'epsilon-confirm-overlay';
const BODY_LOCK_CLASS = 'epsilon-confirm-lock';
const CONFIRMED_FLAG = 'confirmModalConfirmed';
const CONFIRMED_ATTR = 'data-confirm-modal-confirmed';

function openConfirmModal(form: HTMLFormElement) {
  // Never stack two dialogs.
  if (document.querySelector(`.${OVERLAY_CLASS}`)) return;

  const { confirmTitle, confirmMessage, confirmConfirm, confirmCancel } =
    form.dataset;

  const trigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('role', 'presentation');

  const modal = document.createElement('div');
  modal.className = 'epsilon-confirm-modal';
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');

  const titleId = 'epsilon-confirm-title';
  const messageId = 'epsilon-confirm-message';
  modal.setAttribute('aria-labelledby', titleId);
  if (confirmMessage) modal.setAttribute('aria-describedby', messageId);

  const body = document.createElement('div');
  body.className = 'epsilon-confirm-modal__body';

  const title = document.createElement('h2');
  title.className = 'epsilon-confirm-modal__title';
  title.id = titleId;
  title.textContent = confirmTitle ?? '';
  body.appendChild(title);

  if (confirmMessage) {
    const message = document.createElement('p');
    message.className = 'epsilon-confirm-modal__message';
    message.id = messageId;
    message.textContent = confirmMessage;
    body.appendChild(message);
  }

  const actions = document.createElement('div');
  actions.className = 'epsilon-confirm-modal__actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className =
    'epsilon-confirm-modal__button epsilon-confirm-modal__button--cancel';
  cancelButton.textContent = confirmCancel ?? '';

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className =
    'epsilon-confirm-modal__button epsilon-confirm-modal__button--confirm';
  confirmButton.textContent = confirmConfirm ?? '';

  actions.appendChild(cancelButton);
  actions.appendChild(confirmButton);

  modal.appendChild(body);
  modal.appendChild(actions);
  overlay.appendChild(modal);

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    } else if (event.key === 'Tab') {
      // Trap focus between the two buttons.
      const focusables = [cancelButton, confirmButton];
      const index = focusables.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      event.preventDefault();
      const next = event.shiftKey
        ? focusables[(index - 1 + focusables.length) % focusables.length]
        : focusables[(index + 1) % focusables.length];
      next?.focus();
    }
  }

  const teardown = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    document.body.classList.remove(BODY_LOCK_CLASS);
  };

  const dismiss = () => {
    teardown();
    trigger?.focus();
  };

  const confirmAndSubmit = () => {
    teardown();
    // Flag the form so the submit handler lets this one through untouched.
    form.dataset[CONFIRMED_FLAG] = 'true';
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.submit();
    }
  };

  cancelButton.addEventListener('click', dismiss);
  confirmButton.addEventListener('click', confirmAndSubmit);
  overlay.addEventListener('mousedown', (event) => {
    // Only a click on the backdrop itself (not the modal) dismisses.
    if (event.target === overlay) dismiss();
  });
  document.addEventListener('keydown', onKeydown);

  document.body.classList.add(BODY_LOCK_CLASS);
  document.body.appendChild(overlay);
  // Default focus on the safe (cancel) action for a destructive dialog.
  cancelButton.focus();
}

on('submit', 'form[data-confirm-modal]', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.dataset[CONFIRMED_FLAG] === 'true') {
    // Already confirmed — clear the flag and let the submit proceed.
    form.removeAttribute(CONFIRMED_ATTR);
    return;
  }

  event.preventDefault();

  // Don't open the dialog until required fields (e.g. the password) are valid —
  // let the browser surface its native validation message instead.
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  openConfirmModal(form);
});
