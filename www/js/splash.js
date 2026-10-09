'use strict';
// Fortward – úvod: najprv logo štúdia (DBee games) na čiernom pozadí 2,5 s, potom obrázok hry
// (img/splash.jpg aj s názvom) počas načítania; keď je hra pripravená, plynulo prejde do menu.
const SPLASH = (() => {
  const LOGO_MS = 2500, LOGO_FADE_MS = 900, BLACK_MS = 250, FADE_MS = 700, ART_MIN_MS = 900;
  let artFrom = Infinity; // kedy sa začal ukazovať obrázok hry
  const logo = document.getElementById('logoIntro'), img = logo && logo.querySelector('img');
  function startLogo() {
    logo.classList.add('in');
    setTimeout(() => {
      logo.classList.add('fade');                       // logo sa vytratí do čiernej
      setTimeout(() => {
        logo.classList.add('out');                      // až potom sa z čiernej vynorí obrázok hry
        artFrom = performance.now();
        setTimeout(() => logo.remove(), FADE_MS + 50);
      }, LOGO_FADE_MS + BLACK_MS);
    }, LOGO_MS);
  }
  if (logo) {
    let started = false;
    const go = () => { if (!started) { started = true; startLogo(); } };
    if (img.complete) go(); else { img.addEventListener('load', go); img.addEventListener('error', go); setTimeout(go, 1200); }
  } else artFrom = performance.now();

  // hra je načítaná: na obrázku sa (najskôr chvíľu po zmiznutí loga) zjaví zelené tlačidlo Hrať
  const api = { onPlay: null, done };
  function done() {
    const el = document.getElementById('splash'), btn = document.getElementById('splashPlay');
    if (!el || !btn) return;
    const tick = () => {
      const left = artFrom + ART_MIN_MS - performance.now();
      if (left > 0) { setTimeout(tick, Math.min(left, 300)); return; }
      btn.classList.add('show');
    };
    tick();
    btn.addEventListener('click', () => {
      if (api.onPlay) api.onPlay();                    // menu sa pripraví pod obrázkom
      el.classList.add('out'); setTimeout(() => el.remove(), 900);
    }, { once: true });
  }
  return api;
})();
