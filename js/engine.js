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
const N2F = n => 440 * Math.pow(2, (n - 69) / 12);
function parseNotes(str) {
  // tokens: "c4:2" (note c, octave 4, 2 sixteenths) | "r:4" rest | "c#5" | "eb3"
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    const [n, l] = tok.split(':'); const len = +(l || 2);
    if (n === 'r') { out.push([null, len]); continue; }
    const m = n.match(/^([a-g])([#b]?)(\d)$/);
    if (!m) { out.push([null, len]); continue; }
    const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    out.push([12 * (+m[3] + 1) + base, len]);
  }
  return out;
}
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
    this.cur = {
      tr, chans: tr.ch.map(c => ({ ...c, seq: parseNotes(c.n), i: 0, next: 0 })), started: false
    };
    this.resume();
  },
  resume() {
    if (this.el && Sound.ac) { this.el.play().catch(() => {}); }
    if (!this.cur || !Sound.ac || this.timer) return;
    const ac = Sound.ac, step = 60 / this.cur.tr.bpm / 4;
    const t0 = ac.currentTime + 0.05;
    for (const c of this.cur.chans) { c.i = 0; c.next = t0; }
    this.timer = setInterval(() => {
      const cur = this.cur; if (!cur) return;
      const ahead = ac.currentTime + 0.25;
      for (const c of cur.chans) {
        while (c.next < ahead) {
          if (c.i >= c.seq.length) { if (cur.tr.once) { c.next = Infinity; break; } c.i = 0; }
          const [note, len] = c.seq[c.i++]; const dur = len * step;
          if (note !== null) {
            if (c.w === 'noise') Sound.noise(c.next, Math.min(dur, 0.08), c.v, Sound.music, note > 60 ? 5000 : 300);
            else Sound.tone(N2F(note), c.next, dur * (c.gate || 0.9), c.w, c.v, Sound.music);
          }
          c.next += dur;
        }
      }
    }, 50);
  },
  stop() {
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
