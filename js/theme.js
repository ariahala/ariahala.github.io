/* Apply the preference before the page paints, then add the shared control. */
(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'aria-color-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  let button;

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch (_) {
    // Switching still works when browser storage is unavailable.
  }

  function applyTheme() {
    const theme = preference || (systemTheme.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    if (button) {
      const action = theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode';
      button.setAttribute('aria-label', action);
      button.title = action;
    }
  }

  applyTheme();

  function addControl() {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.innerHTML = `
      <span class="theme-icon theme-icon-sun" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>
        </svg>
      </span>
      <span class="theme-icon theme-icon-moon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">
          <path d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z"/>
        </svg>
      </span>`;
    button.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(storageKey, preference);
      } catch (_) {
        // Keep the selected theme for this page even without storage.
      }
      applyTheme();
    });
    applyTheme();
    document.body.append(button);
  }

  // Follow the device until the visitor makes an explicit choice.
  systemTheme.addEventListener('change', () => {
    if (!preference) applyTheme();
  });
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null;
    applyTheme();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addControl, { once: true });
  } else {
    addControl();
  }
})();
