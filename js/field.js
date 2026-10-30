// Map exploration: world map, towns and dungeons, NPCs, chests, encounters.
'use strict';

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let WORLD = null;
class GameOver extends Error { }

class FieldScene {
  constructor() { this.opaque = true; this.map = null; this.lock = 0; this.npcs = []; this.banner = null; this.t = 0; }
  // ------------------------------------------------------------ loading
  load(mapId, x, y, dir) {
    let map;
    if (mapId === 'world') { WORLD = WORLD || buildWorld(); map = WORLD; }
    else if (mapId.startsWith('town')) map = buildTown(mapId);
    else { const [did, f] = mapId.split(':'); map = buildDungeonFloor(did, +f); }
    this.map = map;
    if (map.type === 'world') for (const g of map.gates) map.tiles[g.y * map.w + g.x] = S.flags[g.flag] ? g.open : g.closed;
    if (map.type === 'dungeon') {
      const def = DUNGEONS[map.dungeon];
      for (const o of map.objs) if (o.type === 'boss' && S.flags['boss_done:' + map.dungeon]) { o.type = 'portal'; map.tiles[o.y * map.w + o.x] = 'portal'; }
      void def;
    }
    this.px = x != null ? x : map.start.x; this.py = y != null ? y : map.start.y; this.dir = dir || (map.start && map.start.dir) || 'down';
    this.mx = 0; this.my = 0; this.moving = 0; this.walkF = 0;
    this.buildNpcs();
    S.pos = { map: mapId, x: this.px, y: this.py, dir: this.dir };
    this.resetEnc();
    Music.play(STORY.musicFor ? STORY.musicFor(mapId) || map.music : map.music);
    this.banner = { text: placeName(mapId), t: 120 };
  }
  buildNpcs() {
    const map = this.map;
    this.npcs = [];
    if (map.type === 'town') {
      for (const [x, y, role] of STALLS) this.npcs.push({ x, y, dir: 'down', look: SHOP_LOOKS[role], role, shop: true });
    }
    for (const n of STORY.npcs(map.id) || []) if (!n.hidden || !n.hidden()) this.npcs.push({ dir: 'down', ...n, ox: 0, oy: 0 });
    for (const n of this.npcs) { n.ox = 0; n.oy = 0; n.mv = 0; n.home = [n.x, n.y]; }
  }
  async goto(mapId, x, y, dir, opts = {}) {
    if (!opts.instant) { Sound.play('stairs'); await fadeTo(1, 12); }
    this.load(mapId, x, y, dir);
    if (!opts.instant) await fadeTo(0, 12);
    if (STORY.onEnter) await this.run(() => STORY.onEnter(mapId, this));
  }
  resetEnc() { S.encSteps = randi(14, 32); }

  // ------------------------------------------------------------ queries
  tile(x, y) { const m = this.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return 'void'; return m.tiles[y * m.w + x]; }
  npcAt(x, y) { return this.npcs.find(n => n.x === x && n.y === y); }
  objAt(x, y) { return this.map.objs && this.map.objs.find(o => o.x === x && o.y === y); }
  solid(x, y) {
    const t = this.tile(x, y), def = TILE[t];
    if (!def || def.solid) return true;
    if (this.npcAt(x, y)) return true;
    const o = this.objAt(x, y); if (o && (o.type === 'chest' || o.type === 'boss')) return true;
    return false;
  }
  zone() {
    if (this.map.type === 'world') return worldZone(this.px, this.py);
    if (this.map.type === 'dungeon') return this.map.zone;
    return null;
  }

