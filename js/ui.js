// Dialogue boxes, choices, list menus, cutscene backdrops, shops and inns.
'use strict';

const N = new Proxy({}, { get: (_, k) => (CAST[k] ? CAST[k].name : String(k)) });
const P = new Proxy({}, { get: (_, k) => CONFIG.places[k] || String(k) });

// ------------------------------------------------------------ dialogue
class DialogScene {
  constructor(who, text, clip) {
    this.who = who; this.text = text; this.n = 0; this.clip = clip;
    this.cast = typeof who === 'string' ? CAST[who] : who;
    this.lines = null;
  }
  enter() {
    const clip = this.clip || (this.cast && this.cast.clips && this.cast.clips._next);
    this.hasClip = clip ? Sound.clip(clip) : false;
  }
  update() {
    const speed = [0.6, 1, 2, 4][S ? S.config.textSpeed : 2] || 2;
    const total = this.text.length;
    if (this.n < total) {
      const before = Math.floor(this.n); this.n = Math.min(total, this.n + speed);
      if (!this.hasClip && this.cast && this.cast.voice && Math.floor(this.n / 3) !== Math.floor(before / 3) && this.text[before] !== ' ') Sound.blip(this.cast.voice);
      if (Input.pressed('a') || Input.pressed('b')) this.n = total;
    } else if (Input.pressed('a') || Input.pressed('b')) { Sound.play('cursor'); Scenes.pop(this); }
  }
  draw() {
    const hasP = this.cast && (this.cast.look || this.cast.portrait);
    const x = 4, y = 166, w = 312, h = 70;
    win(x, y, w, h);
    let tx = x + 10;
    if (hasP && typeof this.who === 'string') { drawPortrait(this.who, x + 8, y + 9, 52); tx = x + 68; }
    if (this.cast) {
      const nm = this.cast.name; const nw = textW(nm) + 12;
      win(tx - 6, y - 14, nw, 16); txt(nm, tx, y - 10, '#ffe080');
    }
    if (!this.lines) this.lines = wrap(this.text, x + w - tx - 8);
    let left = Math.floor(this.n), yy = y + 12;
    for (const ln of this.lines) {
      if (left <= 0) break;
      txt(ln.slice(0, left), tx, yy); left -= ln.length + 1; yy += 13;
    }
    if (this.n >= this.text.length && G.frame % 40 < 28) { ctx.fillStyle = '#fff'; ctx.fillRect(x + w - 14, y + h - 10, 6, 4); }
  }
}

class ChoiceScene {
  constructor(options, opts = {}) {
    this.opts = options; this.i = 0; this.cancel = opts.cancel !== false; this.prompt = opts.prompt;
    this.w = Math.max(...options.map(o => textW(o))) + 32; this.x = opts.x || SW - this.w - 8; this.y = opts.y || 100;
  }
  update() {
    if (Input.pressed('up')) { this.i = (this.i + this.opts.length - 1) % this.opts.length; Sound.play('cursor'); }
    if (Input.pressed('down')) { this.i = (this.i + 1) % this.opts.length; Sound.play('cursor'); }
    if (Input.pressed('a')) { Sound.play('confirm'); Scenes.pop(this, this.i); }
    else if (Input.pressed('b') && this.cancel) { Sound.play('cancel'); Scenes.pop(this, -1); }
  }
  draw() {
    if (this.prompt) { win(4, 166, 312, 70); wrap(this.prompt, 290).forEach((l, i) => txt(l, 14, 178 + i * 13)); }
    const h = this.opts.length * 14 + 12;
    const y = this.prompt ? Math.min(this.y, 160 - h) : this.y;
    win(this.x, y, this.w, h);
    this.opts.forEach((o, i) => txt(o, this.x + 20, y + 8 + i * 14));
    cursor(this.x + 6, y + 8 + this.i * 14);
  }
}

