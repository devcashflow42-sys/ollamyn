/* Alterna el tema claro/oscuro y lo recuerda. El tema se aplica en <head>
   antes del render (script inline) para evitar parpadeo; aquí solo el botón. */
(function () {
  'use strict';
  var SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function current() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ollamyn_theme', theme); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.innerHTML = theme === 'dark' ? SUN : MOON;
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var t = current();
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.innerHTML = t === 'dark' ? SUN : MOON;
      b.addEventListener('click', function () { apply(current() === 'dark' ? 'light' : 'dark'); });
    });
  });
})();
