(() => {
  'use strict';
  const menu = document.querySelector('.resource-menu');
  if (!menu) return;
  const group = menu.closest('.nav-resources');
  const summary = menu.querySelector('summary');
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');

  group.querySelector('a').addEventListener('pointerenter', () => {
    if (hover.matches) menu.open = true;
  });
  group.addEventListener('pointerleave', () => {
    if (hover.matches && !group.contains(document.activeElement)) menu.open = false;
  });
  group.addEventListener('focusout', event => {
    if (!group.contains(event.relatedTarget)) menu.open = false;
  });
  document.addEventListener('click', event => {
    if (!group.contains(event.target)) menu.open = false;
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      menu.open = false;
      summary.focus();
    }
  });
  document.querySelectorAll('.nav-main a').forEach(link => {
    if (new URL(link.href).pathname === window.location.pathname) link.setAttribute('aria-current', 'page');
  });
})();
