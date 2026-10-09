'use strict';
// Fortward – úvod: najprv logo štúdia (DBee games) na čiernom pozadí 2,5 s, potom obrázok hry
// (img/splash.jpg aj s názvom) počas načítania; keď je hra pripravená, plynulo prejde do menu.
const SPLASH = (() => {
  const LOGO_MS = 2500, FADE_MS = 500, ART_MIN_MS = 2600;
  let artFrom = Infinity; // kedy sa začal ukazovať obrázok hry
  const logo = document.getElementById('logoIntro'), img = logo && logo.querySelector('img');
  function startLogo() {
    logo.classList.add('in');
    setTimeout(() => {
      logo.classList.add('out');
      artFrom = performance.now();
      setTimeout(() => logo.remove(), FADE_MS + 50);
    }, LOGO_MS);
  }
  if (logo) {
    let started = false;
    const go = () => { if (!started) { started = true; startLogo(); } };
    if (img.complete) go(); else { img.addEventListener('load', go); img.addEventListener('error', go); setTimeout(go, 1200); }
  } else artFrom = performance.now();

  // hra je načítaná: obrázok hry nech je vidieť aspoň ART_MIN_MS po zmiznutí loga, potom menu
  function done() {
    const el = document.getElementById('splash');
    if (!el) return;
    const tick = () => {
      const left = artFrom + ART_MIN_MS - performance.now();
      if (left > 0) { setTimeout(tick, Math.min(left, 300)); return; }
      el.classList.add('out'); setTimeout(() => el.remove(), 900);
    };
    tick();
  }
  return { done };
})();
