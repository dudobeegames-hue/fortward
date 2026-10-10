'use strict';
// Fortward – zvuky a hudba generované cez Web Audio (žiadne súbory, funguje offline).
const AUDIO = (() => {
  let ctx = null, master, musicBus, sfxBus, noiseBuf = null;
  const prefs = { music: true, sfx: true };
  try {
    const p = JSON.parse(localStorage.getItem('fortward.audio') || '{}');
    if (typeof p.music === 'boolean') prefs.music = p.music;
    if (typeof p.sfx === 'boolean') prefs.sfx = p.sfx;
  } catch (e) { /* bez úložiska */ }
  const savePrefs = () => { try { localStorage.setItem('fortward.audio', JSON.stringify(prefs)); } catch (e) { } };

  // ---- kontext sa smie spustiť až po dotyku používateľa (mobil) ----
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? 0.32 : 0; musicBus.connect(master);
      // jemná ozvena pre hudbu
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.28;
      const fb = ctx.createGain(); fb.gain.value = 0.22;
      const wet = ctx.createGain(); wet.gain.value = 0.25;
      musicBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 0.6 : 0; sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== 'running') ctx.resume(); // 'suspended' aj iOS 'interrupted' (napr. po hovore)
    return true;
  }

  // iOS: pri tichom prepínači je Web Audio stlmené. Prehrávanie tichej <audio> stopy
  // prepne zvukovú reláciu do režimu „playback“, v ktorom hra znie aj v tichom režime.
  let silentEl = null;
  function silentWavURL() {
    const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 8-bitové ticho
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function iosPlayback() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* staršie iOS */ }
    try {
      if (!silentEl) { silentEl = new Audio(silentWavURL()); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); }
      if (silentEl.paused) { const pr = silentEl.play(); if (pr && pr.catch) pr.catch(() => { }); }
    } catch (e) { /* bez <audio> */ }
  }
  let primed = false;
  const unlock = () => {
    iosPlayback();
    if (!ensure()) return;
    if (!primed) { // staršie iOS sa „odomknú“ až prehratím zvuku priamo v dotyku
      primed = true;
      const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0);
    }
    if (wantTrack && !seq) startTrack(wantTrack);
  };
  ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); if (silentEl) silentEl.pause(); }
    else ctx.resume(); // tichá stopa sa znova spustí pri najbližšom dotyku
  });

  // ---- základné nástroje ----
  function tone(o) {
    const t0 = ctx.currentTime + (o.at || 0), dur = o.t || 0.1;
    const osc = ctx.createOscillator(), gn = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const v = o.vol || 0.2;
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.004));
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(gn); gn.connect(o.dest || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(o) {
    const t0 = ctx.currentTime + (o.at || 0), dur = o.t || 0.1;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    f.Q.value = o.q || 1;
    const gn = ctx.createGain(), v = o.vol || 0.2;
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.003));
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(gn); gn.connect(o.dest || sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  const mf = n => 440 * Math.pow(2, (n - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---- zvukové efekty ----
  const SFX = {
    arrow: () => { tone({ type: 'triangle', f: rnd(700, 900), f2: 260, t: 0.08, vol: 0.07 }); noise({ freq: 3000, q: 0.8, t: 0.06, vol: 0.05, filter: 'highpass' }); },
    bolt: () => { tone({ type: 'square', f: 180, f2: 90, t: 0.06, vol: 0.06, lp: 900 }); noise({ freq: 1800, q: 2, t: 0.09, vol: 0.09 }); },
    fire: () => { noise({ filter: 'lowpass', freq: 400, f2: 2400, t: 0.35, vol: 0.12, attack: 0.08 }); },
    boom: () => { noise({ filter: 'lowpass', freq: 1400, f2: 90, t: 0.5, vol: 0.32 }); tone({ type: 'sine', f: 110, f2: 38, t: 0.45, vol: 0.32 }); },
    hit: () => { noise({ freq: rnd(1200, 2000), q: 1.5, t: 0.05, vol: 0.08 }); },
    die: () => { tone({ type: 'sawtooth', f: rnd(200, 260), f2: 70, t: 0.2, vol: 0.06, lp: 1200 }); noise({ filter: 'lowpass', freq: 900, f2: 200, t: 0.15, vol: 0.07 }); },
    coin: () => { tone({ type: 'square', f: 988, t: 0.05, vol: 0.035 }); tone({ type: 'square', f: 1319, t: 0.09, vol: 0.035, at: 0.05 }); },
    thud: () => { tone({ type: 'sine', f: 130, f2: 55, t: 0.14, vol: 0.18 }); noise({ filter: 'lowpass', freq: 500, t: 0.1, vol: 0.12 }); },
    hallHit: () => { tone({ type: 'sine', f: 90, f2: 45, t: 0.22, vol: 0.24 }); noise({ filter: 'lowpass', freq: 380, t: 0.18, vol: 0.16 }); },
    crumble: () => { noise({ filter: 'lowpass', freq: 900, f2: 80, t: 0.8, vol: 0.3 }); for (let k = 0; k < 4; k++) tone({ type: 'sine', f: rnd(70, 140), f2: 40, t: 0.15, vol: 0.12, at: k * 0.09 }); },
    build: () => { tone({ type: 'sine', f: 160, f2: 80, t: 0.12, vol: 0.2 }); noise({ filter: 'lowpass', freq: 700, t: 0.08, vol: 0.12 }); tone({ type: 'square', f: 523, t: 0.06, vol: 0.04, at: 0.06, lp: 2000 }); },
    upgrade: () => { [523, 659, 784, 1047].forEach((f, k) => tone({ type: 'square', f, t: 0.09, vol: 0.045, at: k * 0.06, lp: 3000 })); },
    sell: () => { tone({ type: 'square', f: 784, t: 0.05, vol: 0.04 }); tone({ type: 'square', f: 587, t: 0.08, vol: 0.04, at: 0.05 }); },
    deny: () => { tone({ type: 'square', f: 140, t: 0.12, vol: 0.06, lp: 800 }); tone({ type: 'square', f: 110, t: 0.14, vol: 0.06, at: 0.1, lp: 800 }); },
    click: () => { tone({ type: 'square', f: 1200, t: 0.025, vol: 0.03, lp: 3000 }); },
    volley: () => { for (let k = 0; k < 5; k++) noise({ filter: 'bandpass', freq: rnd(1500, 3000), f2: 600, q: 2, t: 0.25, vol: 0.06, at: k * 0.05, attack: 0.05 }); },
    clang: () => { tone({ type: 'square', f: rnd(1700, 2100), t: 0.07, vol: 0.035, lp: 4000 }); tone({ type: 'square', f: rnd(2500, 2900), t: 0.05, vol: 0.025 }); noise({ filter: 'highpass', freq: 4000, t: 0.04, vol: 0.04 }); },
    kingHit: () => { noise({ freq: 900, q: 1, t: 0.12, vol: 0.12 }); tone({ type: 'triangle', f: 330, f2: 160, t: 0.12, vol: 0.08 }); },
    horn: () => { [[196, 0], [294, 0]].forEach(([f]) => { tone({ type: 'sawtooth', f, t: 0.75, vol: 0.07, attack: 0.08, lp: 1100 }); }); tone({ type: 'sawtooth', f: 220, t: 0.5, vol: 0.06, at: 0.25, attack: 0.05, lp: 1100 }); },
    boss: () => { tone({ type: 'sawtooth', f: 73, t: 1.3, vol: 0.12, attack: 0.2, lp: 500 }); tone({ type: 'sawtooth', f: 110, t: 1.3, vol: 0.08, attack: 0.2, lp: 500 }); for (let k = 0; k < 3; k++) { tone({ type: 'sine', f: 70, f2: 40, t: 0.3, vol: 0.3, at: 0.15 + k * 0.3 }); } },
    cleared: () => { [659, 784, 988].forEach((f, k) => tone({ type: 'square', f, t: 0.14, vol: 0.05, at: k * 0.1, lp: 3000 })); },
    win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone({ type: 'square', f, t: k === 5 ? 0.6 : 0.16, vol: 0.06, at: k * 0.14, lp: 3200 })); [262, 330, 392].forEach(f => tone({ type: 'triangle', f, t: 1.4, vol: 0.06, at: 0.7 })); },
    lose: () => { [440, 415, 392, 349].forEach((f, k) => tone({ type: 'triangle', f, t: k === 3 ? 0.9 : 0.3, vol: 0.09, at: k * 0.3 })); tone({ type: 'sine', f: 87, t: 1.6, vol: 0.12, at: 0.9 }); },
    // šuchot rozvíjaného zvitku: krátke praskania papiera a tichý šum pod nimi
    paper: () => {
      for (let k = 0; k < 10; k++) noise({ filter: 'bandpass', freq: rnd(1800, 4500), q: 0.9, t: rnd(0.04, 0.11), vol: rnd(0.04, 0.08), at: k * 0.085 + Math.random() * 0.03, attack: 0.008 });
      noise({ filter: 'lowpass', freq: 1200, f2: 600, t: 0.85, vol: 0.035, attack: 0.15 });
    },
    unlock: () => { [784, 988, 1175, 1568].forEach((f, k) => tone({ type: 'triangle', f, t: 0.2, vol: 0.06, at: k * 0.08 })); },
  };
  const MIN_GAP = { arrow: 0.05, bolt: 0.06, hit: 0.035, die: 0.05, coin: 0.05, thud: 0.07, hallHit: 0.12, clang: 0.08, kingHit: 0.1, fire: 0.1, boom: 0.06 };
  const last = {};
  function play(name) {
    if (!prefs.sfx || !ctx || ctx.state !== 'running' || !SFX[name]) return;
    const now = ctx.currentTime;
    if (MIN_GAP[name] && last[name] && now - last[name] < MIN_GAP[name]) return;
    last[name] = now;
    SFX[name]();
  }

  // ---- hudba: jednoduchý sekvencer so stredovekými molovými postupmi ----
  // akordy ako MIDI tóny (koreň, tercia, kvinta)
  const TRACKS = {
    map: { bpm: 84, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], scale: [57, 59, 60, 62, 64, 65, 67, 69, 71, 72], lead: 'triangle', arp: true, bass: 8, drums: false, mel: 0.35, seed: 3 },
    build: { bpm: 96, chords: [[50, 53, 57], [48, 52, 55], [53, 57, 60], [55, 59, 62]], scale: [62, 64, 65, 67, 69, 71, 72, 74], lead: 'square', arp: true, bass: 4, drums: 'soft', mel: 0.3, seed: 7 },
    battle: { bpm: 138, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], scale: [57, 60, 62, 64, 67, 69, 72, 74], lead: 'square', arp: false, bass: 2, drums: 'full', mel: 0.55, seed: 11 },
  };
  for (const k in TRACKS) { // vopred vygeneruj melódiu (rovnaká pri každom prehraní)
    const tr = TRACKS[k];
    let s = tr.seed * 7919;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    tr.melody = tr.chords.map((ch, bi) => {
      const bar = new Array(16).fill(null);
      for (let st = 0; st < 16; st += 2) {
        if (r() > tr.mel && st % 4 !== 0) continue;
        const pool = r() < 0.6 ? ch.map(n => n + 12) : tr.scale;
        bar[st] = pool[Math.floor(r() * pool.length)];
        if (r() < 0.25 && st < 14) { bar[st + 1] = tr.scale[Math.floor(r() * tr.scale.length)]; }
      }
      if (bi === tr.chords.length - 1) bar[14] = null;
      return bar;
    });
  }
  let seq = null, wantTrack = null, timer = null;

  function stepAt(tr, step, time) {
    const bi = Math.floor(step / 16) % tr.chords.length, s16 = step % 16, ch = tr.chords[bi];
    const spb = 60 / tr.bpm / 4;
    const at = time - ctx.currentTime;
    const D = musicBus;
    if (s16 % tr.bass === 0) tone({ type: 'triangle', f: mf(ch[0] - 12), t: spb * tr.bass * 0.9, vol: 0.22, at, dest: D, lp: 900 });
    if (tr.arp && s16 % 2 === 0) {
      const order = [0, 1, 2, 1];
      tone({ type: 'triangle', f: mf(ch[order[(s16 / 2) % 4]] + 12), t: spb * 1.8, vol: 0.09, at, dest: D });
    }
    if (!tr.arp && s16 % 4 === 2) { // v boji krátke akordové údery
      ch.forEach(n => tone({ type: 'square', f: mf(n), t: spb * 1.2, vol: 0.025, at, dest: D, lp: 1600 }));
    }
    const m = tr.melody[bi][s16];
    if (m) tone({ type: tr.lead, f: mf(m), t: spb * (tr.lead === 'square' ? 1.6 : 2.4), vol: tr.lead === 'square' ? 0.045 : 0.09, at, dest: D, lp: 2600, detune: 4 });
    if (tr.drums === 'full') {
      if (s16 % 8 === 0 || s16 === 11) { tone({ type: 'sine', f: 120, f2: 42, t: 0.16, vol: 0.4, at, dest: D }); }
      if (s16 % 8 === 4) noise({ freq: 1800, q: 0.7, t: 0.12, vol: 0.16, at, dest: D });
      if (s16 % 2 === 1) noise({ filter: 'highpass', freq: 7000, t: 0.03, vol: 0.05, at, dest: D });
    } else if (tr.drums === 'soft') {
      if (s16 % 8 === 0) tone({ type: 'sine', f: 140, f2: 70, t: 0.12, vol: 0.14, at, dest: D });
      if (s16 % 4 === 2) noise({ filter: 'highpass', freq: 5000, t: 0.03, vol: 0.03, at, dest: D });
    }
  }
  function startTrack(name) {
    const tr = TRACKS[name];
    seq = { tr, step: 0, next: ctx.currentTime + 0.1 };
    if (!timer) timer = setInterval(tick, 30);
  }
  function tick() {
    if (!seq || !ctx || ctx.state !== 'running') return;
    const spb = 60 / seq.tr.bpm / 4;
    while (seq.next < ctx.currentTime + 0.15) {
      stepAt(seq.tr, seq.step, seq.next);
      seq.step++; seq.next += spb;
    }
  }
  function music(name) {
    if (wantTrack === name) return;
    wantTrack = name;
    if (!ctx) return; // spustí sa po prvom dotyku
    const fadeTo = (v, t) => { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(v, ctx.currentTime, t); };
    if (!name) { fadeTo(0, 0.15); setTimeout(() => { if (!wantTrack) seq = null; }, 600); return; }
    fadeTo(0, 0.08);
    setTimeout(() => {
      if (wantTrack !== name) return;
      startTrack(name);
      fadeTo(prefs.music ? 0.32 : 0, 0.3);
    }, 260);
  }

  function setPref(kind, on) {
    prefs[kind] = on; savePrefs();
    if (!ctx) return;
    if (kind === 'music') musicBus.gain.setTargetAtTime(on && wantTrack ? 0.32 : 0, ctx.currentTime, 0.1);
    else sfxBus.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05);
  }

  const debug = () => ({ state: ctx && ctx.state, track: wantTrack, step: seq && seq.step });
  return { play, music, setPref, prefs, debug };
})();
