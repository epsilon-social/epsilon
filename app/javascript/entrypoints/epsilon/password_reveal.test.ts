import { describe, it, expect, beforeEach, vi } from 'vitest';

function setupDom() {
  document.body.innerHTML = `
    <div class="epsilon-auth" data-password-show="Show password" data-password-hide="Hide password">
      <form>
        <div class="input user_password">
          <label for="pw">Password</label>
          <input id="pw" type="password" />
        </div>
      </form>
    </div>
  `;
}

async function loadModule() {
  // The module runs its ready() side effect at import time; jsdom's
  // readyState is already "complete", so the DOM must be in place first.
  vi.resetModules();
  await import('./password_reveal');
}

describe('password_reveal', () => {
  beforeEach(() => {
    setupDom();
  });

  it('injects a toggle button next to the password input', async () => {
    await loadModule();

    const button = document.querySelector<HTMLButtonElement>(
      '.epsilon-password-field__toggle',
    );

    expect(button).not.toBeNull();
    expect(button?.type).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Show password');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles the input between password and text on click', async () => {
    await loadModule();

    const input = document.querySelector<HTMLInputElement>('#pw');
    const button = document.querySelector<HTMLButtonElement>(
      '.epsilon-password-field__toggle',
    );

    expect(input?.type).toBe('password');

    button?.click();
    expect(input?.type).toBe('text');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('Hide password');

    button?.click();
    expect(input?.type).toBe('password');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(button?.getAttribute('aria-label')).toBe('Show password');
  });

  it('does not decorate the same input twice', async () => {
    await loadModule();

    expect(
      document.querySelectorAll('.epsilon-password-field__toggle'),
    ).toHaveLength(1);
  });

  it('ignores non-password inputs (honeypots)', async () => {
    document.body.innerHTML = `
      <div class="epsilon-auth" data-password-show="Show password" data-password-hide="Hide password">
        <form>
          <input type="text" name="confirm_password" />
          <input type="url" name="website" />
        </form>
      </div>
    `;

    await loadModule();

    expect(
      document.querySelector('.epsilon-password-field__toggle'),
    ).toBeNull();
  });
});