// A scrolling list used by shops and menus.
class ListBox {
  constructor(x, y, w, rows, items) { this.x = x; this.y = y; this.w = w; this.rows = rows; this.items = items; this.i = 0; this.top = 0; this.rowH = 13; }
  get cur() { return this.items[this.i]; }
  update() {
    const n = this.items.length; if (!n) return;
    if (Input.pressed('up')) { this.i = (this.i + n - 1) % n; Sound.play('cursor'); }
    if (Input.pressed('down')) { this.i = (this.i + 1) % n; Sound.play('cursor'); }
    if (Input.pressed('left')) { this.i = Math.max(0, this.i - this.rows); Sound.play('cursor'); }
    if (Input.pressed('right')) { this.i = Math.min(n - 1, this.i + this.rows); Sound.play('cursor'); }
    if (this.i < this.top) this.top = this.i;
    if (this.i >= this.top + this.rows) this.top = this.i - this.rows + 1;
  }
  draw(active = true) {
    win(this.x, this.y, this.w, this.rows * this.rowH + 12);
    for (let k = 0; k < this.rows; k++) {
      const it = this.items[this.top + k]; if (!it) break;
      const yy = this.y + 7 + k * this.rowH;
      txt(it.label, this.x + 18, yy, it.disabled ? '#808090' : it.color || '#fff');
      if (it.right != null) txt(String(it.right), this.x + this.w - 8, yy, it.disabled ? '#808090' : '#fff', 'right');
    }
    if (active && this.items.length) cursor(this.x + 5, this.y + 7 + (this.i - this.top) * this.rowH);
    if (this.top > 0) txt('^', this.x + this.w / 2, this.y + 1, '#ffe080', 'center');
    if (this.top + this.rows < this.items.length) txt('v', this.x + this.w / 2, this.y + this.rows * this.rowH + 4, '#ffe080', 'center');
  }
}

// ------------------------------------------------------------ cutscene backdrop
class BackdropScene {
  constructor(key, caption) { this.key = key; this.caption = caption; this.opaque = true; this.t = 0; }
  update() { this.t++; }
  draw() {
    const path = CONFIG.scenes && CONFIG.scenes[this.key];
    const img = Img.get(path);
    if (img) {
      const s = Math.max(SW / img.naturalWidth, SH / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, (SW - w) / 2, (SH - h) / 2, w, h); ctx.restore();
    } else drawSkyBackdrop(this.key, this.t);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, 14); ctx.fillRect(0, SH - 14, SW, 14);
    if (this.caption) txt(this.caption, SW / 2, 3, '#ffe080', 'center');
  }
}
const BACKDROPS = {
  intro: ['#0a0a30', '#3a1a5a', '#c06040'], festival: ['#101040', '#402060', '#f0a040'], woods: ['#0a2010', '#1a4a20', '#3a7a3a'],
  boss1: ['#200a0a', '#4a1a1a', '#a04020'], port: ['#103060', '#3070b0', '#e0c080'], boss2: ['#001020', '#003050', '#0080a0'],
  snow: ['#304060', '#8090c0', '#e0f0ff'], boss3: ['#0a1030', '#204080', '#80c0ff'], desert: ['#603010', '#c07030', '#f0d090'],
  boss4: ['#200000', '#601010', '#f06020'], rift: ['#0a0010', '#300040', '#a020c0'], final1: ['#000000', '#300020', '#c02060'],
  final2: ['#000000', '#200040', '#ff40ff'], ending: ['#f0a060', '#f0d0a0', '#80c0ff']
};
function drawSkyBackdrop(key, t) {
  const c = BACKDROPS[key] || BACKDROPS.intro;
  const g = ctx.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, c[0]); g.addColorStop(0.6, c[1]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  const r = mulberry32(hashStr(key));
  for (let i = 0; i < 40; i++) {
    const x = r() * SW, y = r() * SH * 0.6, tw = Math.sin(t / 20 + i) > 0.6;
    ctx.fillStyle = tw ? '#fff' : 'rgba(255,255,255,0.5)'; ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.moveTo(0, SH);
  for (let x = 0; x <= SW; x += 16) ctx.lineTo(x, SH * 0.72 - Math.abs(Math.sin(x * 0.013 + r() * 0.3)) * 40 - r() * 10);
  ctx.lineTo(SW, SH); ctx.fill();
}

class TitleCardScene {
  constructor(a, b) { this.a = a; this.b = b; this.t = 0; this.opaque = true; }
  update() { this.t++; if (this.t > 200 || (this.t > 30 && Input.pressed('a'))) Scenes.pop(this); }
  draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    const al = Math.min(1, this.t / 40, (200 - this.t) / 30);
    ctx.globalAlpha = Math.max(0, al);
    txt(this.a, SW / 2, 96, '#ffe080', 'center');
    txt(this.b, SW / 2, 120, '#fff', 'center', 8);
    ctx.globalAlpha = 1;
  }
}