  // ------------------------------------------------------------ update
  update() {
    this.t++;
    if (this.banner && this.banner.t > 0) this.banner.t--;
    this.updateNpcs();
    if (this.lock) return;
    if (this.moving) {
      this.moving--; const [dx, dy] = DIRV[this.dir];
      this.mx = -dx * this.moving * 2; this.my = -dy * this.moving * 2;
      if (this.moving % 4 === 0) this.walkF++;
      if (!this.moving) { this.mx = this.my = 0; this.arrive(); }
      return;
    }
    if (Input.pressed('b')) { Sound.play('confirm'); this.run(() => Scenes.push(new MenuScene(this))); return; }
    if (Input.pressed('a')) { this.interact(); return; }
    const d = Input.dir();
    if (d) {
      this.dir = d;
      const [dx, dy] = DIRV[d], nx = this.px + dx, ny = this.py + dy;
      if (this.leaveEdge(nx, ny)) return;
      if (!this.solid(nx, ny)) { this.px = nx; this.py = ny; this.moving = 8; this.mx = -dx * 16; this.my = -dy * 16; }
      else this.bump(nx, ny);
    }
  }
  updateNpcs() {
    for (const n of this.npcs) {
      if (n.mv > 0) {
        n.mv--; const [dx, dy] = DIRV[n.dir]; n.ox = -dx * n.mv * 2; n.oy = -dy * n.mv * 2;
        continue;
      }
      if (!n.wander || this.lock) continue;
      if (Math.random() < 0.012) {
        const d = pick(DIRS), [dx, dy] = DIRV[d], nx = n.x + dx, ny = n.y + dy;
        n.dir = d;
        if (Math.abs(nx - n.home[0]) > 3 || Math.abs(ny - n.home[1]) > 3) continue;
        if (this.solid(nx, ny) || (nx === this.px && ny === this.py)) continue;
        if (TILE[this.tile(nx, ny)] && this.tile(nx, ny) === 'tpath' && ny >= 16) continue;
        n.x = nx; n.y = ny; n.mv = 8;
      }
    }
  }
  leaveEdge(nx, ny) {
    const m = this.map;
    if (m.type === 'town' && ny >= m.h - 1) { this.leaveTo(); return true; }
    return false;
  }
  leaveTo() {
    const m = this.map, base = m.type === 'dungeon' ? m.dungeon : m.id;
    const loc = (WORLD || buildWorld()).locs.find(l => l.id === base);
    this.run(() => this.goto('world', loc.x, loc.y, 'down'));
  }
  bump(nx, ny) {
    if (this.map.type === 'world') {
      const g = this.map.gates.find(g => g.x === nx && g.y === ny);
      if (g && !S.flags[g.flag] && !this.bumped) { this.bumped = true; this.run(async () => { await Ev.say(null, g.msg); this.bumped = false; }); }
    }
  }
  async arrive() {
    S.pos = { map: this.map.id, x: this.px, y: this.py, dir: this.dir };
    const t = this.tile(this.px, this.py), m = this.map;
    if (m.type === 'world') {
      const loc = m.locs.find(l => l.x === this.px && l.y === this.py);
      if (loc) return this.enterLocation(loc);
    }
    if (m.type === 'dungeon') {
      if (t === 'stairsdown') return this.run(() => this.changeFloor(m.floor + 1));
      if (t === 'stairsup') return m.floor === 0 ? this.leaveTo() : this.run(() => this.changeFloor(m.floor - 1, true));
      if (t === 'portal') return this.leaveTo();
    }
    if (STORY.onStep) { const handled = await STORY.onStep(m.id, this.px, this.py, this); if (handled) return; }
    const z = this.zone();
    if (z && ZONES[z] && !S.flags.noEncounters) {
      S.steps++;
      if (--S.encSteps <= 0) { this.resetEnc(); this.run(() => this.randomBattle(z)); }
    }
  }
  async changeFloor(f, up) {
    const did = this.map.dungeon, next = buildDungeonFloor(did, f);
    const spot = up ? next.down : next.up;
    let x = spot.x, y = spot.y;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const tt = next.tiles[(spot.y + dy) * next.w + spot.x + dx];
      if (tt === 'dfloor') { x = spot.x + dx; y = spot.y + dy; break; }
    }
    await this.goto(did + ':' + f, x, y, 'down');
  }
  async enterLocation(loc) {
    if (STORY.canEnter) { const why = STORY.canEnter(loc.id); if (why) { await this.run(() => Ev.say(null, why)); return; } }
    if (loc.id.startsWith('town')) await this.run(() => this.goto(loc.id));
    else await this.run(() => this.goto(loc.id + ':0'));
  }
  async randomBattle(z) {
    const zone = ZONES[z];
    let n = 1 + Math.floor(Math.random() * zone.max);
    if (S.party.length === 1) n = Math.min(n, 2);
    const ids = []; for (let i = 0; i < n; i++) ids.push(pick(zone.pool));
    await Ev.battle(ids, { bg: zone.bg, preemptive: chance(0.08) });
  }
  interact() {
    const [dx, dy] = DIRV[this.dir]; let x = this.px + dx, y = this.py + dy;
    let npc = this.npcAt(x, y);
    if (!npc && this.tile(x, y) === 'counter') npc = this.npcAt(x + dx, y + dy);
    if (npc) {
      npc.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[this.dir];
      return this.run(() => npc.shop ? this.shop(npc.role) : npc.talk(Ev, npc));
    }
    const o = this.objAt(x, y);
    if (o && o.type === 'chest') return this.run(() => this.openChest(o));
    if (o && o.type === 'boss') return this.run(() => STORY.boss(this.map.dungeon, this));
    const t = this.tile(x, y);
    if (t === 'crystal') return this.run(() => this.savePoint());
    if (t === 'sign') return this.run(() => Ev.say(null, `Welcome to ${placeName(this.map.id)}.`));
    if (t === 'well') return this.run(() => Ev.say(null, 'A deep well. You hear water far below.'));
  }
  async openChest(o) {
    if (S.flags[o.key]) { await Ev.say(null, 'The chest is empty.'); return; }
    S.flags[o.key] = true; Sound.play('chest');
    if (o.item.startsWith('gil:')) { const n = +o.item.slice(4); S.gil += n; await Ev.say(null, `Found ${n} gil!`); }
    else { addItem(o.item, 1); await Ev.say(null, `Found ${itemDef(o.item).name}!`); }
  }
  async savePoint() {
    Sound.play('heal');
    const c = await Ev.choice('A crystal hums softly. Its light restores your strength.', ['Save', 'Use a Tent' + (S.inv.tent ? ` (${S.inv.tent})` : ''), 'Leave']);
    if (c === 0) await Scenes.push(new SaveScene());
    if (c === 1) {
      if (!S.inv.tent) { await Ev.say(null, 'You have no Tents.'); return; }
      addItem('tent', -1); await fadeTo(1, 20); fullHeal(); Sound.play('save'); await sleep(40); await fadeTo(0, 20);
      await Ev.say(null, 'The party rested and recovered.');
    }
  }
  async shop(role) {
    const def = TOWNS[this.map.id];
    if (role === 'inn') {
      const price = def.innPrice * S.party.length;
      const c = await Ev.choice(`Welcome to the inn! A night costs ${price} gil. Stay?`, ['Stay', 'No thanks']);
      if (c !== 0) return;
      if (S.gil < price) { Sound.play('error'); await Ev.say(null, "You can't afford it, I'm afraid."); return; }
      S.gil -= price; Music.stop(); await fadeTo(1, 30); fullHeal(); Sound.play('save'); await sleep(90); await fadeTo(0, 30);
      Music.play(this.map.music);
      const s = await Ev.choice('Good morning! Would you like to record your journey?', ['Save', 'No']);
      if (s === 0) await Scenes.push(new SaveScene());
      return;
    }
    const stock = role === 'items' ? def.items : role === 'weapons' ? def.weapons : def.armor;
    const title = { items: 'Item Shop', weapons: 'Weapon Shop', armor: 'Armor Shop' }[role];
    await Scenes.push(new ShopScene(stock, title));
  }
  // Runs an event script with player control locked. A lost battle throws GameOver,
  // which aborts the whole (possibly nested) script.
  async run(fn) {
    const nested = this.lock > 0; this.lock++;
    try { await fn(); } catch (e) { if (!(e instanceof GameOver)) console.error(e); else if (nested) throw e; }
    finally { this.lock = Math.max(0, this.lock - 1); Input.consume(); }
  }

  // ------------------------------------------------------------ draw
  camera() {
    const m = this.map, x = this.px * 16 + this.mx, y = this.py * 16 + this.my;
    let cx = x + 8 - SW / 2, cy = y + 8 - SH / 2;
    cx = m.w * 16 <= SW ? (m.w * 16 - SW) / 2 : clamp(cx, 0, m.w * 16 - SW);
    cy = m.h * 16 <= SH ? (m.h * 16 - SH) / 2 : clamp(cy, 0, m.h * 16 - SH);
    return [Math.round(cx), Math.round(cy)];
  }
  draw() {
    const m = this.map; if (!m) return;
    const [cx, cy] = this.camera(), af = Math.floor(G.frame / 30);
    const theme = m.theme || null;
    ctx.fillStyle = m.type === 'dungeon' ? m.theme.top : '#000'; ctx.fillRect(0, 0, SW, SH);
    const x0 = Math.floor(cx / 16), y0 = Math.floor(cy / 16);
    for (let y = y0; y <= y0 + 15; y++) for (let x = x0; x <= x0 + 20; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      let t = m.tiles[y * m.w + x];
      const o = m.objs && m.objs.find(o => o.x === x && o.y === y && o.type === 'chest');
      if (o) t = S.flags[o.key] ? 'chestopen' : 'chest';
      ctx.drawImage(tileCanvas(t, af, theme), x * 16 - cx, y * 16 - cy);
    }
    // sprites sorted by y
    const sprites = [];
    for (const n of this.npcs) sprites.push({ y: n.y, draw: () => this.drawNpc(n, cx, cy) });
    if (m.objs) for (const o of m.objs) if (o.type === 'boss') sprites.push({ y: o.y, draw: () => this.drawBoss(o, cx, cy) });
    sprites.push({ y: this.py, draw: () => this.drawPlayer(cx, cy) });
    sprites.sort((a, b) => a.y - b.y).forEach(s => s.draw());
    if (m.type === 'town') for (const n of this.npcs) if (n.shop) {
      const label = { inn: 'INN', items: 'ITEMS', weapons: 'WEAPONS', armor: 'ARMOR' }[n.role];
      const lw = textW(label) + 6, lx = n.x * 16 + 8 - cx, ly = (n.y - 1) * 16 + 4 - cy;
      ctx.fillStyle = 'rgba(20,16,40,0.85)'; ctx.fillRect(lx - lw / 2, ly - 2, lw, 12);
      txt(label, lx, ly, '#ffe080', 'center');
    }
    if (m.type === 'world') this.drawMiniHud();
    if (this.banner && this.banner.t > 0 && this.banner.text) {
      ctx.globalAlpha = Math.min(1, this.banner.t / 20);
      const w = textW(this.banner.text) + 24; win(SW / 2 - w / 2, 10, w, 22); txt(this.banner.text, SW / 2, 17, '#fff', 'center');
      ctx.globalAlpha = 1;
    }
  }
  drawPlayer(cx, cy) {
    const look = CAST[S.party[0]].look;
    const f = this.moving ? this.walkF % 4 : 0;
    ctx.drawImage(charSprite(look, this.dir, f), this.px * 16 + this.mx - cx, this.py * 16 + this.my - cy - 2);
  }
  drawNpc(n, cx, cy) {
    const look = n.cast ? CAST[n.cast].look : n.look;
    if (n.kind) { const spr = monSprite(n.kind, n.pal); ctx.drawImage(spr, n.x * 16 - cx, n.y * 16 - cy); return; }
    const f = n.mv ? Math.floor(n.mv / 4) % 4 : 0;
    ctx.drawImage(charSprite(look, n.dir, f), n.x * 16 + n.ox - cx, n.y * 16 + n.oy - cy - 2);
  }
  drawBoss(o, cx, cy) {
    const bl = DUNGEONS[this.map.dungeon].bossLook, bob = Math.sin(G.frame / 15) * 1.5;
    const spr = bl.cast ? charSprite(CAST[bl.cast].look, 'down', 0) : monSprite(bl.kind, bl.pal);
    ctx.drawImage(spr, o.x * 16 - cx - (bl.cast ? 0 : 8), o.y * 16 - cy - (bl.cast ? 2 : 16) + bob, bl.cast ? 16 : 32, bl.cast ? 16 : 32);
  }
  drawMiniHud() {
    const m = this.map, s = 1.5, w = m.w * s, h = m.h * s, x0 = SW - w - 6, y0 = SH - h - 6;
    if (!this.mini) {
      const c = mkCanvas(m.w, m.h), g = c.getContext('2d');
      const col = { water: '#2a5ac8', grass: '#4a9a3a', flowers: '#4a9a3a', forest: '#2a6a2a', mountain: '#8a6a4a', snow: '#e8eef8', snowtree: '#9ab0b0',
        smountain: '#7a8aa0', sand: '#e0c070', dune: '#d0b060', cactus: '#d0b060', dmountain: '#a05a3a', waste: '#3a2a40', wmountain: '#2a1a2a' };
      this.miniCol = col; this.mini = c; this.miniG = g;
    }
    const g = this.miniG;
    for (let i = 0; i < m.tiles.length; i++) { g.fillStyle = this.miniCol[m.tiles[i]] || '#f0f0f0'; g.fillRect(i % m.w, Math.floor(i / m.w), 1, 1); }
    for (const l of m.locs) { g.fillStyle = l.id.startsWith('town') ? '#ffffff' : '#ff4040'; g.fillRect(l.x, l.y, 1, 1); }
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#000'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.drawImage(this.mini, x0, y0, w, h); ctx.globalAlpha = 1;
    if (G.frame % 30 < 20) { ctx.fillStyle = '#ffff00'; ctx.fillRect(x0 + this.px * s - 1, y0 + this.py * s - 1, 3, 3); }
  }
}
const SHOP_LOOKS = {
  inn: { skin: '#f0c090', hair: '#8a5a2a', hairStyle: 'short', outfit: '#c04040', outfit2: '#802020', accent: '#ffffff', pants: '#3a3a3a', eyes: '#202020' },
  items: { skin: '#e0b080', hair: '#303030', hairStyle: 'long', outfit: '#40a060', outfit2: '#206040', accent: '#f0e0a0', pants: '#3a3a3a', eyes: '#202020' },
  weapons: { skin: '#c89060', hair: '#a0a0a0', hairStyle: 'short', outfit: '#606070', outfit2: '#404050', accent: '#c0c0c0', pants: '#2a2a2a', eyes: '#202020' },
  armor: { skin: '#f0c8a0', hair: '#c0a040', hairStyle: 'spiky', outfit: '#4060a0', outfit2: '#203060', accent: '#e0c050', pants: '#2a2a3a', eyes: '#202020' }
};
const VILLAGER_LOOKS = [
  { skin: '#f0c090', hair: '#603010', hairStyle: 'short', outfit: '#a07040', outfit2: '#704020', accent: '#e0c080', pants: '#404040' },
  { skin: '#d0a070', hair: '#e0d050', hairStyle: 'long', outfit: '#e07090', outfit2: '#a04060', accent: '#ffffff', pants: '#504060' },
  { skin: '#a07050', hair: '#202020', hairStyle: 'short', outfit: '#5080c0', outfit2: '#305080', accent: '#e0e0e0', pants: '#303040' },
  { skin: '#f0d0b0', hair: '#c0c0c0', hairStyle: 'hood', outfit: '#807060', outfit2: '#605040', accent: '#c0b090', pants: '#404040' },
  { skin: '#e0b090', hair: '#a03020', hairStyle: 'spiky', outfit: '#60a040', outfit2: '#407020', accent: '#f0e060', pants: '#3a3a2a' }
];

