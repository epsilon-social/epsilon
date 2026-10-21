// Epsilon settings/admin sidebar: section labels, client-side collapsible
// groups (no page reload) and an instant quick-filter over every nav entry.
// The nav markup itself comes from simple-navigation rendered with
// expand_all: true (see app/views/layouts/admin.html.haml).

import ready from '../../mastodon/ready';

const STORAGE_KEY = 'epsilon:settings-nav:collapsed';
const EASING = 'cubic-bezier(0.25, 0.8, 0.25, 1)';
const DURATION = 250;

const ADMIN_ZONE_IDS = ['trends', 'moderation', 'admin'];
const UTILITY_IDS = ['sidekiq', 'pghero', 'logout'];

interface NavGroup {
  key: string;
  item: HTMLLIElement;
  header: HTMLElement;
  row: HTMLDivElement;
  toggle: HTMLButtonElement;
  submenu: HTMLUListElement;
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const loadCollapsed = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((key): key is string => typeof key === 'string'),
    );
  } catch {
    return new Set();
  }
};

const saveCollapsed = (collapsed: Set<string>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Storage unavailable (private mode, etc.) — collapse state just won't persist.
  }
};

const setExpanded = (
  group: NavGroup,
  expanded: boolean,
  animate: boolean,
): void => {
  const menu = group.submenu;

  group.toggle.setAttribute('aria-expanded', String(expanded));
  group.item.classList.toggle(
    'epsilon-settings-nav__group--collapsed',
    !expanded,
  );

  // Read the live height/opacity before cancelling so an interrupted toggle
  // continues from where the menu currently is, not from a jumped end state.
  const currentHeight = menu.hidden ? 0 : menu.getBoundingClientRect().height;
  const currentOpacity = menu.hidden ? '0' : getComputedStyle(menu).opacity;
  menu.getAnimations().forEach((animation) => {
    animation.cancel();
  });

  if (!animate || prefersReducedMotion()) {
    menu.hidden = !expanded;
    return;
  }

  menu.hidden = false;
  const endHeight = expanded ? menu.scrollHeight : 0;
  const animation = menu.animate(
    [
      { height: `${currentHeight}px`, opacity: currentOpacity },
      { height: `${endHeight}px`, opacity: expanded ? '1' : '0' },
    ],
    { duration: DURATION, easing: EASING },
  );
  animation.addEventListener('finish', () => {
    if (!expanded) menu.hidden = true;
  });
};

const buildToggle = (label: string, controlsId: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'epsilon-settings-nav__toggle';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-controls', controlsId);
  button.setAttribute('aria-expanded', 'true');
  return button;
};

const buildSectionLabel = (text: string): HTMLLIElement => {
  const item = document.createElement('li');
  item.className = 'epsilon-settings-nav__section';
  item.setAttribute('role', 'presentation');
  item.textContent = text;
  return item;
};

