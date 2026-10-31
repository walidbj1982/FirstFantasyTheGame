// Active-time battle system.
'use strict';

const ELEMENTS = ['fire', 'ice', 'bolt', 'water', 'earth', 'holy', 'dark'];

function heroBattler(m) {
  const st = stats(m), c = CAST[m.id];
  return {
    m, id: m.id, name: c.name, isEnemy: false, job: c.job, look: c.look, lv: m.lv,
    get hp() { return m.hp; }, set hp(v) { m.hp = v; }, get mp() { return m.mp; }, set mp(v) { m.mp = v; },
    get burst() { return m.burst; }, set burst(v) { m.burst = v; },
    maxhp: st.maxhp, maxmp: st.maxmp, str: st.str, atk: st.atk, mag: st.mag, def: st.def, mdef: st.mdef, spd: st.spd,
    weaponEl: st.el, ward: st.ward, el: {}, status: m.status, atb: rand(10, 60), ox: 0, oy: 0, flash: 0, pose: null
  };
}

class BattleScene {
  constructor(enemyIds, opts = {}) {
    this.opaque = true; this.opts = opts;
    this.heroes = S.party.map(id => heroBattler(S.members[id]));
    this.enemies = [];
    for (const id of enemyIds) this.addEnemy(id);
    for (const e of [...this.enemies]) if (ENEMIES[e.id].minions) for (const mid of ENEMIES[e.id].minions) this.addEnemy(mid);
    this.layoutEnemies();
    this.ready = []; this.queue = []; this.busy = false; this.state = 'intro'; this.t = 0;
    this.pops = []; this.fx = []; this.banner = null; this.menu = null; this.result = null;
    this.won = { exp: 0, gil: 0, items: [] };
    this.bg = opts.bg || 'grass';
    if (opts.preemptive) for (const h of this.heroes) h.atb = 90;
  }
  addEnemy(id) {
    if (this.enemies.length >= 6) return null;
    const e = makeEnemy(id); e.ox = 0; e.oy = 0; e.flash = 0; e.alpha = 1; e.dead = false;
    this.enemies.push(e); return e;
  }
  layoutEnemies() {
    const list = this.enemies.filter(e => !e.dead || e.alpha > 0);
    const boss = list.find(e => e.boss);
    let slots;
    if (boss) {
      boss.cx = 70; boss.cy = 92;
      const others = list.filter(e => e !== boss);
      slots = [[150, 60], [150, 120], [135, 92], [30, 40], [30, 140]];
      others.forEach((e, i) => { e.cx = slots[i % slots.length][0]; e.cy = slots[i % slots.length][1]; });
    } else {
      const n = list.length;
      slots = n === 1 ? [[90, 92]] : n === 2 ? [[70, 70], [110, 115]] : n === 3 ? [[50, 60], [120, 80], [70, 125]]
        : n === 4 ? [[45, 55], [125, 55], [45, 120], [125, 120]] : [[40, 50], [115, 45], [80, 92], [40, 135], [120, 135], [150, 92]];
      list.forEach((e, i) => { e.cx = slots[i][0]; e.cy = slots[i][1]; });
    }
    this.heroes.forEach((h, i) => { h.cx = 258 + i * 8; h.cy = 46 + i * 30; });
    for (const b of [...list, ...this.heroes]) { b.sx = b.cx; b.sy = b.cy; }
  }
  get aliveHeroes() { return this.heroes.filter(h => h.hp > 0); }
  get aliveEnemies() { return this.enemies.filter(e => !e.dead); }

  enter() {
    Music.play(this.opts.music || (this.opts.boss ? 'boss' : 'battle'));
  }

  // ------------------------------------------------------------ main loop
  update() {
    this.t++;
    for (const p of this.pops) p.t++;
    this.pops = this.pops.filter(p => p.t < 50);
    for (const f of this.fx) f.t++;
    this.fx = this.fx.filter(f => f.t < f.dur);
    for (const e of this.enemies) { if (e.flash > 0) e.flash--; if (e.dead && e.alpha > 0) e.alpha -= 0.04; }
    for (const h of this.heroes) if (h.flash > 0) h.flash--;
    if (this.state === 'intro') {
      if (this.t > 30) { this.state = 'main'; if (this.opts.intro) this.say(this.opts.intro, 90); }
      return;
    }
    if (this.state === 'victory' || this.state === 'defeat' || this.state === 'fled') {
      if (this.state === 'victory' && this.victoryPages) return this.updateVictory();
      if (this.t > 60 && (Input.pressed('a') || this.state !== 'victory')) this.finish();
      return;
    }
    const paused = this.busy || (this.menu && this.menu.sub);
    if (!paused) this.tickAtb();
    if (this.menu) this.updateMenu();
    else if (this.ready.length) this.openMenu(this.ready[0]);
    if (!this.busy && this.queue.length) this.runNext();
  }
  speedMul() { return [0.55, 0.8, 1.05, 1.4, 1.8][S.config.battleSpeed] || 1; }
  tickAtb() {
    const k = 0.0145 * this.speedMul();
    for (const b of [...this.aliveHeroes, ...this.aliveEnemies]) {
      if (b.atb >= 100) continue;
      const st = b.status; let rate = (b.spd + 20) * k;
      if (st.haste) rate *= 1.5; if (st.slow) rate *= 0.5;
      b.atb = Math.min(100, b.atb + rate);
      if (b.atb >= 100) {
        if (st.sleep) { b.atb = 0; this.tickStatus(b, true); continue; }
        if (b.isEnemy) this.queue.push(this.enemyAI(b));
        else if (!this.ready.includes(b)) this.ready.push(b);
      }
    }
    if (this.t % 60 === 0) for (const b of [...this.aliveHeroes, ...this.aliveEnemies]) if (b.status.regen) {
      const amt = Math.max(1, Math.floor(b.maxhp * 0.04)); b.hp = Math.min(b.maxhp, b.hp + amt); this.pop(b, amt, '#80ff80');
    }
  }