class MessageScene { // short centred notice, e.g. "Obtained Potion!"
  constructor(text) { this.text = text; }
  update() { if (Input.pressed('a') || Input.pressed('b')) Scenes.pop(this); }
  draw() { const ls = wrap(this.text, 280); const h = ls.length * 13 + 14; win(16, 92 - h / 2, 288, h); ls.forEach((l, i) => txt(l, SW / 2, 99 - h / 2 + i * 13, '#fff', 'center')); }
}

// ------------------------------------------------------------ shop
class ShopScene {
  constructor(stock, title) {
    this.stock = stock; this.title = title; this.mode = 'root'; this.root = 0; this.qty = 1;
    this.list = null; this.msg = '';
  }
  buildBuy() {
    this.list = new ListBox(4, 40, 196, 9, this.stock.map(id => ({ id, label: itemDef(id).name, right: itemDef(id).price })));
  }
  buildSell() {
    const items = Object.keys(S.inv).filter(id => S.inv[id] > 0).map(id => {
      const d = itemDef(id), price = d.sell || Math.floor((d.price || 0) / 2);
      return { id, label: d.name, right: price, price, disabled: price <= 0 };
    });
    this.list = new ListBox(4, 40, 196, 9, items);
  }
  update() {
    if (this.mode === 'root') {
      if (Input.pressed('up') || Input.pressed('down')) { this.root = (this.root + (Input.pressed('up') ? 2 : 1)) % 3; Sound.play('cursor'); }
      if (Input.pressed('a')) {
        Sound.play('confirm');
        if (this.root === 0) { this.mode = 'buy'; this.buildBuy(); }
        else if (this.root === 1) { this.mode = 'sell'; this.buildSell(); }
        else Scenes.pop(this);
      }
      if (Input.pressed('b')) { Sound.play('cancel'); Scenes.pop(this); }
      return;
    }
    if (this.mode === 'qty') {
      const it = this.list.cur, price = this.buying ? itemDef(it.id).price : it.price;
      const max = this.buying ? Math.min(99 - itemCount(it.id), Math.floor(S.gil / price)) : itemCount(it.id);
      if (Input.pressed('up') || Input.pressed('right')) { this.qty = Math.min(max, this.qty + (Input.pressed('right') ? 10 : 1)); Sound.play('cursor'); }
      if (Input.pressed('down') || Input.pressed('left')) { this.qty = Math.max(1, this.qty - (Input.pressed('left') ? 10 : 1)); Sound.play('cursor'); }
      if (Input.pressed('a')) {
        if (this.buying) { S.gil -= price * this.qty; addItem(it.id, this.qty); this.msg = 'Thank you!'; }
        else { S.gil += price * this.qty; addItem(it.id, -this.qty); this.msg = 'Sold!'; this.buildSell(); }
        Sound.play('buy'); this.mode = this.buying ? 'buy' : 'sell';
      }
      if (Input.pressed('b')) { Sound.play('cancel'); this.mode = this.buying ? 'buy' : 'sell'; }
      return;
    }
    this.list.update();
    if (Input.pressed('a') && this.list.cur) {
      const it = this.list.cur; this.buying = this.mode === 'buy';
      const price = this.buying ? itemDef(it.id).price : it.price;
      if (this.buying && (S.gil < price || itemCount(it.id) >= 99)) { Sound.play('error'); this.msg = S.gil < price ? 'Not enough gil.' : 'You cannot carry more.'; return; }
      if (!this.buying && it.disabled) { Sound.play('error'); this.msg = 'I cannot buy that.'; return; }
      Sound.play('confirm'); this.qty = 1; this.mode = 'qty';
    }
    if (Input.pressed('b')) { Sound.play('cancel'); this.mode = 'root'; this.msg = ''; }
  }
  draw() {
    win(4, 4, 312, 34);
    txt(this.title, 14, 10, '#ffe080');
    txt(this.msg || (this.mode === 'root' ? 'Welcome! What will it be?' : this.mode === 'sell' ? 'What will you sell?' : 'Take a look.'), 14, 23);
    win(220, 4, 96, 34); txt('Gil', 228, 10, '#a0c0ff'); txt(String(S.gil), 308, 23, '#fff', 'right');
    if (this.mode === 'root') {
      win(4, 40, 100, 52);['Buy', 'Sell', 'Leave'].forEach((o, i) => txt(o, 24, 48 + i * 14)); cursor(10, 48 + this.root * 14);
      return;
    }
    this.list.draw(this.mode !== 'qty');
    const it = this.list.cur; if (!it) return;
    const d = itemDef(it.id);
    win(202, 40, 114, 124);
    txt('Owned ' + itemCount(it.id), 210, 47);
    if (d.slot) {
      txt('Equipped ' + equippedCount(it.id), 210, 59, '#c0c0d0');
      let yy = 75;
      for (const pid of S.party) {
        const m = S.members[pid];
        if (!canEquip(CAST[pid].job, d)) { txt(CAST[pid].name.slice(0, 6), 210, yy, '#606070'); txt('--', 308, yy, '#606070', 'right'); yy += 13; continue; }
        const cur = stats(m), m2 = { ...m, eq: { ...m.eq, [d.slot]: it.id } }, nw = stats(m2);
        const key = d.slot === 'weapon' ? (CAST[pid].job === 'mage' || CAST[pid].job === 'healer' ? 'mag' : 'atk') : 'def';
        const diff = d.slot === 'acc' ? 0 : nw[key] - cur[key];
        txt(CAST[pid].name.slice(0, 6), 210, yy);
        txt((diff > 0 ? '+' : '') + diff, 308, yy, diff > 0 ? '#80ff80' : diff < 0 ? '#ff8080' : '#fff', 'right');
        yy += 13;
      }
    }
    const desc = d.desc || describeEquip(d);
    win(4, 164, 312, 32); txt(desc, 12, 175);
    if (this.mode === 'qty') {
      const price = this.buying ? d.price : it.price;
      win(60, 100, 150, 40); txt('Qty  x' + this.qty, 72, 108); txt('Total ' + price * this.qty, 72, 122, '#ffe080');
    }
  }
}
function describeEquip(d) {
  if (!d || !d.slot) return '';
  const parts = [];
  for (const [k, n] of [['atk', 'Atk'], ['def', 'Def'], ['mdef', 'MDef'], ['str', 'Str'], ['mag', 'Mag'], ['spd', 'Spd']]) if (d[k]) parts.push(n + '+' + d[k]);
  if (d.hpPct) parts.push('HP+' + d.hpPct + '%');
  if (d.el) parts.push(d.el + ' element');
  if (d.ward) parts.push(d.ward.length > 3 ? 'Wards status' : 'Ward ' + d.ward.join('/'));
  if (d.slot !== 'acc') parts.push('[' + d.type + ']');
  return parts.join('  ');
}