const init = (): void => {
  const sidebar = document.querySelector<HTMLElement>(
    '.admin-wrapper .sidebar',
  );
  const rootList = sidebar?.querySelector<HTMLUListElement>('nav > ul');
  const filterWrapper = document.querySelector<HTMLElement>(
    '.epsilon-settings-nav__filter',
  );

  if (!sidebar || !rootList || !filterWrapper) return;

  const labels = filterWrapper.dataset;
  const topItems = Array.from(rootList.children).filter(
    (child): child is HTMLLIElement => child instanceof HTMLLIElement,
  );
  const findItem = (ids: string[]): HTMLLIElement | undefined =>
    topItems.find((item) => ids.includes(item.id));

  // Section labels: user settings vs administration, plus a utility zone at
  // the bottom. Only label the zones when both worlds are present.
  const adminZoneStart = findItem(ADMIN_ZONE_IDS);
  const settingsZoneStart = findItem(['profile']);

  if (adminZoneStart && settingsZoneStart) {
    settingsZoneStart.before(
      buildSectionLabel(labels.sectionSettings ?? 'Settings'),
    );
    adminZoneStart.before(
      buildSectionLabel(labels.sectionAdministration ?? 'Administration'),
    );
  }

  const utilityStart = findItem(UTILITY_IDS);
  topItems.forEach((item) => {
    if (UTILITY_IDS.includes(item.id))
      item.classList.add('epsilon-settings-nav__utility');
  });
  if (utilityStart) {
    const divider = document.createElement('li');
    divider.className = 'epsilon-settings-nav__divider';
    divider.setAttribute('role', 'presentation');
    utilityStart.before(divider);
  }

  // Collapsible groups.
  const collapsed = loadCollapsed();
  const groups: NavGroup[] = [];

  topItems.forEach((item, index) => {
    const submenu = item.querySelector<HTMLUListElement>(':scope > ul');
    const header = item.querySelector<HTMLElement>(':scope > a, :scope > span');
    if (!submenu || !header) return;

    const key = item.id || `group-${index}`;
    submenu.id = submenu.id || `epsilon-settings-nav-sub-${key}`;
    submenu.classList.add('epsilon-settings-nav__submenu');
    item.classList.add('epsilon-settings-nav__group');
    header.classList.add('epsilon-settings-nav__group-header');
    // The chevron button is the single keyboard/screen-reader control.
    header.setAttribute('tabindex', '-1');

    const toggle = buildToggle(
      labels.toggleSection ?? 'Toggle section',
      submenu.id,
    );

    // Header + chevron live in a flex row so the chevron stays vertically
    // centered even when the label wraps onto two lines.
    const row = document.createElement('div');
    row.className = 'epsilon-settings-nav__group-row';
    header.before(row);
    row.append(header, toggle);

    const group: NavGroup = { key, item, header, row, toggle, submenu };
    groups.push(group);

    // The active group always starts open so the current page stays visible.
    const startCollapsed =
      collapsed.has(key) && !item.classList.contains('selected');
    if (startCollapsed) setExpanded(group, false, false);
  });

  let filtering = false;

  // Sticky only while the whole column fits the viewport; otherwise it flows
  // with the page so every group stays reachable through document scroll.
  let stickyTimer = 0;
  const updateSticky = (): void => {
    sidebar.classList.toggle(
      'epsilon-settings-nav--sticky',
      sidebar.offsetHeight <= window.innerHeight,
    );
  };
  const scheduleStickyUpdate = (): void => {
    window.clearTimeout(stickyTimer);
    stickyTimer = window.setTimeout(updateSticky, DURATION + 50);
  };
  updateSticky();
  window.addEventListener('resize', scheduleStickyUpdate);

  const toggleGroup = (group: NavGroup): void => {
    const expanded = group.toggle.getAttribute('aria-expanded') === 'true';
    setExpanded(group, !expanded, true);
    scheduleStickyUpdate();

    if (filtering) return;

    if (expanded) collapsed.add(group.key);
    else collapsed.delete(group.key);
    saveCollapsed(collapsed);
  };

  groups.forEach((group) => {
    // One control: the whole row (header + chevron) toggles the group. The
    // button's keyboard activation bubbles here as a click. No destination is
    // lost: every linked parent points at the same page as its first child.
    group.row.addEventListener('click', (event) => {
      event.preventDefault();
      toggleGroup(group);
    });
  });

  // Quick filter.
  const input = filterWrapper.querySelector<HTMLInputElement>(
    '.epsilon-settings-nav__filter-input',
  );
  if (!input) return;

  const emptyMessage = document.createElement('li');
  emptyMessage.className = 'epsilon-settings-nav__empty';
  emptyMessage.textContent = labels.noResults ?? 'No results';
  emptyMessage.hidden = true;
  rootList.append(emptyMessage);

  const decorations = rootList.querySelectorAll<HTMLLIElement>(
    '.epsilon-settings-nav__section, .epsilon-settings-nav__divider',
  );

  const applyFilter = (query: string): void => {
    filtering = query.length > 0;
    let anyVisible = false;

    decorations.forEach((decoration) => {
      decoration.hidden = filtering;
    });

    topItems.forEach((item) => {
      const group = groups.find((candidate) => candidate.item === item);

      if (!filtering) {
        item.hidden = false;
        if (group) {
          item
            .querySelectorAll<HTMLLIElement>(':scope > ul > li')
            .forEach((child) => {
              child.hidden = false;
            });
          const expanded =
            !collapsed.has(group.key) || item.classList.contains('selected');
          setExpanded(group, expanded, false);
        }
        return;
      }

      if (!group) {
        const matches = normalize(item.textContent).includes(query);
        item.hidden = !matches;
        anyVisible = anyVisible || matches;
        return;
      }

      const headerMatches = normalize(group.header.textContent).includes(query);
      let childVisible = false;

      for (const child of group.submenu.querySelectorAll<HTMLLIElement>(
        ':scope > li',
      )) {
        const matches =
          headerMatches || normalize(child.textContent).includes(query);
        child.hidden = !matches;
        if (matches) childVisible = true;
      }

      item.hidden = !childVisible;
      anyVisible = anyVisible || childVisible;
      if (childVisible) setExpanded(group, true, false);
    });

    emptyMessage.hidden = !filtering || anyVisible;
    scheduleStickyUpdate();
  };

  input.addEventListener('input', () => {
    applyFilter(normalize(input.value.trim()));
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value !== '') {
      event.stopPropagation();
      input.value = '';
      applyFilter('');
    }
  });

  // --- Mobile sheet (< 890px) ---------------------------------------------
  // The native handler in public.tsx only flips the `visible` class; we take
  // over the toggle (capture phase blocks the delegated native listener) to
  // animate the sheet open/closed along the same path, interruptibly.
  const toggleIcon = document.querySelector<HTMLAnchorElement>(
    'a.sidebar__toggle__icon',
  );
  const toggleBar = sidebar.querySelector<HTMLElement>('.sidebar__toggle');

  if (!toggleIcon || !toggleBar) return;

  // Wayfinding: show the current page title in the top bar.
  const heading = document.querySelector<HTMLElement>('.content__heading h1');
  const title = heading?.textContent.trim();
  if (title) {
    const current = document.createElement('span');
    current.className = 'epsilon-settings-nav__current';
    current.textContent = title;
    toggleIcon.before(current);
  }

  let sheetOpen = false;

  // iOS ignores `overflow: hidden` on the body for touch scrolling — the
  // page behind the sheet scrolls instead of the sheet itself. Freezing the
  // body with position: fixed at the current offset is the reliable lock.
  let bodyLocked = false;
  let savedScrollY = 0;

  const lockBody = (): void => {
    if (bodyLocked) return;
    bodyLocked = true;
    savedScrollY = window.scrollY;
    const { style } = document.body;
    style.overflow = 'hidden';
    style.position = 'fixed';
    style.top = `${-savedScrollY}px`;
    style.insetInline = '0';
    style.width = '100%';
  };

  const unlockBody = (): void => {
    if (!bodyLocked) return;
    bodyLocked = false;
    const { style } = document.body;
    style.overflow = '';
    style.position = '';
    style.top = '';
    style.insetInline = '';
    style.width = '';
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
  };

  const slide = (
    element: HTMLElement,
    show: boolean,
    onDone?: () => void,
  ): void => {
    // Interruption: continue from the live opacity/offset instead of jumping.
    let fromOpacity = show ? '0' : '1';
    let fromY = show ? -10 : 0;
    const running = element.getAnimations();
    if (running.length > 0) {
      const styles = getComputedStyle(element);
      fromOpacity = styles.opacity;
      if (styles.transform !== 'none')
        fromY = new DOMMatrixReadOnly(styles.transform).m42;
      running.forEach((animation) => {
        animation.cancel();
      });
    }

    const animation = element.animate(
      [
        { opacity: fromOpacity, transform: `translateY(${fromY}px)` },
        {
          opacity: show ? '1' : '0',
          transform: `translateY(${show ? 0 : -10}px)`,
        },
      ],
      { duration: DURATION, easing: EASING },
    );
    if (onDone) animation.addEventListener('finish', onDone);
  };

  const scrollActiveIntoView = (): void => {
    rootList
      .querySelector('.simple-navigation-active-leaf')
      ?.scrollIntoView({ block: 'center' });
  };

  const setSheetOpen = (open: boolean): void => {
    sheetOpen = open;
    toggleIcon.setAttribute('aria-expanded', String(open));
    toggleIcon.classList.toggle('active', open);
    if (open) lockBody();
    else unlockBody();

    if (prefersReducedMotion()) {
      rootList.getAnimations().forEach((animation) => {
        animation.cancel();
      });
      rootList.classList.toggle('visible', open);
      if (open) scrollActiveIntoView();
      return;
    }

    if (open) {
      rootList.classList.add('visible');
      scrollActiveIntoView();
      slide(rootList, true);
      slide(filterWrapper, true);
    } else {
      slide(filterWrapper, false);
      slide(rootList, false, () => {
        if (!sheetOpen) rootList.classList.remove('visible');
      });
    }
  };

  const interceptToggle = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('a.sidebar__toggle__icon')) return;
    if (
      event instanceof KeyboardEvent &&
      event.key !== ' ' &&
      event.key !== 'Enter'
    )
      return;

    event.preventDefault();
    event.stopPropagation();
    setSheetOpen(!sheetOpen);
  };

  document.addEventListener('click', interceptToggle, { capture: true });
  document.addEventListener('keydown', interceptToggle, { capture: true });

  // Leaving the mobile breakpoint with the sheet open: reset instantly.
  window.addEventListener('resize', () => {
    if (sheetOpen && window.innerWidth >= 890) {
      sheetOpen = false;
      toggleIcon.setAttribute('aria-expanded', 'false');
      toggleIcon.classList.remove('active');
      unlockBody();
      rootList.getAnimations().forEach((animation) => {
        animation.cancel();
      });
      rootList.classList.remove('visible');
    }
  });
};

ready(init).catch(() => {
  // Nav enhancements are progressive — the plain expanded list still works.
});
