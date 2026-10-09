'use strict';
// Fortward – úvodná obrazovka počas načítania (obrázok img/splash.jpg aj s názvom hry).
// Keď je hra načítaná a obrázok sa ukazoval aspoň chvíľu, plynulo prejde do menu.
const SPLASH = (() => {
  const t0 = performance.now();
  function done(minMs) {
    const el = document.getElementById('splash');
    if (!el) return;
    const wait = Math.max(0, (minMs || 2600) - (performance.now() - t0));
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 900); }, wait);
  }
  return { done };
})();