  // ------------------------------------------------------------ player command menu
  openMenu(h) {
    if (h.hp <= 0 || h.status.sleep) { this.ready.shift(); return; }
    const job = JOBS[h.job];
    const cmds = [
      h.burst >= 100 ? { id: 'burst', label: 'BURST!', color: '#ffe040' } : { id: 'attack', label: 'Attack' },
      { id: 'skill', label: job.menu }, { id: 'item', label: 'Item' }, { id: 'defend', label: 'Defend' }
    ];
    if (!this.opts.noRun) cmds.push({ id: 'run', label: 'Run' });
    this.menu = { h, cmds, i: 0, sub: null };
    Sound.play('cursor');
  }
  updateMenu() {
    const M = this.menu, h = M.h;
    if (h.hp <= 0 || h.status.sleep) { this.ready = this.ready.filter(x => x !== h); this.menu = null; return; }
    if (M.sub === 'skill' || M.sub === 'item') {
      M.list.update();
      if (Input.pressed('a')) {
        const it = M.list.cur; if (!it) return;
        if (it.disabled) { Sound.play('error'); return; }
        Sound.play('confirm');
        M.pending = it.act; this.beginTarget(it.target);
      } else if (Input.pressed('b')) { Sound.play('cancel'); M.sub = null; }
      return;
    }
    if (M.sub === 'target') return this.updateTarget();
    // root
    if (Input.pressed('up')) { M.i = (M.i + M.cmds.length - 1) % M.cmds.length; Sound.play('cursor'); }
    if (Input.pressed('down')) { M.i = (M.i + 1) % M.cmds.length; Sound.play('cursor'); }
    if (Input.pressed('right') || Input.pressed('left')) { // cycle between ready heroes
      if (this.ready.length > 1) { this.ready.push(this.ready.shift()); this.menu = null; Sound.play('cursor'); return; }
    }
    if (Input.pressed('a')) {
      const c = M.cmds[M.i].id; Sound.play('confirm');
      if (c === 'attack') { M.pending = { skill: 'attack' }; this.beginTarget('enemy'); }
      else if (c === 'burst') { M.pending = { burst: true }; this.beginTarget(JOBS[h.job].burst === 'single' ? 'enemy' : 'enemies'); }
      else if (c === 'defend') this.commit({ defend: true }, []);
      else if (c === 'run') this.commit({ run: true }, []);
      else if (c === 'skill') {
        const items = knownSkills(h.m).map(id => {
          const s = SKILLS[id];
          const silenced = h.status.silence && (s.kind === 'magic' || s.kind === 'heal' || s.kind === 'revive');
          return { label: s.name, right: s.mp, act: { skill: id }, target: s.target, disabled: h.mp < s.mp || silenced };
        });
        if (!items.length) { Sound.play('error'); return; }
        M.list = new ListBox(0, 168, 176, 4, items); M.sub = 'skill';
      } else if (c === 'item') {
        const items = Object.keys(S.inv).filter(id => ITEMS[id] && !ITEMS[id].field && S.inv[id] > 0).map(id => {
          const u = ITEMS[id].use;
          const target = u.dmg ? (u.all ? 'enemies' : 'enemy') : u.revive ? 'ko' : u.all ? 'allies' : 'ally';
          return { label: ITEMS[id].name, right: S.inv[id], act: { item: id }, target };
        });
        if (!items.length) { Sound.play('error'); return; }
        M.list = new ListBox(0, 168, 176, 4, items); M.sub = 'item';
      }
    }
  }
  beginTarget(type) {
    const M = this.menu, h = M.h;
    M.ttype = type; M.prevSub = M.sub; M.sub = 'target';
    if (type === 'enemy') { M.pool = this.aliveEnemies; M.ti = 0; }
    else if (type === 'ally') { M.pool = this.heroes.filter(x => x.hp > 0); M.ti = Math.max(0, M.pool.indexOf(h)); }
    else if (type === 'ko') {
      M.pool = this.heroes.filter(x => x.hp <= 0);
      if (!M.pool.length) { Sound.play('error'); M.sub = M.prevSub; return; }
      M.ti = 0;
    } else M.pool = null; // group / self: just confirm
  }
  updateTarget() {
    const M = this.menu;
    if (M.pool) {
      M.pool = M.pool.filter(x => M.ttype === 'ko' ? x.hp <= 0 : (x.isEnemy ? !x.dead : x.hp > 0));
      if (!M.pool.length) { M.sub = M.prevSub; return; }
      M.ti = clamp(M.ti, 0, M.pool.length - 1);
      const n = M.pool.length;
      if (Input.pressed('up') || Input.pressed('left')) { M.ti = (M.ti + n - 1) % n; Sound.play('cursor'); }
      if (Input.pressed('down') || Input.pressed('right')) { M.ti = (M.ti + 1) % n; Sound.play('cursor'); }
    }
    if (Input.pressed('a')) {
      Sound.play('confirm');
      const t = M.ttype, h = M.h;
      const targets = M.pool ? [M.pool[M.ti]] : t === 'self' ? [h] : t === 'allies' ? this.heroes.filter(x => x.hp > 0) : this.aliveEnemies;
      this.commit(M.pending, targets);
    } else if (Input.pressed('b')) { Sound.play('cancel'); M.sub = M.prevSub; }
  }
  commit(act, targets) {
    const h = this.menu.h;
    this.queue.push({ actor: h, ...act, targets });
    this.ready = this.ready.filter(x => x !== h);
    h.atb = -1000; // waiting for the action to run
    this.menu = null;
  }

  // ------------------------------------------------------------ enemy AI
  enemyAI(e) {
    e.atb = -1000;
    let skills = e.skills;
    for (const ph of e.phases) if (e.hp / e.maxhp < ph.below) skills = ph.skills;
    if (!e.phaseAnnounced && skills !== e.skills && e.boss) { e.phaseAnnounced = true; }
    let total = skills.reduce((a, s) => a + s[1], 0), r = Math.random() * total, id = skills[0][0];
    for (const [sid, w] of skills) { if ((r -= w) < 0) { id = sid; break; } }
    const s = SKILLS[id];
    if (s.kind === 'summon' && this.aliveEnemies.length >= 4) id = 'attack';
    if (s.kind === 'buff' && s.st && e.status[s.st[0]]) id = 'attack';
    if (s.kind === 'heal' && e.hp > e.maxhp * 0.6) id = 'attack';
    if (e.status.silence && SKILLS[id].kind === 'magic') id = 'attack';
    const sk = SKILLS[id];
    const foes = this.aliveHeroes;
    let targets;
    if (sk.target === 'enemy') targets = [pick(foes)];
    else if (sk.target === 'enemies') targets = foes;
    else targets = [e];
    return { actor: e, skill: id, targets };
  }

