// Auto-advance focus across the date-of-birth inputs (day / month / year) on
// the server-rendered sign-up form. When a field is filled up to its maxlength,
// focus jumps to the next field; Backspace on an empty field jumps back to the
// previous one. Fields are wired in DOM order, so this works whatever the
// locale-driven order (JJ/MM/AAAA in French, YYYY/MM/DD in English).

import ready from '@/mastodon/ready';

function wireGroup(inputs: HTMLInputElement[]) {
  inputs.forEach((input, index) => {
    const next = inputs[index + 1];
    const prev = inputs[index - 1];

    input.addEventListener('input', () => {
      const max = input.maxLength;
      if (next && max > 0 && input.value.length >= max) {
        next.focus();
        next.select();
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && input.value === '' && prev) {
        event.preventDefault();
        prev.focus();
        // Put the caret at the end of the previous field so the next
        // Backspace deletes its last character.
        const end = prev.value.length;
        prev.setSelectionRange(end, end);
      }
    });
  });
}

void ready(() => {
  const shell = document.querySelector<HTMLElement>('.epsilon-auth');
  if (!shell) return;

  shell
    .querySelectorAll<HTMLElement>('.input.date_of_birth .label_input')
    .forEach((group) => {
      const inputs = Array.from(
        group.querySelectorAll<HTMLInputElement>('input'),
      );
      if (inputs.length > 1) wireGroup(inputs);
    });
});
