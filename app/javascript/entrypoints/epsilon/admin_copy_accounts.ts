import { on } from 'delegated-events';

const collectLines = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>(
      '.batch-table .batch-checkbox input[type="checkbox"]:checked',
    ),
  )
    .map(
      (checkbox) =>
        checkbox
          .closest('.batch-table__row')
          ?.querySelector<HTMLElement>('[data-epsilon-copy]')
          ?.dataset.epsilonCopy?.trim() ?? '',
    )
    .filter((line) => line.length > 0);

const legacyCopy = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  textarea.remove();
  return copied;
};

const flash = (button: HTMLElement, message: string): void => {
  const label = button.querySelector<HTMLElement>('[data-epsilon-copy-label]');
  if (!label) return;

  const original = label.textContent;
  label.textContent = message;
  window.setTimeout(() => {
    label.textContent = original;
  }, 2000);
};

// Shift-click range selection on the batch checkboxes.
let lastChecked: HTMLInputElement | null = null;

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.matches('.batch-table .batch-checkbox input[type="checkbox"]'))
    return;

  if (event.shiftKey && lastChecked && lastChecked !== target) {
    const boxes = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        '.batch-table .batch-checkbox input[type="checkbox"]',
      ),
    );
    const from = boxes.indexOf(lastChecked);
    const to = boxes.indexOf(target);

    if (from !== -1 && to !== -1) {
      boxes.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((box) => {
        box.checked = target.checked;
      });
    }
  }

  lastChecked = target;
});

on('click', 'button[data-epsilon-copy-button]', (event) => {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) return;

  const lines = collectLines();

  if (lines.length === 0) {
    flash(button, button.dataset.emptyLabel ?? '');
    return;
  }

  const text = lines.join('\n');
  const copiedMessage = `${button.dataset.copiedLabel ?? ''} (${lines.length})`;

  void (async () => navigator.clipboard.writeText(text))()
    .then(() => {
      flash(button, copiedMessage);
    })
    .catch(() => {
      if (legacyCopy(text)) flash(button, copiedMessage);
    });
});