  // ------------------------------------------------------------ action execution
  async runNext() {
    const act = this.queue.shift();
    const a = act.actor;
    if ((a.isEnemy && a.dead) || (!a.isEnemy && a.hp <= 0) || this.state !== 'main') return;
    if (a.status.sleep) { a.atb = 0; return; }
    if (!this.aliveHeroes.length || !this.aliveEnemies.length) return;
    this.busy = true; this.acting = a;
    try { await this.perform(act); } catch (err) { console.error(err); }
    this.acting = null; this.bursting = false;
    a.atb = 0;
    if (!a.isEnemy) a.burst = Math.min(100, a.burst + 3);
    this.tickStatus(a);
    this.busy = false;
    this.checkEnd();
  }
  retarget(act) {
    const a = act.actor;
    const side = t => t.isEnemy ? this.aliveEnemies : this.aliveHeroes;
    return act.targets.map(t => {
      if (!t) return null;
      if (act.skill && SKILLS[act.skill].target === 'ko') return t.hp <= 0 ? t : null;
      if (act.item && ITEMS[act.item].use.revive) return t.hp <= 0 ? t : null;
      if (t.isEnemy ? !t.dead : t.hp > 0) return t;
      const alt = side(t); return alt.length ? pick(alt) : null;
    }).filter((t, i, arr) => t && arr.indexOf(t) === i);
  }
  async perform(act) {
    const a = act.actor;
    if (act.defend) { a.status.defend = 1; this.say(a.name + ' defends.', 40); await sleep(30); return; }
    if (act.run) {
      const ps = avg(this.aliveHeroes.map(h => h.spd)), es = avg(this.aliveEnemies.map(e => e.spd));
      if (Math.random() < clamp(0.55 + (ps - es) * 0.03, 0.2, 0.95)) {
        this.say('Escaped!', 50); Sound.play('stairs');
        for (let i = 0; i < 20; i++) { for (const h of this.heroes) h.ox += 2; await sleep(1); }
        this.state = 'fled'; this.t = 0; return;
      }
      this.say("Couldn't escape!", 50); Sound.play('error'); await sleep(40); return;
    }
    if (act.burst) return this.performBurst(act);
    if (act.item) return this.performItem(act);
    const s = SKILLS[act.skill];
    if (!a.isEnemy && s.mp) {
      if (a.mp < s.mp) { this.say('Not enough MP!', 40); await sleep(30); return; }
      a.mp -= s.mp;
    }
    let targets = this.retarget(act);
    if (!targets.length) return;
    if (act.skill !== 'attack') this.say(s.name, 50);
    await this.approach(a, s.kind === 'phys' || s.kind === 'steal' ? 'attack' : 'cast');
    if (!a.isEnemy && act.skill === 'attack' && chance(0.35)) Sound.clip((CAST[a.id].clips || {}).attack);
    if (s.kind === 'summon') {
      const ids = ENEMIES[a.id].summons || [];
      for (const id of ids) { const e = this.addEnemy(id); if (e) e.atb = 0; }
      this.layoutEnemies(); Sound.play('dark'); await sleep(30);
    } else {
      this.effect(s.fx, targets, a);
      await sleep(18);
      const hits = s.hits || 1;
      for (let k = 0; k < hits; k++) {
        for (const t of targets) {
          if (t.isEnemy ? t.dead : (t.hp <= 0 && s.kind !== 'revive')) continue;
          this.applySkill(a, t, act.skill, s);
        }
        if (hits > 1) { await sleep(12); if (k < hits - 1) this.effect(s.fx, targets.filter(t => t.isEnemy ? !t.dead : t.hp > 0), a); }
      }
      await sleep(22);
    }
    await this.retreat(a);
    await this.reapDead();
  }
  applySkill(a, t, id, s) {
    switch (s.kind) {
      case 'phys': case 'magic': case 'drain': {
        const r = calcDamage(a, t, s, this);
        if (r.miss) { this.pop(t, 'Miss', '#c0c0ff'); Sound.play('miss'); break; }
        this.damage(t, r.dmg, r.crit);
        if (s.kind === 'drain' && r.dmg > 0) { a.hp = Math.min(a.maxhp, a.hp + r.dmg); this.pop(a, r.dmg, '#80ff80'); }
        if (s.st && r.dmg >= 0 && t.hp > 0) this.tryStatus(t, s.st[0], s.st[1]);
        if (s.steal && t.isEnemy) this.trySteal(a, t);
        break;
      }
      case 'heal': {
        const amt = Math.round(s.pow * (a.mag + a.lv) / 4 * rand(0.95, 1.05));
        if (!t.isEnemy && t.hp > 0) { t.hp = Math.min(t.maxhp, t.hp + amt); this.pop(t, amt, '#80ff80'); }
        else if (t.isEnemy) { t.hp = Math.min(t.maxhp, t.hp + amt); this.pop(t, amt, '#80ff80'); }
        break;
      }
      case 'revive': if (t.hp <= 0) { t.hp = Math.max(1, Math.floor(t.maxhp * s.pow)); t.atb = 0; t.status = t.m.status = {}; this.pop(t, 'Revived', '#80ff80'); } break;
      case 'cure': for (const k in t.status) if (STATUS[k] && STATUS[k].bad) delete t.status[k]; this.pop(t, 'Cured', '#80ff80'); break;
      case 'buff': t.status[s.st[0]] = STATUS[s.st[0]].turns; this.pop(t, STATUS[s.st[0]].name, STATUS[s.st[0]].col); Sound.play('buff'); break;
      case 'debuff': this.tryStatus(t, s.st[0], s.st[1], true); break;
      case 'steal': this.trySteal(a, t); break;
    }
  }
  tryStatus(t, st, p, verbose) {
    if (t.boss && (st === 'death' || st === 'sleep' || st === 'silence')) { if (verbose) { this.pop(t, 'Immune', '#c0c0c0'); } return; }
    if (t.boss) p *= 0.4;
    if (t.ward && t.ward.includes(st)) { if (verbose) this.pop(t, 'Warded', '#c0c0c0'); return; }
    if (!chance(p)) { if (verbose) { this.pop(t, 'Miss', '#c0c0ff'); Sound.play('miss'); } return; }
    if (st === 'death') { this.damage(t, t.hp, true); return; }
    t.status[st] = STATUS[st].turns; this.pop(t, STATUS[st].name, STATUS[st].col); Sound.play('debuff');
  }
  trySteal(a, t) {
    if (!t.steal) { this.say('Nothing to steal.', 40); return; }
    const p = clamp(0.4 + (a.lv - t.lv) * 0.03 + (a.spd - t.spd) * 0.01, 0.15, 0.9) * (t.boss ? 0.6 : 1);
    if (chance(p)) { addItem(t.steal, 1); this.say('Stole ' + itemDef(t.steal).name + '!', 60); Sound.play('steal'); t.steal = null; }
    else this.say("Couldn't steal.", 40);
  }
  damage(t, dmg, crit) {
    if (dmg < 0) { t.hp = Math.min(t.maxhp, t.hp - dmg); this.pop(t, -dmg, '#80ff80'); return; }
    t.hp = Math.max(0, t.hp - dmg);
    t.flash = 10; this.pop(t, dmg, crit ? '#ffe040' : '#fff', crit);
    if (t.isEnemy && t.fleeAt && t.hp > 0 && t.hp < t.maxhp * t.fleeAt) { t.hp = 0; t.fled = true; this.say(t.name + ' ran away!', 90); }
    Sound.play(crit ? 'crit' : 'hit'); if (crit) G.shake = 8;
    if (t.status.sleep) delete t.status.sleep;
    if (!t.isEnemy) {
      t.burst = Math.min(100, t.burst + dmg / t.maxhp * 150);
      if (t.hp <= 0) { t.status = t.m.status = {}; t.atb = 0; this.ready = this.ready.filter(x => x !== t); Sound.play('die'); Sound.clip((CAST[t.id].clips || {}).ko); }
      else if (dmg > t.maxhp * 0.3 && chance(0.5)) Sound.clip((CAST[t.id].clips || {}).hurt);
    }
  }
  async reapDead() {
    let any = false;
    for (const e of this.enemies) if (!e.dead && e.hp <= 0) {
      e.dead = true; any = true; Sound.play(e.fled ? 'stairs' : 'enemydie');
      this.won.exp += e.exp; this.won.gil += e.gil;
      if (e.drop && chance(e.drop[1])) this.won.items.push(e.drop[0]);
    }
    if (any) await sleep(25);
  }
  tickStatus(b, skipped) {
    if (b.status.defend && !skipped) delete b.status.defend;
    for (const k of Object.keys(b.status)) {
      if (k === 'defend') continue;
      if (k === 'poison' && b.hp > 0) { const d = Math.max(1, Math.floor(b.maxhp * (b.boss ? 0.02 : 0.06))); b.hp = Math.max(b.isEnemy ? 0 : 1, b.hp - d); this.pop(b, d, '#c080ff'); }
      if (--b.status[k] <= 0) delete b.status[k];
    }
    if (b.isEnemy && b.hp <= 0) this.reapDead().then(() => this.checkEnd());
  }
  async performItem(act) {
    const a = act.actor, d = ITEMS[act.item], u = d.use;
    if (!S.inv[act.item]) { this.say('None left!', 40); await sleep(30); return; }
    addItem(act.item, -1);
    let targets = this.retarget(act);
    this.say(d.name, 50);
    await this.approach(a, 'cast');
    if (!targets.length) { await this.retreat(a); return; }
    if (u.dmg) {
      this.effect(u.fx || 'fire', targets, a); await sleep(20);
      for (const t of targets) { const m = elemMul(t, u.el); this.damage(t, Math.round(u.dmg * m * rand(0.95, 1.05)), false); }
    } else {
      this.effect('heal', targets, a); await sleep(16);
      for (const t of targets) {
        if (u.revive) { if (t.hp <= 0) { t.hp = Math.max(1, Math.floor(t.maxhp * u.revive)); t.atb = 0; this.pop(t, 'Revived', '#80ff80'); } continue; }
        if (t.hp <= 0) continue;
        if (u.hp) { const v = Math.min(u.hp, t.maxhp - t.hp); t.hp += v; this.pop(t, v, '#80ff80'); }
        if (u.mp) { const v = Math.min(u.mp, t.maxmp - t.mp); t.mp += v; this.pop(t, v + ' MP', '#80c0ff', false, 10); }
        if (u.cure) { for (const c of u.cure) delete t.status[c]; this.pop(t, 'Cured', '#80ff80'); }
      }
    }
    await sleep(20);
    await this.retreat(a);
    await this.reapDead();
  }
  async performBurst(act) {
    const a = act.actor, c = CAST[a.id];
    a.burst = 0; this.bursting = true;
    this.say(c.burstName || 'Burst', 80);
    Sound.clip((c.clips || {}).burst); Sound.play('burst'); G.flash = 12;
    await this.approach(a, 'cast'); await sleep(20);
    const bt = JOBS[a.job].burst;
    if (bt === 'heal') {
      this.effect('holy', this.heroes, a); await sleep(20);
      for (const t of this.heroes) {
        if (t.hp <= 0) { t.hp = Math.floor(t.maxhp * 0.5); t.atb = 0; this.pop(t, 'Revived', '#80ff80'); continue; }
        const v = t.maxhp - t.hp; t.hp = t.maxhp; this.pop(t, v, '#80ff80');
        for (const k in t.status) if (STATUS[k] && STATUS[k].bad) delete t.status[k];
        t.status.regen = STATUS.regen.turns;
      }
    } else if (bt === 'single') {
      const t = this.retarget(act)[0] || pick(this.aliveEnemies);
      if (t) { this.effect('holy', [t], a); await sleep(14); const r = calcDamage(a, t, { kind: 'phys', pow: 4.2, el: 'holy' }, this, true); this.damage(t, r.dmg, true); G.shake = 14; }
    } else if (bt === 'all') {
      this.effect('flare', this.aliveEnemies, a); await sleep(20);
      for (const t of this.aliveEnemies) { const r = calcDamage(a, t, { kind: 'magic', pow: 26 + a.lv * 1.4 }, this, true); this.damage(t, r.dmg, false); }
      G.shake = 14;
    } else {
      for (let i = 0; i < 7; i++) {
        const alive = this.aliveEnemies.filter(e => e.hp > 0); if (!alive.length) break;
        const t = pick(alive); this.effect('slash', [t], a); await sleep(7);
        const r = calcDamage(a, t, { kind: 'phys', pow: 1.0 }, this, true); this.damage(t, r.dmg, false);
      }
    }
    await sleep(30);
    await this.retreat(a);
    await this.reapDead();
  }
  async approach(a, pose) {
    if (a.isEnemy) { a.flash = 0; for (let i = 0; i < 2; i++) { a.flash = 4; await sleep(8); } return; }
    a.pose = pose;
    for (let i = 0; i < 6; i++) { a.ox -= 3; await sleep(1); }
  }
  async retreat(a) {
    if (a.isEnemy) return;
    for (let i = 0; i < 6; i++) { a.ox += 3; await sleep(1); }
    a.ox = 0; a.pose = null;
  }
  checkEnd() {
    if (this.state !== 'main') return;
    if (!this.aliveEnemies.length) this.victory();
    else if (!this.aliveHeroes.length) { this.state = 'defeat'; this.t = 0; Music.stop(); Sound.play('die'); }
  }
  victory() {
    this.state = 'victory'; this.t = 0; this.menu = null; this.ready = [];
    Music.play('victory');
    const alive = this.aliveHeroes;
    const pages = [];
    const lead = pick(alive); if (lead) Sound.clip((CAST[lead.id].clips || {}).victory);
    S.gil += this.won.gil;
    for (const it of this.won.items) addItem(it, 1);
    pages.push(['Victory!', `EXP ${this.won.exp}`, `Gil ${this.won.gil}`, ...this.won.items.map(i => 'Found ' + itemDef(i).name)]);
    for (const h of alive) {
      const r = gainExp(h.m, this.won.exp);
      if (r.levels) {
        const lines = [`${h.name} is now Lv ${h.m.lv}!`];
        for (const s of r.learned) lines.push('Learned ' + SKILLS[s].name + '!');
        pages.push(lines);
      }
    }
    for (const h of this.heroes) { for (const k in h.status) delete h.status[k]; }
    this.victoryPages = pages; this.vp = 0; this.vt = 0;
    S.battles++;
  }
  updateVictory() {
    this.vt++;
    if (this.vt === 1 && this.vp > 0) Sound.play('levelup');
    if (this.vt > 20 && (Input.pressed('a') || Input.pressed('b'))) {
      this.vp++; this.vt = 0;
      if (this.vp >= this.victoryPages.length) this.finish();
    }
  }
  finish() {
    if (this.result) return;
    for (const h of this.heroes) { for (const k in h.status) delete h.status[k]; if (h.hp > 0) h.hp = Math.max(1, h.hp); }
    this.result = this.state === 'victory' ? 'win' : this.state === 'fled' ? 'fled' : 'lose';
    Scenes.pop(this, this.result);
  }

