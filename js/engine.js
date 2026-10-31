// Core engine: canvas, input, audio, scenes, drawing helpers.
'use strict';

const SW = 320, SH = 240, SCALE = 3;
const FONT = '"Barlow", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const DISPLAY_FONT = '"Cinzel", "Times New Roman", serif';

const canvas = document.getElementById('game');
canvas.width = SW * SCALE; canvas.height = SH * SCALE;
const ctx = canvas.getContext('2d');
ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------- utils
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const sleep = frames => new Promise(res => Timers.push({ t: frames, res }));
const Timers = [];
function tickTimers() {
  for (let i = Timers.length - 1; i >= 0; i--) if (--Timers[i].t <= 0) { const t = Timers.splice(i, 1)[0]; t.res(); }
}

// ---------------------------------------------------------------- input
const BTNS = ['up', 'down', 'left', 'right', 'a', 'b'];
const DIRS = ['up', 'down', 'left', 'right'];
const Input = {
  raw: {}, tap: {}, h: {}, p: {},
  keymap: {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right', KeyZ: 'a', Enter: 'a', Space: 'a', KeyJ: 'a',
    KeyX: 'b', Escape: 'b', Backspace: 'b', KeyK: 'b'
  },
  set(b, v) { if (v && !this.raw[b]) this.tap[b] = true; this.raw[b] = v; },
  update() {
    for (const b of BTNS) {
      if (this.raw[b] || this.tap[b]) this.h[b] = (this.h[b] || 0) + 1; else this.h[b] = 0;
      const n = this.h[b];
      this.p[b] = n === 1 || (DIRS.includes(b) && n > 16 && (n - 16) % 5 === 0);
      this.tap[b] = false;
    }
  },
  pressed(b) { return !!this.p[b]; },
  held(b) { return this.h[b] > 0; },
  consume() { for (const b of BTNS) this.p[b] = false; },
  dir() { for (const d of DIRS) if (this.held(d)) return d; return null; }
};
addEventListener('keydown', e => {
  const b = Input.keymap[e.code]; if (b) { Input.set(b, true); e.preventDefault(); }
  Sound.unlock();
});
addEventListener('keyup', e => { const b = Input.keymap[e.code]; if (b) Input.set(b, false); });
addEventListener('blur', () => { for (const b of BTNS) Input.raw[b] = false; });
function bindTouch() {
  document.querySelectorAll('[data-btn]').forEach(el => {
    const b = el.dataset.btn;
    const on = e => { e.preventDefault(); Sound.unlock(); Input.set(b, true); el.classList.add('on'); };
    const off = e => { e.preventDefault(); Input.set(b, false); el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
  });
  canvas.addEventListener('pointerdown', () => Sound.unlock());
}

// ---------------------------------------------------------------- images
const Img = {
  cache: {},
  get(path) {
    if (!path) return null;
    let e = this.cache[path];
    if (!e) {
      e = this.cache[path] = { img: new Image(), ok: false };
      e.img.onload = () => { e.ok = true; };
      e.img.src = path;
    }
    return e.ok ? e.img : null;
  }
};

// ---------------------------------------------------------------- audio
const Sound = {
  ac: null, master: null, music: null, sfx: null, voiceVol: 1,
  vol: { music: 0.5, sfx: 0.7 },
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain(); this.master.connect(this.ac.destination);
    this.music = this.ac.createGain(); this.music.gain.value = this.vol.music; this.music.connect(this.master);
    this.sfx = this.ac.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    const len = this.ac.sampleRate; this.noiseBuf = this.ac.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    Music.resume();
  },
  setVolumes() {
    if (this.music) this.music.gain.value = this.vol.music;
    if (this.sfx) this.sfx.gain.value = this.vol.sfx;
    if (Music.el) Music.el.volume = this.vol.music;
  },
  tone(freq, t, dur, wave = 'square', vol = 0.2, dest = this.sfx, slide = 0) {
    if (!this.ac) return;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = wave; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(t, dur, vol = 0.2, dest = this.sfx, hp = 800) {
    if (!this.ac) return;
    const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  play(name) {
    if (!this.ac) return; const t = this.ac.currentTime;
    const T = (f, d, w, v, dt = 0, s) => this.tone(f, t + dt, d, w, v, this.sfx, s);
    switch (name) {
      case 'cursor': T(880, 0.04, 'square', 0.08); break;
      case 'confirm': T(660, 0.05, 'square', 0.1); T(990, 0.07, 'square', 0.1, 0.05); break;
      case 'cancel': T(440, 0.06, 'square', 0.1); T(330, 0.08, 'square', 0.1, 0.05); break;
      case 'error': T(150, 0.15, 'sawtooth', 0.12); break;
      case 'hit': this.noise(t, 0.12, 0.3, this.sfx, 400); T(120, 0.1, 'square', 0.15, 0, 0.5); break;
      case 'crit': this.noise(t, 0.25, 0.4, this.sfx, 200); T(200, 0.2, 'sawtooth', 0.2, 0, 0.3); break;
      case 'miss': T(1200, 0.08, 'sine', 0.06, 0, 0.5); break;
      case 'slash': this.noise(t, 0.09, 0.25, this.sfx, 2500); break;
      case 'fire': this.noise(t, 0.5, 0.3, this.sfx, 300); T(90, 0.4, 'sawtooth', 0.12, 0, 2); break;
      case 'ice': for (let i = 0; i < 5; i++) T(1800 + i * 300, 0.12, 'triangle', 0.08, i * 0.05); break;
      case 'bolt': this.noise(t, 0.3, 0.35, this.sfx, 1500); T(60, 0.3, 'square', 0.15, 0, 3); break;
      case 'holy': for (let i = 0; i < 6; i++) T(880 * Math.pow(1.26, i), 0.25, 'sine', 0.07, i * 0.04); break;
      case 'dark': T(220, 0.6, 'sawtooth', 0.12, 0, 0.25); T(233, 0.6, 'sawtooth', 0.1, 0, 0.25); break;
      case 'heal': for (let i = 0; i < 5; i++) T(523 * Math.pow(1.19, i), 0.15, 'triangle', 0.08, i * 0.06); break;
      case 'buff': T(400, 0.3, 'triangle', 0.1, 0, 2); break;
      case 'debuff': T(500, 0.3, 'triangle', 0.1, 0, 0.4); break;
      case 'chest': T(523, 0.08, 'square', 0.1); T(659, 0.08, 'square', 0.1, 0.08); T(784, 0.08, 'square', 0.1, 0.16); T(1046, 0.25, 'square', 0.1, 0.24); break;
      case 'levelup': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => T(f, 0.12, 'square', 0.1, i * 0.08)); break;
      case 'encounter': for (let i = 0; i < 8; i++) T(200 + i * 120, 0.06, 'sawtooth', 0.08, i * 0.03); this.noise(t + 0.25, 0.4, 0.2, this.sfx, 600); break;
      case 'buy': T(1318, 0.06, 'square', 0.08); T(1760, 0.1, 'square', 0.08, 0.06); break;
      case 'save': [392, 523, 659, 784].forEach((f, i) => T(f, 0.2, 'triangle', 0.1, i * 0.1)); break;
      case 'stairs': for (let i = 0; i < 4; i++) T(300 - i * 40, 0.08, 'square', 0.08, i * 0.07); break;
      case 'die': T(300, 0.6, 'sawtooth', 0.15, 0, 0.2); break;
      case 'enemydie': this.noise(t, 0.5, 0.25, this.sfx, 1000); T(400, 0.5, 'square', 0.08, 0, 0.1); break;
      case 'burst': for (let i = 0; i < 10; i++) T(300 + i * 90, 0.1, 'square', 0.08, i * 0.03); this.noise(t + 0.3, 0.6, 0.35, this.sfx, 200); break;
      case 'quake': this.noise(t, 1.0, 0.45, this.sfx, 60); T(40, 1.0, 'sawtooth', 0.2); break;
      case 'steal': T(1500, 0.05, 'square', 0.08); T(2000, 0.05, 'square', 0.08, 0.06); break;
      case 'step': break;
    }
  },
  blip(voice) {
    if (!this.ac || !voice) return; const t = this.ac.currentTime;
    this.tone(voice.pitch * rand(0.9, 1.15), t, 0.045, voice.wave || 'square', 0.05);
  },
  clipEl: null,
  clip(path) {
    if (!path) return false;
    try {
      if (this.clipEl) this.clipEl.pause();
      this.clipEl = new Audio(path); this.clipEl.volume = this.voiceVol;
      this.clipEl.play().catch(() => {});
      return true;
    } catch (e) { return false; }
  }
};

// ---------------------------------------------------------------- music
// A small orchestra synthesised live with WebAudio. Each instrument is a recipe of oscillators,
// filters and envelopes, played through a shared hall reverb. The score is in js/data/music.js.
const N2F = n => 440 * Math.pow(2, (n - 69) / 12);
// o: oscillators [wave, detune (cents), gain, pitch multiple]   f: filter cutoff [start, end]
// a/d/s/r: envelope   pluck: decays instead of sustaining   vib: [rate, cents, delay]   trem: [rate, depth]
const ORCH = {
  strings: { o: [['sawtooth', -9, 1], ['sawtooth', 9, 1], ['sawtooth', 0, 0.5, 0.5]], f: [1100, 2400], q: 0.5, a: 0.25, d: 0.3, s: 0.85, r: 0.6, vib: [5, 6, 0.3] },
  violin: { o: [['sawtooth', -4, 1], ['sawtooth', 5, 0.7]], f: [2000, 3800], q: 0.9, a: 0.07, d: 0.2, s: 0.85, r: 0.3, vib: [5.5, 14, 0.15] },
  cello: { o: [['sawtooth', -6, 1], ['sawtooth', 6, 0.8]], f: [650, 1300], q: 0.7, a: 0.1, d: 0.2, s: 0.9, r: 0.4, vib: [5, 9, 0.25] },
  contrabass: { o: [['sawtooth', 0, 0.8], ['triangle', 0, 1]], f: [380, 620], q: 0.7, a: 0.05, d: 0.2, s: 0.9, r: 0.25 },
  pizz: { o: [['sawtooth', 0, 0.8], ['triangle', 3, 1]], f: [1800, 500], q: 1, a: 0.003, d: 0.28, s: 0, r: 0.15, pluck: true },
  harp: { o: [['triangle', 0, 1], ['sine', 0, 0.5, 2]], f: [3800, 1400], a: 0.002, d: 1.5, s: 0, r: 0.8, pluck: true },
  guitar: { o: [['triangle', 0, 1], ['sawtooth', 2, 0.3]], f: [2600, 800], q: 1.5, a: 0.002, d: 0.8, s: 0, r: 0.3, pluck: true },
  mandolin: { o: [['sawtooth', -5, 0.6], ['sawtooth', 5, 0.6], ['triangle', 0, 1]], f: [4200, 1500], q: 2, a: 0.002, d: 0.35, s: 0, r: 0.15, pluck: true },
  piano: { o: [['triangle', 0, 1], ['sine', 0, 0.5, 2], ['sine', 2, 0.15, 3]], f: [5000, 1400], a: 0.002, d: 2.2, s: 0, r: 0.5, pluck: true },
  celesta: { o: [['sine', 0, 1], ['sine', 0, 0.35, 2.76], ['sine', 0, 0.15, 5.4]], f: [9000, 9000], a: 0.002, d: 1.8, s: 0, r: 1.2, pluck: true },
  flute: { o: [['sine', 0, 1], ['triangle', 0, 0.25, 2]], noise: 0.04, f: [3200, 3200], a: 0.07, d: 0.15, s: 0.85, r: 0.18, vib: [5, 11, 0.25] },
  oboe: { o: [['sawtooth', 0, 1], ['square', 4, 0.3]], f: [1500, 1700], q: 3, a: 0.05, d: 0.15, s: 0.85, r: 0.15, vib: [5.5, 10, 0.2] },
  clarinet: { o: [['square', 0, 1], ['sine', 0, 0.5]], f: [1200, 1400], q: 1.2, a: 0.05, d: 0.1, s: 0.9, r: 0.15, vib: [5, 6, 0.3] },
  horn: { o: [['sawtooth', -4, 1], ['sawtooth', 4, 0.8]], f: [420, 1300], q: 1, a: 0.1, d: 0.3, s: 0.85, r: 0.35, vib: [4.5, 5, 0.4] },
  brass: { o: [['sawtooth', -3, 1], ['sawtooth', 3, 1]], f: [700, 3000], q: 1.4, a: 0.035, d: 0.25, s: 0.75, r: 0.2, vib: [5, 6, 0.25] },
  choir: { o: [['sawtooth', -11, 1], ['sawtooth', 11, 1], ['sawtooth', 0, 0.7]], formants: [[650, 5, 1], [1100, 7, 0.6], [2700, 9, 0.25]], a: 0.35, d: 0.3, s: 0.9, r: 0.8, vib: [4.5, 10, 0.4] },
  organ: { o: [['sine', 0, 1], ['sine', 0, 0.7, 2], ['sine', 0, 0.5, 3], ['sine', 0, 0.35, 4], ['sine', 0, 0.2, 8]], f: [7000, 7000], a: 0.02, d: 0.1, s: 1, r: 0.2, trem: [6, 0.06] },
  accordion: { o: [['square', -9, 0.6], ['sawtooth', 9, 0.6]], f: [1900, 1900], q: 2, a: 0.04, d: 0.1, s: 0.9, r: 0.12, trem: [6.5, 0.12] },
  bass: { o: [['sawtooth', 0, 0.6], ['sine', 0, 1]], f: [900, 320], q: 2.5, a: 0.005, d: 0.35, s: 0.55, r: 0.08 },
  lead: { o: [['sawtooth', -7, 1], ['sawtooth', 7, 1], ['square', 0, 0.4, 0.5]], dist: true, f: [2000, 1500], q: 1, a: 0.01, d: 0.3, s: 0.75, r: 0.15, vib: [5.5, 16, 0.2] },
  chug: { o: [['sawtooth', -5, 1], ['sawtooth', 5, 1]], dist: true, f: [1100, 320], q: 1.2, a: 0.003, d: 0.14, s: 0.2, r: 0.05 },
  pad: { o: [['sawtooth', -12, 1], ['sawtooth', 12, 1]], f: [500, 1100], q: 0.5, a: 0.8, d: 0.5, s: 0.9, r: 1.2 },
  timp: { o: [['sine', 0, 1], ['sine', 0, 0.3, 1.5]], noise: 0.25, f: [900, 300], a: 0.003, d: 1.1, s: 0, r: 0.6, pluck: true, drop: 0.96 }
};
let DIST_CURVE = null;
function distCurve() {
  if (DIST_CURVE) return DIST_CURVE;
  const n = 1025, c = new Float32Array(n); // odd length: silence maps exactly to 0
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 6) * 0.8; }
  return (DIST_CURVE = c);
}
const Orchestra = {
  init() { // shared bus: dry + hall reverb, gentle compression
    const ac = Sound.ac; if (!ac || this.bus) return;
    this.bus = ac.createGain();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.bus.connect(comp); comp.connect(Sound.music);
    this.verb = ac.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4); this.verb.connect(comp);
  },
  // each track plays through its own gain so it can fade out cleanly when the music changes
  track(reverb) {
    const ac = Sound.ac, tg = ac.createGain(), send = ac.createGain();
    send.gain.value = reverb; tg.connect(this.bus); tg.connect(send); send.connect(this.verb);
    return (this.tg = tg);
  },
  release(tg) {
    if (!tg || !Sound.ac) return; const t = Sound.ac.currentTime;
    tg.gain.cancelScheduledValues(t); tg.gain.setValueAtTime(tg.gain.value, t); tg.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => tg.disconnect(), 600);
  },
  impulse(sec, decay) {
    const ac = Sound.ac, len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / len, decay); } }
    return b;
  },
  out(pan, tg) { // per-voice output: panner -> the track's gain
    const ac = Sound.ac, g = ac.createGain();
    if (ac.createStereoPanner && pan) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(tg); } else g.connect(tg);
    return g;
  },
  note(inst, midi, t, dur, vol, pan = 0, tg = this.tg) {
    const I = ORCH[inst], ac = Sound.ac; if (!I || !ac) return;
    const f0 = N2F(midi), end = I.pluck ? t + Math.min(I.d, dur + I.r) : t + dur, stopAt = end + I.r + 0.05;
    const amp = ac.createGain(), out = this.out(pan, tg); amp.gain.value = 0; // silent until the note starts
    // filter (lowpass with an envelope, or vowel formants for the choir)
    let head;
    if (I.formants) { head = ac.createGain(); for (const [ff, q, gn] of I.formants) { const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; const fg = ac.createGain(); fg.gain.value = gn * 2.2; head.connect(bp); bp.connect(fg); fg.connect(amp); } }
    else {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = I.q || 0.7;
      const fa = Math.min(20000, I.f[0] * (midi > 72 ? 1.4 : 1)), fb = Math.min(20000, I.f[1] * (midi > 72 ? 1.4 : 1));
      lp.frequency.setValueAtTime(fa, t); lp.frequency.exponentialRampToValueAtTime(fb, t + (I.pluck ? I.d * 0.6 : I.a + 0.05));
      head = lp; lp.connect(amp);
    }
    if (I.dist) { const ws = ac.createWaveShaper(); ws.curve = distCurve(); ws.connect(head); head = ws; }
    // oscillators
    const tot = I.o.reduce((s, o) => s + o[2], 0), oscs = [];
    let lfo = null;
    if (I.vib) { lfo = ac.createOscillator(); lfo.frequency.value = I.vib[0]; const lg = ac.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(I.vib[1], t + I.vib[2] + 0.01); lfo.connect(lg); lfo.lg = lg; lfo.start(t); lfo.stop(stopAt); }
    for (const [w, det, gn, mult = 1] of I.o) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = w; o.frequency.setValueAtTime(f0 * mult, t); o.detune.value = det;
      if (I.drop) o.frequency.exponentialRampToValueAtTime(f0 * mult * I.drop, t + 0.3);
      if (lfo) lfo.lg.connect(o.detune);
      g.gain.value = gn / tot; o.connect(g); g.connect(head); o.start(t); o.stop(stopAt); oscs.push(o);
    }
    if (I.noise) { const s = ac.createBufferSource(); s.buffer = Sound.noiseBuf; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(8000, f0 * 2); bp.Q.value = 1; const g = ac.createGain(); g.gain.value = I.noise; s.connect(bp); bp.connect(g); g.connect(head); s.start(t, Math.random() * 0.5); s.stop(stopAt); }
    // amplitude envelope
    const A = amp.gain, peak = vol;
    A.setValueAtTime(0.0001, t); A.exponentialRampToValueAtTime(peak, t + I.a);
    if (I.pluck) A.exponentialRampToValueAtTime(0.0001, end + I.r * 0.5);
    else { A.exponentialRampToValueAtTime(Math.max(0.0001, peak * I.s), t + I.a + I.d); A.setValueAtTime(Math.max(0.0001, peak * I.s), Math.max(t + I.a + I.d, end)); A.exponentialRampToValueAtTime(0.0001, Math.max(t + I.a + I.d, end) + I.r); }
    if (I.trem) { const tl = ac.createOscillator(), tg = ac.createGain(); tl.frequency.value = I.trem[0]; tg.gain.value = peak * I.trem[1]; tl.connect(tg); tg.connect(A); tl.start(t); tl.stop(stopAt); }
    amp.connect(out);
  },
  // percussion: K kick, s/S snare, h/o hats, C crash, t/u toms, T/m tambourine & shaker, H heartbeat, D taiko, R ride
  drum(ch, t, vol, pan = 0, tg = this.tg) {
    const ac = Sound.ac, out = this.out(pan, tg);
    const nz = (dur, type, freq, q, v, delay = 0) => { const s = ac.createBufferSource(); s.buffer = Sound.noiseBuf; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; const g = ac.createGain(); g.gain.setValueAtTime(v, t + delay); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t + delay, Math.random() * 0.5); s.stop(t + delay + dur + 0.05); };
    const tn = (fa, fb, dur, v, w = 'sine', delay = 0) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = w; o.frequency.setValueAtTime(fa, t + delay); o.frequency.exponentialRampToValueAtTime(fb, t + delay + dur * 0.6); g.gain.setValueAtTime(v, t + delay); g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur); o.connect(g); g.connect(out); o.start(t + delay); o.stop(t + delay + dur + 0.05); };
    switch (ch) {
      case 'K': tn(140, 42, 0.32, vol * 1.6); nz(0.02, 'highpass', 3000, 0.7, vol * 0.3); break;
      case 's': case 'S': { const k = ch === 'S' ? 1.4 : 1; nz(0.2, 'bandpass', 1900, 0.8, vol * k); tn(200, 160, 0.1, vol * 0.5 * k, 'triangle'); break; }
      case 'r': nz(0.07, 'bandpass', 2400, 1, vol * 0.45); break; // snare roll stroke
      case 'h': nz(0.05, 'highpass', 7500, 0.7, vol * 0.35); break;
      case 'o': nz(0.32, 'highpass', 6500, 0.7, vol * 0.35); break;
      case 'R': nz(0.6, 'bandpass', 5500, 3, vol * 0.3); tn(3100, 3000, 0.6, vol * 0.04, 'square'); break;
      case 'C': nz(2.2, 'highpass', 3500, 0.5, vol * 0.7); nz(1.5, 'bandpass', 6000, 2, vol * 0.4); break;
      case 't': tn(120, 75, 0.4, vol * 1.1); break;
      case 'u': tn(180, 120, 0.3, vol * 1.0); break;
      case 'D': tn(80, 48, 0.9, vol * 1.8); nz(0.15, 'lowpass', 600, 0.7, vol * 0.5); break;
      case 'T': nz(0.14, 'highpass', 6500, 1, vol * 0.5); nz(0.1, 'highpass', 8000, 1, vol * 0.3, 0.018); break;
      case 'm': nz(0.06, 'highpass', 5500, 0.7, vol * 0.25); break;
      case 'H': tn(70, 45, 0.18, vol * 1.6); tn(66, 42, 0.22, vol * 1.2, 'sine', 0.2); break;
    }
  }
};
const Music = {
  cur: null, name: null, el: null, timer: null,
  play(name) {
    if (this.name === name) return;
    this.stop(); this.name = name;
    const file = (window.CONFIG.music || {})[name];
    if (file) {
      this.el = new Audio(file); this.el.loop = name !== 'victory'; this.el.volume = Sound.vol.music;
      this.el.play().catch(() => {}); return;
    }
    const tr = window.TRACKS && TRACKS[name]; if (!tr) return;
    const mk = (p, intro) => ({ ...p, seq: p.kit ? parseKit(p.kit) : parseNotes(p.n), i: 0, next: 0, intro });
    this.cur = { tr, chans: [...(tr.intro || []).map(p => mk(p, true)), ...tr.parts.map(p => mk(p, false))] };
    this.resume();
  },
  resume() {
    if (this.el && Sound.ac) { this.el.play().catch(() => {}); }
    if (!this.cur || !Sound.ac || this.timer) return;
    Orchestra.init();
    const ac = Sound.ac, tr = this.cur.tr, step = 60 / tr.bpm / 4, tg = this.cur.tg = Orchestra.track(tr.reverb != null ? tr.reverb : 0.3);
    const t0 = ac.currentTime + 0.08, introLen = tr.intro ? seqLength(this.cur.chans.find(c => c.intro).seq) * step : 0;
    for (const c of this.cur.chans) { c.i = 0; c.next = c.intro ? t0 : t0 + introLen; }
    this.timer = setInterval(() => {
      const cur = this.cur; if (!cur) return;
      const ahead = ac.currentTime + 0.3;
      for (const c of cur.chans) {
        while (c.next < ahead) {
          if (c.i >= c.seq.length) { if (c.intro || cur.tr.once) { c.next = Infinity; break; } c.i = 0; }
          const [notes, len, acc] = c.seq[c.i++], dur = len * step, v = (c.v || 0.1) * (acc ? 1.35 : 1);
          if (notes) {
            if (c.kit) { for (const ch of notes) Orchestra.drum(ch, c.next, v, c.pan || 0, tg); }
            else for (const n of notes) Orchestra.note(c.inst, n + (c.t || 0), c.next, dur * (c.gate || 0.95), v, c.pan || 0, tg);
          }
          c.next += dur;
        }
      }
    }, 60);
  },
  stop() {
    if (this.cur) Orchestra.release(this.cur.tg);
    clearInterval(this.timer); this.timer = null; this.cur = null; this.name = null;
    if (this.el) { this.el.pause(); this.el = null; }
  }
};

