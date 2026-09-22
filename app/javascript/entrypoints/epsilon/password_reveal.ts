// Show/hide password toggle for the server-rendered (Haml) auth pages
// (sign-up, sign-in, password reset). Those forms run outside the React SPA,
// so we enhance them by hand here and style the button via
// styles/epsilon/auth.scss.
//
// Every `input[type="password"]` inside the `.epsilon-auth` shell gets wrapped
// and a toggle button injected. The button flips the input between `password`
// and `text`, swapping the eye icon. Honeypot fields are text/url inputs, so
// they are never matched. Labels are read from data attributes on the shell,
// localized on the Ruby side (epsilon_auth.show_password / hide_password).

import ready from '@/mastodon/ready';
import eyeIcon from '@/material-icons/400-24px/visibility.svg?raw';
import eyeOffIcon from '@/material-icons/400-24px/visibility_off.svg?raw';

const PROCESSED_ATTR = 'data-password-reveal';

function decorate(
  input: HTMLInputElement,
  showLabel: string,
  hideLabel: string,
) {
  if (input.getAttribute(PROCESSED_ATTR) === 'true') return;
  input.setAttribute(PROCESSED_ATTR, 'true');

  const field = document.createElement('div');
  field.className = 'epsilon-password-field';
  input.parentNode?.insertBefore(field, input);
  field.appendChild(input);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'epsilon-password-field__toggle';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', showLabel);
  button.title = showLabel;
  button.innerHTML = eyeIcon;
  field.appendChild(button);

  button.addEventListener('click', () => {
    const revealed = input.type === 'text';
    input.type = revealed ? 'password' : 'text';
    button.innerHTML = revealed ? eyeIcon : eyeOffIcon;
    button.setAttribute('aria-pressed', String(!revealed));

    const label = revealed ? showLabel : hideLabel;
    button.setAttribute('aria-label', label);
    button.title = label;

    // Keep the caret in the field so the user can carry on typing.
    input.focus();
  });
}

void ready(() => {
  const shell = document.querySelector<HTMLElement>('.epsilon-auth');
  if (!shell) return;

  const showLabel = shell.dataset.passwordShow ?? 'Show password';
  const hideLabel = shell.dataset.passwordHide ?? 'Hide password';

  shell
    .querySelectorAll<HTMLInputElement>('input[type="password"]')
    .forEach((input) => {
      decorate(input, showLabel, hideLabel);
    });
});