  // ------------------------------------------------------------ feedback helpers
  say(text, frames = 60) { this.banner = { text, until: this.t + frames }; }
  pop(b, v, col = '#fff', big = false, dy = 0) { this.pops.push({ x: b.cx + b.ox + rand(-4, 4), y: b.cy - 6 + dy, v: String(v), col, t: 0, big }); }
  effect(type, targets, from) {
    for (const t of targets) this.fx.push({ type, x: t.cx, y: t.cy, t: 0, dur: 30, size: t.isEnemy ? (t.size * 8) : 16 });
    const snd = { slash: 'slash', bigslash: 'slash', hit: 'hit', beam: 'slash', fire: 'fire', ice: 'ice', bolt: 'bolt', holy: 'holy', dark: 'dark',
      heal: 'heal', buff: 'buff', debuff: 'debuff', flare: 'burst', quake: 'quake', steal: 'steal' }[type];
    if (snd && snd !== 'hit') Sound.play(snd);
    if (type === 'quake') G.shake = 20;
    if (type === 'flare' || type === 'bolt') G.flash = 6;
  }

  // ------------------------------------------------------------ drawing
  draw() {
    if (R3.ok) { (this.view || (this.view = new BattleView(this))).draw(); this.drawOverlay(); return; }
    drawBattleBg(this.bg, this.opts.scene, this.t);
    const intro = Math.min(1, this.t / 30);
    // enemies
    for (const e of this.enemies) {
      if (e.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, e.alpha);
      const x = e.cx - (1 - intro) * 200;
      if (e.dead) { ctx.filter = 'brightness(2) saturate(0)'; }
      if (e.flash > 0 && e.flash % 4 < 2) ctx.filter = 'brightness(3)';
      if (e.kind === 'human') {
        const look = CAST[e.cast].look, sc = e.size, spr = charSprite(look, 'right', 0, e.flash ? 'attack' : 'walk');
        ctx.drawImage(spr, x - 8 * sc, e.cy - 8 * sc, 16 * sc, 16 * sc);
      } else {
        const sc = e.size, spr = monSprite(e.kind, e.pal);
        const bob = e.dead ? 0 : Math.sin((this.t + e.cx) / 12) * (e.kind === 'bat' || e.kind === 'wraith' || e.kind === 'eye' ? 2 : 0.5);
        ctx.drawImage(spr, x - 8 * sc, e.cy - 8 * sc + bob, 16 * sc, 16 * sc);
      }
      ctx.restore();
      if (e.status.sleep && !e.dead) txt('z', e.cx + e.size * 6, e.cy - e.size * 8 - (this.t / 4 % 8), '#a0a0ff');
    }
    // heroes
    for (const h of this.heroes) {
      const x = h.cx + h.ox + (1 - intro) * 100, y = h.cy;
      ctx.save();
      if (h.flash > 0 && h.flash % 4 < 2) ctx.filter = 'brightness(3)';
      if (h.hp <= 0) {
        ctx.filter = 'grayscale(1) brightness(0.7)';
        ctx.translate(x, y + 8); ctx.rotate(-Math.PI / 2);
        ctx.drawImage(charSprite(h.look, 'left', 0, 'hurt'), -16, -16, 32, 32);
      } else {
        const ready = this.menu && this.menu.h === h;
        const pose = h.pose || (h.hp < h.maxhp * 0.25 || h.status.sleep ? 'hurt' : 'walk');
        const fr = ready ? Math.floor(this.t / 8) % 4 : 0;
        const spr = charSprite(h.look, 'left', fr, pose);
        ctx.drawImage(spr, x - 16, y - 16, 32, 32);
        if (h.status.protect) { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#ffe040'; ctx.strokeRect(x - 15, y - 16, 30, 32); }
      }
      ctx.restore();
      if (h.status.sleep && h.hp > 0) txt('z', x + 10, y - 20 - (this.t / 4 % 8), '#a0a0ff');
      if (h.status.poison && h.hp > 0) { ctx.fillStyle = '#c060ff'; ctx.fillRect(x - 14, y - 18, 3, 3); }
    }
    this.drawOverlay();
  }
  drawOverlay() {
    for (const f of this.fx) drawFx(f);
    for (const p of this.pops) {
      const k = p.t < 10 ? -Math.sin(p.t / 10 * Math.PI) * 10 : 0;
      ctx.globalAlpha = p.t > 40 ? (50 - p.t) / 10 : 1;
      txt(p.v, p.x, p.y + k - 4, p.col, 'center', p.big ? 18 : 12);
      ctx.globalAlpha = 1;
    }
    if (this.banner && this.t < this.banner.until) { const w = textW(this.banner.text) + 24; win(SW / 2 - w / 2, 4, w, 20); txt(this.banner.text, SW / 2, 10, '#fff', 'center'); }
    this.drawPanel();
    if (this.menu) this.drawMenu();
    if (this.state === 'victory' && this.victoryPages && this.vp < this.victoryPages.length) {
      const lines = this.victoryPages[this.vp];
      win(50, 4, 220, lines.length * 13 + 12);
      lines.forEach((l, i) => txt(l, SW / 2, 10 + i * 13, i === 0 ? '#ffe080' : '#fff', 'center'));
    }
    if (this.state === 'defeat') { win(60, 80, 200, 30); txt('The party has fallen...', SW / 2, 91, '#ff8080', 'center'); }
  }
  drawPanel() {
    const y = 164;
    win(0, y, 112, 76);
    const names = {};
    for (const e of this.aliveEnemies) names[e.name] = (names[e.name] || 0) + 1;
    Object.entries(names).slice(0, 5).forEach(([n, c], i) => { const max = c > 1 ? 9 : 12; txt((n.length > max ? n.slice(0, max - 1).trimEnd() + '.' : n) + (c > 1 ? ' x' + c : ''), 8, y + 8 + i * 13, '#fff', 'left'); });
    win(112, y, 208, 76);
    this.heroes.forEach((h, i) => {
      const yy = y + 7 + i * 17;
      const active = this.menu && this.menu.h === h;
      drawPortrait(h.id, 118, yy - 1, 12);
      txt(h.name.slice(0, 6), 134, yy + 1, h.hp <= 0 ? '#ff6060' : active ? '#ffe080' : h.hp < h.maxhp / 4 ? '#ffd040' : '#fff');
      txt(String(h.hp), 222, yy + 1, h.hp <= 0 ? '#ff6060' : '#fff', 'right');
      txt(String(h.mp), 252, yy + 1, '#a0c0ff', 'right');
      bar(258, yy + 1, 56, 5, h.hp <= 0 ? 0 : h.atb / 100, h.atb >= 100 ? '#ffe040' : '#e0e0e0');
      bar(258, yy + 8, 56, 2, h.burst / 100, h.burst >= 100 ? (G.frame % 20 < 10 ? '#ff4040' : '#ffe040') : '#ff8040');
    });
  }
  drawMenu() {
    const M = this.menu;
    win(0, 164, 112, 76);
    M.cmds.forEach((c, i) => txt(c.label, 20, 170 + i * 13, c.color || '#fff'));
    if (!M.sub) cursor(6, 170 + M.i * 13);
    if (M.sub === 'skill' || M.sub === 'item' || (M.sub === 'target' && (M.prevSub === 'skill' || M.prevSub === 'item'))) {
      M.list.draw(M.sub !== 'target');
      const cur = M.list.cur;
      if (cur && M.sub !== 'target') {
        const d = cur.act.skill ? SKILLS[cur.act.skill] : ITEMS[cur.act.item];
        const desc = d.desc || (cur.act.skill ? skillDesc(d) : '');
        if (desc) { win(0, 0, SW, 22); txt(desc, 8, 7); }
      }
    }
    if (M.sub === 'target') {
      const list = M.pool ? [M.pool[M.ti]] : M.ttype === 'self' ? [M.h] : M.ttype === 'allies' ? this.aliveHeroes : this.aliveEnemies;
      for (const t of list) {
        if (!t) continue;
        cursor(t.cx + (t.isEnemy ? -t.size * 8 - 10 : -26), t.cy - 4);
        if (t.isEnemy && list.length === 1) { const w = textW(t.name) + 16; win(SW / 2 - w / 2, 4, w, 20); txt(t.name, SW / 2, 10, '#fff', 'center'); }
      }
    }
  }
}

function skillDesc(d) {
  const who = { enemy: 'one foe', enemies: 'all foes', ally: 'one ally', allies: 'the party', self: 'self', ko: 'a fallen ally' }[d.target];
  const what = d.kind === 'magic' ? (d.el ? d.el[0].toUpperCase() + d.el.slice(1) + ' magic' : 'Pure magic') : d.kind === 'heal' ? 'Restores HP' : d.kind === 'phys' ? 'Physical attack' : d.kind;
  return `${what} on ${who}.`;
}
function avg(a) { return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); }
function elemMul(t, el) {
  if (!el) return 1;
  const m = t.el && t.el[el];
  return m === undefined ? 1 : m;
}
function calcDamage(a, t, s, battle, noMiss) {
  let dmg, crit = false;
  const el = s.el || (s === SKILLS.attack ? a.weaponEl : null);
  if (s.kind === 'phys') {
    const hitP = (a.status.blind ? 0.5 : 0.96) - (t.isEnemy ? 0 : 0.02);
    if (!noMiss && !chance(hitP)) return { miss: true };
    const atk = a.isEnemy ? a.str : a.str + a.atk;
    dmg = atk * (a.isEnemy ? 1.1 + a.lv * 0.055 : 1.2 + a.lv * 0.08) * (s.pow || 1) * 60 / (60 + t.def);
    if (a.status.brave) dmg *= 1.5;
    if (t.status.protect) dmg *= 0.5;
    if (chance(a.job === 'brawler' ? 0.12 : 0.06)) { crit = true; dmg *= 1.8; }
  } else {
    dmg = (s.pow || 10) * (a.mag + a.lv) / 6 * 60 / (60 + t.mdef);
    if (t.status.shell) dmg *= 0.5;
  }
  if (t.status.defend) dmg *= 0.5;
  const m = elemMul(t, el);
  dmg = Math.round(dmg * m * rand(0.92, 1.08));
  if (m > 0 && dmg < 1) dmg = 1;
  if (m < 0) return { dmg, crit: false };          // absorbed: negative = healing
  return { dmg: Math.min(9999, dmg), crit };
}