// ---------------------------------------------------------------- drawing
function txt(s, x, y, col = '#fff', align = 'left', size = 10, fam = FONT) {
  ctx.font = `600 ${size}px ${fam}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,10,0.85)'; ctx.fillText(s, x + 0.7, y + 0.7);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function textW(s, size = 10, fam = FONT) { ctx.font = `600 ${size}px ${fam}`; return ctx.measureText(s).width; }
function wrap(s, maxW, size = 10) {
  const lines = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (textW(t, size) > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    lines.push(line);
  }
  return lines;
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
// Menu window: diagonal blue gradient with a bevelled silver frame (late-90s console RPG style).
function win(x, y, w, h, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 1.4);
  g.addColorStop(0, '#2c5ad0'); g.addColorStop(0.55, '#14287e'); g.addColorStop(1, '#060c38');
  rrect(x + 1, y + 1, w - 2, h - 2, 3); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#d8dce8'; rrect(x + 1, y + 1, w - 2, h - 2, 3); ctx.stroke();
  ctx.lineWidth = 0.6; ctx.strokeStyle = '#6a7090'; rrect(x + 2.4, y + 2.4, w - 4.8, h - 4.8, 2); ctx.stroke();
  ctx.restore();
}
// pointing-hand cursor
function cursor(x, y) {
  const o = Math.sin(G.frame / 6) * 1.2 + x, yy = y + 1;
  ctx.save(); ctx.lineWidth = 0.8; ctx.strokeStyle = '#202030'; ctx.fillStyle = '#f4f4f8';
  ctx.beginPath(); ctx.moveTo(o, yy + 2); ctx.lineTo(o + 6, yy + 2); ctx.lineTo(o + 10, yy + 1); ctx.lineTo(o + 11, yy + 3);
  ctx.lineTo(o + 7, yy + 4); ctx.lineTo(o + 7, yy + 8); ctx.lineTo(o + 1, yy + 8); ctx.lineTo(o, yy + 6); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.restore();
}
function bar(x, y, w, h, frac, col, bg = '#222') {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), h);
}

// ---------------------------------------------------------------- scenes
const G = { frame: 0, shake: 0, fade: 0, fadeTarget: 0, fadeSpeed: 0, fadeRes: null, flash: 0 };
const Scenes = {
  stack: [],
  push(s) {
    return new Promise(res => { s._res = res; this.stack.push(s); if (s.enter) s.enter(); });
  },
  pop(s, result) {
    const i = this.stack.indexOf(s); if (i < 0) return;
    this.stack.splice(i, 1); if (s.exit) s.exit(); Input.consume(); s._res && s._res(result);
  },
  top() { return this.stack[this.stack.length - 1]; },
  replaceAll(s) { for (const x of this.stack) if (x.exit) x.exit(); this.stack = []; return this.push(s); }
};
function fadeTo(target, frames = 20) {
  return new Promise(res => {
    G.fadeTarget = target; G.fadeSpeed = Math.abs(target - G.fade) / Math.max(1, frames); G.fadeRes = res;
    if (G.fade === target) { G.fadeRes = null; res(); }
  });
}
function step() {
  G.frame++;
  Input.update();
  tickTimers();
  if (G.fade !== G.fadeTarget) {
    G.fade += Math.sign(G.fadeTarget - G.fade) * G.fadeSpeed;
    if (Math.abs(G.fade - G.fadeTarget) <= G.fadeSpeed) { G.fade = G.fadeTarget; const r = G.fadeRes; G.fadeRes = null; r && r(); }
  }
  const top = Scenes.top();
  if (top && top.update && G.fade === G.fadeTarget) top.update();
  else if (top && top.update && top.updateDuringFade) top.update();
  if (G.shake > 0) G.shake--;
  if (G.flash > 0) G.flash--;
}
function render() {
  R3.beginFrame();
  ctx.clearRect(0, 0, SW, SH);
  ctx.save();
  if (G.shake > 0) ctx.translate(randi(-3, 3), randi(-2, 2));
  const st = Scenes.stack; let from = 0;
  for (let i = st.length - 1; i >= 0; i--) if (st[i].opaque) { from = i; break; }
  for (let i = from; i < st.length; i++) st[i].draw && st[i].draw();
  ctx.restore();
  R3.endFrame();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash / 12})`; ctx.fillRect(0, 0, SW, SH); }
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, SW, SH); }
}
let last = 0, acc = 0;
function loop(t) {
  const dt = Math.min(100, t - last); last = t; acc += dt;
  let n = 0;
  while (acc >= 1000 / 60 && n < 4) { step(); acc -= 1000 / 60; n++; }
  if (n === 4) acc = 0;
  render();
  requestAnimationFrame(loop);
}
function fit() {
  const wrap = document.getElementById('wrap'), screen = document.getElementById('screen');
  const s = Math.max(0.5, Math.min(wrap.clientWidth / SW, wrap.clientHeight / SH));
  screen.style.width = Math.floor(SW * s) + 'px'; screen.style.height = Math.floor(SH * s) + 'px';
}
addEventListener('resize', fit);
