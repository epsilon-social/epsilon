import { describe, it, expect, beforeEach, vi } from 'vitest';

function setupDom() {
  document.body.innerHTML = `
    <div class="epsilon-auth">
      <form>
        <div class="input date_of_birth">
          <div class="label_input">
            <input id="d" type="text" maxlength="2" />
            <input id="m" type="text" maxlength="2" />
            <input id="y" type="text" maxlength="4" />
          </div>
        </div>
      </form>
    </div>
  `;
}

function byId(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`missing input #${id}`);
  }
  return el;
}

async function loadModule() {
  vi.resetModules();
  await import('./dob_autotab');
}

function type(input: HTMLInputElement, value: string) {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('dob_autotab', () => {
  beforeEach(() => {
    setupDom();
  });

  it('advances to the next field once the current one is full', async () => {
    await loadModule();

    type(byId('d'), '12');

    expect(document.activeElement).toBe(byId('m'));
  });

  it('does not advance while the field is not full', async () => {
    await loadModule();
    const day = byId('d');

    type(day, '1');

    expect(document.activeElement).toBe(day);
  });

  it('respects each field maxlength (4 for the year)', async () => {
    await loadModule();
    const year = byId('y');

    // Two digits should NOT advance away from the year (maxlength 4).
    type(year, '19');
    expect(document.activeElement).toBe(year);
    // The month (maxlength 2) advances at two digits — focus lands on the year.
    type(byId('m'), '05');
    expect(document.activeElement).toBe(year);
  });

  it('goes back to the previous field on Backspace when empty', async () => {
    await loadModule();
    const day = byId('d');
    const month = byId('m');

    month.focus();
    month.value = '';
    month.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
    );

    expect(document.activeElement).toBe(day);
  });
});