// ------------------------------------------------------------ backgrounds & effects
// ------------------------------------------------------------ 3D battle view
class BattleView {
  constructor(b) {
    this.b = b; this.scene = buildStage(b.bg, b.enemies.length);
    const still = b.opts.scene && Img.get(CONFIG.scenes[b.opts.scene]);
    if (still) { const tex = new THREE.Texture(still); tex.encoding = THREE.sRGBEncoding; tex.needsUpdate = true; this.scene.background = tex; this.scene.children[0].visible = false; this.scene.fog = null; }
    this.cam = stageCamera(); this.ang = 3.2; this.rad = 6; this.hgt = 6; this.look = new THREE.Vector3(-0.5, 0.9, 0);
    this.cam.setViewOffset(SW, SH, 0, 40, SW, SH); // centre the action above the command panel
  }
  model(x) {
    if (x.model) return x.model;
    let m;
    if (!x.isEnemy) m = buildCharacter(x.look, x.id, x.job);
    else if (x.kind === 'human') { m = buildCharacter(CAST[x.cast].look, x.cast, null); m.scale.setScalar(x.size / 2); }
    else { m = buildMonster(x.kind, x.pal); m.scale.setScalar(x.size / 2); }
    if (x.aura) { const a = add(m, ico(1.0, 1), '#5010a0', 0, 1.1, 0, { emissive: 0x401080, opacity: 0.22 }); a.userData.aura = true; m.userData.auraMesh = a; }
    m.userData.base = m.scale.x;
    this.scene.add(m); return (x.model = m);
  }
  draw() {
    const b = this.b, t = b.t;
    b.heroes.forEach((h, i) => {
      const m = this.model(h);
      const n = b.heroes.length;
      m.position.set(-1.6 * (n - 1) / 2 + i * 1.6 + 0.6, 0, 3.0 + i * 0.25 + h.ox * 0.08);
      m.rotation.y = Math.PI;
      let pose = h.hp <= 0 ? 'ko' : b.state === 'victory' ? 'victory' : h.pose || (h.flash > 0 ? 'hurt' : (h.hp < h.maxhp / 4 || h.status.sleep) ? 'kneel' : 'idle');
      poseCharacter(m, pose, pose === 'attack' ? (t % 30) : t + i * 13);
      if (h.hp <= 0) m.position.y = 0.25;
      this.anchor(h, m, 1.1);
    });
    for (const e of b.enemies) {
      const m = this.model(e);
      if (e.alpha <= 0) { m.visible = false; continue; }
      const x3 = (e.sy - 92) / 19, z3 = -1.6 - (160 - e.sx) / 34;
      m.position.set(x3, 0, z3 + (e.flash > 0 ? 0.3 : 0)); m.rotation.y = 0;
      m.visible = !(e.flash > 0 && e.flash % 4 < 2);
      if (e.dead) { const a = Math.max(0, e.alpha); m.scale.set(m.userData.base * (1 + (1 - a) * 0.3), m.userData.base * a, m.userData.base * (1 + (1 - a) * 0.3)); }
      if (m.userData.auraMesh) m.userData.auraMesh.scale.setScalar(1 + Math.sin(t * 0.08) * 0.08);
      if (e.kind === 'human') poseCharacter(m, e.flash > 0 ? 'attack' : 'idle', e.flash > 0 ? 15 : t);
      else animateMonster(m, t, e.flash > 0);
      this.anchor(e, m, m.userData.h * 0.5);
    }
    // camera: spin-in at the start, nudges toward whoever acts, swings round for the victory pose
    let ang = 0.5, rad = 11.2, hgt = 3.6, look = [0, 1.15, -0.8];
    if (b.state === 'intro' || b.t < 70) { const k = Math.min(1, b.t / 70), e = 1 - Math.pow(1 - k, 3); ang = 0.5 + 2.7 * (1 - e); rad = 7 + 6 * e; hgt = 7 - 3 * e; }
    else if (b.state === 'victory') { ang = 2.95; rad = 9.5; hgt = 2.6; look = [0.6, 1.9, 3.0]; }
    else if (b.busy && b.acting) {
      const a = b.acting, ax = a.model ? a.model.position.x : 0;
      if (a.isEnemy) { ang = -0.3; rad = 10.5; look = [ax * 0.5, 0.9, -1]; }
      else { ang = 0.65; rad = 9.2; hgt = 3.4; look = [ax * 0.4, 1.0, 0.5]; }
      if (b.bursting) { ang = 0.4 + Math.sin(t * 0.02) * 1.1; rad = 9.5; }
    } else ang += Math.sin(t * 0.004) * 0.12;
    const k = b.t < 70 ? 1 : 0.06;
    this.ang += (ang - this.ang) * k; this.rad += (rad - this.rad) * k; this.hgt += (hgt - this.hgt) * k;
    this.look.lerp(new THREE.Vector3(...look), k);
    this.cam.position.set(Math.sin(this.ang) * this.rad + this.look.x * 0.3, this.hgt, Math.cos(this.ang) * this.rad + this.look.z * 0.3);
    this.cam.lookAt(this.look);
    R3.render(this.scene, this.cam);
  }
  anchor(x, m, h) {
    const [px, py] = R3.project(new THREE.Vector3(m.position.x, h * (m.userData.base || 1) * (x.isEnemy ? 1 : 1), m.position.z), this.cam);
    x.cx = px; x.cy = py;
  }
}