// ------------------------------------------------------------ event API used by the story
const Ev = {
  field: null,
  say(who, text, clip) { return Scenes.push(new DialogScene(who, text, clip)); },
  async talk(lines) { for (const l of lines) await this.say(l[0], l[1], l[2]); },
  choice(prompt, opts) { return Scenes.push(new ChoiceScene(opts, { prompt, cancel: false })); },
  scene(key, caption) { this.endScene(); this._bd = new BackdropScene(key, caption); Scenes.push(this._bd); return sleep(1); },
  endScene() { if (this._bd) { Scenes.pop(this._bd); this._bd = null; } },
  title(a, b) { return Scenes.push(new TitleCardScene(a, b)); },
  has(k) { return !!S.flags[k]; },
  flag(k, v = true) { S.flags[k] = v; },
  wait(f) { return sleep(f); },
  music(n) { Music.play(n); },
  sfx(n) { Sound.play(n); },
  shake(n = 20) { G.shake = n; },
  flash() { G.flash = 12; },
  fadeOut(f = 30) { return fadeTo(1, f); },
  fadeIn(f = 30) { return fadeTo(0, f); },
  heal() { fullHeal(); },
  async join(id) {
    if (S.party.includes(id)) return;
    addMember(id, Math.max(1, partyAvgLevel()));
    Sound.play('levelup');
    await this.say(null, `${N[id]} joined the party!`);
  },
  async give(item, n = 1) { addItem(item, n); Sound.play('chest'); await this.say(null, `Received ${itemDef(item).name}${n > 1 ? ' x' + n : ''}!`); },
  async gil(n) { S.gil += n; Sound.play('buy'); await this.say(null, `Received ${n} gil!`); },
  setChapter(n) { S.chapter = n; },
  async battle(ids, opts = {}) {
    Sound.play('encounter'); G.flash = 10;
    await fadeTo(1, 16);
    const prevMusic = Music.name;
    const b = new BattleScene(ids, opts);
    const p = Scenes.push(b);
    await fadeTo(0, 10);
    const res = await p;
    if (res === 'lose') { await fadeTo(1, 40); Music.stop(); Scenes.replaceAll(new GameOverScene()); await fadeTo(0, 20); throw new GameOver(); }
    await fadeTo(1, 12);
    if (this.field) Music.play(STORY.musicFor && STORY.musicFor(S.pos.map) || this.field.map.music);
    else if (prevMusic) Music.play(prevMusic);
    await fadeTo(0, 12);
    return res;
  },
  async goto(map, x, y, dir) { await this.field.goto(map, x, y, dir); },
  async refresh() { this.field.buildNpcs(); if (this.field.map.type === 'world') this.field.load('world', this.field.px, this.field.py, this.field.dir); }
};

class GameOverScene {
  constructor() { this.opaque = true; this.t = 0; this.i = 0; }
  enter() { Music.play('sad'); }
  update() {
    this.t++; if (this.t < 60) return;
    if (Input.pressed('up') || Input.pressed('down')) { this.i ^= 1; Sound.play('cursor'); }
    if (Input.pressed('a')) { Sound.play('confirm'); if (this.i === 0) Scenes.replaceAll(new LoadScene(true)); else Scenes.replaceAll(new TitleScene()); }
  }
  draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    txt('GAME OVER', SW / 2, 80, '#ff6060', 'center', 16);
    if (this.t >= 60) { ['Load a save', 'Title screen'].forEach((o, i) => txt(o, 130, 140 + i * 16)); cursor(116, 140 + this.i * 16); }
  }
}
