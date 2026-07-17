import { on } from 'delegated-events';

const csrfToken = (): string =>
  document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ??
  '';

const updateCount = (container: HTMLElement): void => {
  const countElement = container.querySelector<HTMLElement>(
    '[data-epsilon-category-count]',
  );
  if (!countElement) return;

  const checkedCount = container.querySelectorAll<HTMLInputElement>(
    'input[data-epsilon-category-toggle]:checked',
  ).length;

  countElement.textContent = String(checkedCount);
};

const updateCategoryNames = (container: HTMLElement): void => {
  const namesCell = container
    .closest('tr')
    ?.querySelector<HTMLElement>('[data-epsilon-category-names]');
  if (!namesCell) return;

  const names = Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input[data-epsilon-category-toggle]:checked',
    ),
  )
    .map((cb) => cb.dataset.epsilonCategoryName?.trim() ?? '')
    .filter((name) => name.length > 0);

  namesCell.textContent = names.length > 0 ? names.join(', ') : '—';
};

on('change', 'input[data-epsilon-category-toggle]', (event) => {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement)) return;

  const container = checkbox.closest<HTMLElement>('[data-epsilon-hashtag]');
  const url = container?.dataset.epsilonToggleUrl;
  const hashtag = container?.dataset.epsilonHashtag;

  if (!container || !url || !hashtag) return;

  const categoryId = checkbox.value;
  const checked = checkbox.checked;

  checkbox.disabled = true;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken(),
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      hashtag,
      category_id: categoryId,
      checked,
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      updateCount(container);
      updateCategoryNames(container);
      return response;
    })
    .catch((error: unknown) => {
      checkbox.checked = !checked;
      updateCount(container);
      console.error('Epsilon: hashtag category toggle failed', error);
    })
    .finally(() => {
      checkbox.disabled = false;
    });
});

document.addEventListener('click', (event: MouseEvent) => {
  const target = event.target as Node;

  const openDropdowns = document.querySelectorAll<HTMLDetailsElement>(
    'details.epsilon-hashtag-categories[open]',
  );

  openDropdowns.forEach((dropdown) => {
    if (!dropdown.contains(target)) {
      dropdown.removeAttribute('open');
    }
  });
});