const BATTLE_BG = {
  grass: ['#5a90e0', '#a0d0f0', '#4a9a3a', '#3a7a2a'], woods: ['#1a3a2a', '#2a5a3a', '#2a5a22', '#1a4012'],
  cave: ['#0a1018', '#1a2a3a', '#3a4a5a', '#2a3440'], snow: ['#8090c0', '#d0e0f8', '#e8eef8', '#c0d0e8'],
  ice: ['#102040', '#3060a0', '#a0c8e8', '#7aa0c8'], desert: ['#e09050', '#f0d090', '#e0c070', '#c8a050'],
  ruins: ['#200808', '#602010', '#a07040', '#7a4a2a'], waste: ['#100010', '#402040', '#3a2a40', '#2a1a30'],
  rift: ['#000000', '#300040', '#3a2a4a', '#1a0a2a'], shrine: ['#202028', '#505060', '#909098', '#707078']
};
function drawBattleBg(key, sceneKey, t) {
  const img = sceneKey && Img.get(CONFIG.scenes[sceneKey]);
  if (img) {
    const s = Math.max(SW / img.naturalWidth, 164 / img.naturalHeight);
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, (SW - img.naturalWidth * s) / 2, (164 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, SW, 164); ctx.restore();
    return;
  }
  const c = BATTLE_BG[key] || BATTLE_BG.grass;
  let g = ctx.createLinearGradient(0, 0, 0, 80); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, 80);
  ctx.fillStyle = shade(c[1], -0.25);
  ctx.beginPath(); ctx.moveTo(0, 80);
  for (let x = 0; x <= SW; x += 20) ctx.lineTo(x, 62 - Math.abs(Math.sin(x * 0.02 + key.length)) * 22);
  ctx.lineTo(SW, 80); ctx.fill();
  g = ctx.createLinearGradient(0, 80, 0, 164); g.addColorStop(0, c[3]); g.addColorStop(1, c[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 80, SW, 84);
  ctx.fillStyle = shade(c[2], 0.12);
  for (let i = 0; i < 18; i++) { const y = 84 + (i * 37 % 80), x = (i * 71 + 13) % SW; ctx.fillRect(x, y, 10 + (i % 3) * 6, 1); }
}
function drawFx(f) {
  const p = f.t / f.dur, x = f.x, y = f.y, s = f.size;
  ctx.save();
  switch (f.type) {
    case 'slash': case 'bigslash': case 'beam': {
      ctx.strokeStyle = f.type === 'beam' ? '#a0e0ff' : '#ffffff'; ctx.lineWidth = f.type === 'bigslash' ? 3 : 2;
      ctx.globalAlpha = 1 - p; const k = Math.min(1, p * 3);
      ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x - s + 2 * s * k, y - s + 2 * s * k); ctx.stroke();
      if (f.type !== 'slash') { ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(x + s - 2 * s * k, y - s + 2 * s * k); ctx.stroke(); }
      break;
    }
    case 'hit': ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - p; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; ctx.fillRect(x + Math.cos(a) * s * p, y + Math.sin(a) * s * p, 2, 2); } break;
    case 'fire': for (let i = 0; i < 14; i++) { const a = i * 2.4, r = s * p * (0.4 + (i % 4) * 0.2); ctx.fillStyle = i % 3 ? '#ff8020' : '#ffe040'; ctx.globalAlpha = 1 - p; ctx.fillRect(x + Math.cos(a) * r - 2, y + Math.sin(a) * r - 2 - p * 10, 4, 4); } break;
    case 'ice': ctx.fillStyle = '#c0f0ff'; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1 - p * 0.8;
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + p, r = s * (1 - p) + 4; ctx.fillRect(x + Math.cos(a) * r - 2, y + Math.sin(a) * r - 4, 3, 8); } break;
    case 'bolt': ctx.strokeStyle = p < 0.5 ? '#ffff80' : '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.moveTo(x, 0); for (let yy = 0; yy < y; yy += 12) ctx.lineTo(x + (Math.random() * 12 - 6), yy); ctx.lineTo(x, y); ctx.stroke(); break;
    case 'holy': ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1 - p;
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + p * 3, r = s * (1 - p); ctx.fillRect(x + Math.cos(a) * r - 1, y + Math.sin(a) * r - 1, 3, 3); }
      ctx.globalAlpha = (1 - p) * 0.4; ctx.beginPath(); ctx.arc(x, y, s * p, 0, 6.28); ctx.fill(); break;
    case 'dark': ctx.fillStyle = '#8020c0'; ctx.globalAlpha = (1 - p) * 0.8;
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 - p * 4, r = s * (1 - p) * 1.2; ctx.fillRect(x + Math.cos(a) * r - 2, y + Math.sin(a) * r - 2, 4, 4); } break;
    case 'heal': ctx.fillStyle = '#80ff80'; ctx.globalAlpha = 1 - p;
      for (let i = 0; i < 8; i++) ctx.fillRect(x - 10 + (i * 7) % 20, y + 10 - p * 30 - (i % 3) * 5, 2, 4); break;
    case 'buff': ctx.strokeStyle = '#ffe080'; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.ellipse(x, y + 10 - p * 24, 14, 4, 0, 0, 6.28); ctx.stroke(); break;
    case 'debuff': ctx.strokeStyle = '#c080ff'; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.ellipse(x, y - 14 + p * 24, s * 0.8, 4, 0, 0, 6.28); ctx.stroke(); break;
    case 'flare': ctx.globalAlpha = 1 - p; ctx.fillStyle = p < 0.3 ? '#ffffff' : '#ff6020';
      ctx.beginPath(); ctx.arc(x, y, s * (0.3 + p), 0, 6.28); ctx.fill(); ctx.fillStyle = '#ffe080'; ctx.beginPath(); ctx.arc(x, y, s * p * 0.6, 0, 6.28); ctx.fill(); break;
    case 'quake': ctx.fillStyle = '#806040'; ctx.globalAlpha = 1 - p; for (let i = 0; i < 6; i++) ctx.fillRect(x - 16 + i * 6, y + 8 - Math.abs(Math.sin(p * 10 + i)) * 12, 4, 4); break;
    case 'steal': ctx.fillStyle = '#ffe040'; ctx.globalAlpha = 1 - p; ctx.fillRect(x - 2 + p * 30, y - 2 - p * 20, 4, 4); break;
  }
  ctx.restore();
}
