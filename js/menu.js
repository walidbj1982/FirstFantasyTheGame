// Field menu (items, skills, equipment, status, order, config, save), title, save/load, cast.
'use strict';

function useOnMember(id, m) {
  const u = ITEMS[id].use, st = stats(m);
  if (u.revive) { if (m.hp > 0) return false; m.hp = Math.max(1, Math.floor(st.maxhp * u.revive)); return true; }
  if (m.hp <= 0) return false;
  let did = false;
  if (u.hp && m.hp < st.maxhp) { m.hp = Math.min(st.maxhp, m.hp + u.hp); did = true; }
  if (u.mp && m.mp < st.maxmp) { m.mp = Math.min(st.maxmp, m.mp + u.mp); did = true; }
  if (u.cure) for (const c of u.cure) if (m.status[c]) { delete m.status[c]; did = true; }
  return did;
}

class MenuScene {
  constructor(field) {
    this.field = field; this.opaque = true; this.mode = 'root'; this.i = 0; this.pi = 0; this.msg = '';
    this.cmds = ['Items', 'Skills', 'Equip', 'Status', 'Order', 'Config', 'Save', 'Close'];
  }
  get members() { return S.party.map(id => S.members[id]); }
  canSave() { return this.field && this.field.map.type === 'world'; }
  update() {
    const nav = n => { if (Input.pressed('up')) { Sound.play('cursor'); return -1; } if (Input.pressed('down')) { Sound.play('cursor'); return 1; } return 0; };
    switch (this.mode) {
      case 'root': {
        this.i = (this.i + nav() + this.cmds.length) % this.cmds.length;
        if (Input.pressed('b')) { Sound.play('cancel'); Scenes.pop(this); return; }
        if (!Input.pressed('a')) return;
        const c = this.cmds[this.i]; Sound.play('confirm'); this.msg = '';
        if (c === 'Close') Scenes.pop(this);
        else if (c === 'Items') this.openItems();
        else if (c === 'Save') { if (this.canSave()) Scenes.push(new SaveScene()); else { Sound.play('error'); this.msg = 'Save on the world map, at crystals or at an inn.'; } }
        else if (c === 'Config') { this.mode = 'config'; this.ci = 0; }
        else { this.mode = 'pick'; this.after = c; this.pi = 0; }
        return;
      }
      case 'pick': {
        const n = this.members.length; this.pi = (this.pi + nav() + n) % n;
        if (Input.pressed('b')) {
          Sound.play('cancel'); this.swapFrom = null;
          if (this.after === 'useItem') { const i = this.list.i; this.openItems(); this.list.i = Math.min(i, this.list.items.length - 1); }
          else this.mode = this.after === 'useSkill' ? this.backTo : 'root';
          return;
        }
        if (!Input.pressed('a')) return;
        const m = this.members[this.pi];
        if (this.after === 'Status') { Sound.play('confirm'); this.mode = 'status'; }
        else if (this.after === 'Equip') { Sound.play('confirm'); this.mode = 'equip'; this.slot = 0; }
        else if (this.after === 'Skills') { Sound.play('confirm'); this.caster = m; this.openSkills(); }
        else if (this.after === 'Order') {
          if (this.swapFrom == null) { this.swapFrom = this.pi; Sound.play('confirm'); }
          else { const a = this.swapFrom, b = this.pi; [S.party[a], S.party[b]] = [S.party[b], S.party[a]]; this.swapFrom = null; Sound.play('confirm'); }
        }
        else if (this.after === 'useItem') {
          const id = this.list.cur.id, all = ITEMS[id].use.all;
          const ok = all ? this.members.map(x => useOnMember(id, x)).some(Boolean) : useOnMember(id, m);
          if (ok) { addItem(id, -1); Sound.play('heal'); if (!S.inv[id]) { this.openItems(); } } else Sound.play('error');
        } else if (this.after === 'useSkill') {
          const sk = SKILLS[this.list.cur.id], c = this.caster, cs = stats(c);
          if (c.mp < sk.mp || c.hp <= 0) { Sound.play('error'); return; }
          const targets = sk.target === 'allies' ? this.members : [m];
          let ok = false;
          for (const t of targets) {
            const ts = stats(t);
            if (sk.kind === 'heal' && t.hp > 0 && t.hp < ts.maxhp) { t.hp = Math.min(ts.maxhp, t.hp + Math.round(sk.pow * (cs.mag + c.lv) / 4)); ok = true; }
            if (sk.kind === 'revive' && t.hp <= 0) { t.hp = Math.max(1, Math.floor(ts.maxhp * sk.pow)); ok = true; }
            if (sk.kind === 'cure' && Object.keys(t.status).length) { t.status = {}; ok = true; }
          }
          if (ok) { c.mp -= sk.mp; Sound.play('heal'); } else Sound.play('error');
        }
        return;
      }
      case 'items': case 'skills': {
        this.list.update();
        if (Input.pressed('b')) { Sound.play('cancel'); this.mode = 'root'; return; }
        if (!Input.pressed('a') || !this.list.cur) return;
        const it = this.list.cur;
        if (it.disabled) { Sound.play('error'); return; }
        Sound.play('confirm'); this.backTo = this.mode;
        this.after = this.mode === 'items' ? 'useItem' : 'useSkill'; this.mode = 'pick';
        return;
      }
      case 'status': {
        const n = this.members.length;
        if (Input.pressed('left') || Input.pressed('up')) { this.pi = (this.pi + n - 1) % n; Sound.play('cursor'); }
        if (Input.pressed('right') || Input.pressed('down')) { this.pi = (this.pi + 1) % n; Sound.play('cursor'); }
        if (Input.pressed('a') || Input.pressed('b')) { Sound.play('cancel'); this.mode = 'pick'; }
        return;
      }
      case 'equip': {
        this.slot = (this.slot + nav() + 3) % 3;
        if (Input.pressed('b')) { Sound.play('cancel'); this.mode = 'pick'; return; }
        if (Input.pressed('a')) { Sound.play('confirm'); this.openEquipList(); }
        return;
      }
      case 'equiplist': {
        this.list.update();
        if (Input.pressed('b')) { Sound.play('cancel'); this.mode = 'equip'; return; }
        if (Input.pressed('a') && this.list.cur) {
          const m = this.members[this.pi], slot = ['weapon', 'armor', 'acc'][this.slot], id = this.list.cur.id;
          const old = m.eq[slot]; if (old) addItem(old, 1);
          m.eq[slot] = id; if (id) addItem(id, -1);
          const st = stats(m); m.hp = Math.min(m.hp, st.maxhp); m.mp = Math.min(m.mp, st.maxmp);
          Sound.play('confirm'); this.mode = 'equip';
        }
        return;
      }
      case 'config': {
        const keys = ['textSpeed', 'battleSpeed', 'music', 'sfx'], max = [3, 4, 10, 10];
        this.ci = (this.ci + nav() + 4) % 4;
        const k = keys[this.ci];
        if (Input.pressed('left')) { S.config[k] = Math.max(0, S.config[k] - 1); Sound.play('cursor'); }
        if (Input.pressed('right')) { S.config[k] = Math.min(max[this.ci], S.config[k] + 1); Sound.play('cursor'); }
        applyConfig();
        if (Input.pressed('b') || Input.pressed('a')) { Sound.play('cancel'); this.mode = 'root'; }
        return;
      }
    }
  }
  openItems() {
    const items = Object.keys(S.inv).filter(id => S.inv[id] > 0).map(id => {
      const d = itemDef(id), usable = ITEMS[id] && !ITEMS[id].battle && !ITEMS[id].use.tent;
      return { id, label: d.name, right: S.inv[id], disabled: !usable };
    });
    this.list = new ListBox(4, 4, 312, 12, items); this.mode = 'items';
  }
  openSkills() {
    const m = this.caster;
    const items = knownSkills(m).map(id => ({ id, label: SKILLS[id].name, right: SKILLS[id].mp, disabled: !SKILLS[id].field || m.mp < SKILLS[id].mp }));
    if (!items.length) { Sound.play('error'); this.mode = 'pick'; return; }
    this.list = new ListBox(4, 4, 312, 12, items); this.mode = 'skills';
  }
  openEquipList() {
    const m = this.members[this.pi], slot = ['weapon', 'armor', 'acc'][this.slot], job = CAST[m.id].job;
    const items = Object.keys(S.inv).filter(id => EQUIP[id] && EQUIP[id].slot === slot && S.inv[id] > 0 && canEquip(job, EQUIP[id]))
      .map(id => ({ id, label: EQUIP[id].name, right: S.inv[id] }));
    if (slot === 'acc' && m.eq.acc) items.unshift({ id: null, label: '(Remove)' });
    if (!items.length) { Sound.play('error'); return; }
    this.list = new ListBox(4, 108, 200, 8, items); this.mode = 'equiplist';
  }
  draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    if (this.mode === 'items' || this.mode === 'skills' || ((this.after === 'useItem' || this.after === 'useSkill') && this.mode === 'pick')) {
      if (this.mode === 'pick') this.drawParty(true); else {
        this.list.draw();
        const it = this.list.cur;
        if (it) { const d = this.mode === 'items' ? itemDef(it.id) : SKILLS[it.id]; win(4, 176, 312, 60); txt(d.desc || describeEquip(d) || (this.mode === 'skills' ? (d.field ? 'Usable here.' : 'Battle only.') : ''), 12, 186); }
      }
      return;
    }
    if (this.mode === 'status') return this.drawStatus();
    if (this.mode === 'equip' || this.mode === 'equiplist') return this.drawEquip();
    if (this.mode === 'config') return this.drawConfig();
    this.drawParty(this.mode === 'pick');
    win(232, 0, 88, 118);
    this.cmds.forEach((c, i) => txt(c, 248, 8 + i * 13, c === 'Save' && !this.canSave() ? '#808090' : '#fff'));
    if (this.mode === 'root') cursor(236, 8 + this.i * 13);
    win(232, 118, 88, 74);
    txt('Gil', 240, 126, '#a0c0ff'); txt(String(S.gil), 312, 138, '#fff', 'right');
    txt('Time', 240, 154, '#a0c0ff'); txt(fmtTime(S.time), 312, 166, '#fff', 'right');
    win(232, 192, 88, 48); wrap(placeName(S.pos.map), 76).slice(0, 2).forEach((l, i) => txt(l, 240, 202 + i * 12, '#ffe080'));
    if (this.msg) { win(4, 200, 226, 36); wrap(this.msg, 210).forEach((l, i) => txt(l, 12, 207 + i * 12)); }
  }
  drawParty(picking) {
    this.members.forEach((m, i) => {
      const y = i * 60, st = stats(m);
      win(0, y, 232, 60);
      drawPortrait(m.id, 8, y + 8, 44);
      txt(CAST[m.id].name, 60, y + 8, m.hp <= 0 ? '#ff6060' : '#fff');
      txt('Lv ' + m.lv, 224, y + 8, '#fff', 'right');
      txt(JOBS[CAST[m.id].job].name, 60, y + 20, '#a0c0ff');
      txt(`HP ${m.hp}/${st.maxhp}`, 60, y + 32, m.hp <= 0 ? '#ff6060' : '#fff');
      txt(`MP ${m.mp}/${st.maxmp}`, 60, y + 44, '#fff');
      const st2 = Object.keys(m.status)[0]; if (st2 && STATUS[st2]) txt(STATUS[st2].name, 224, y + 44, STATUS[st2].col, 'right');
      if (this.swapFrom === i) { ctx.strokeStyle = '#ffe080'; ctx.strokeRect(2.5, y + 2.5, 227, 55); }
    });
    if (picking) cursor(0, this.pi * 60 + 24);
  }
  drawStatus() {
    const m = this.members[this.pi], st = stats(m), c = CAST[m.id];
    win(0, 0, SW, SH);
    drawPortrait(m.id, 12, 12, 64);
    txt(c.name, 88, 14, '#ffe080'); txt(c.title || '', 88, 28, '#c0c0d0');
    txt(JOBS[c.job].name + '   Lv ' + m.lv, 88, 44);
    txt(`EXP ${m.exp}  Next ${expNext(m.lv) - m.exp}`, 88, 58);
    txt('Played by ' + (c.actor || '?'), 88, 72, '#a0c0ff');
    const rows = [['HP', `${m.hp}/${st.maxhp}`], ['MP', `${m.mp}/${st.maxmp}`], ['Strength', st.str], ['Attack', st.str + st.atk], ['Magic', st.mag],
      ['Defense', st.def], ['M.Defense', st.mdef], ['Speed', st.spd]];
    rows.forEach(([k, v], i) => { txt(k, 16, 96 + i * 13, '#a0c0ff'); txt(String(v), 150, 96 + i * 13, '#fff', 'right'); });
    ['weapon', 'armor', 'acc'].forEach((s, i) => { txt(s === 'acc' ? 'Acc.' : s[0].toUpperCase() + s.slice(1), 170, 96 + i * 26, '#a0c0ff'); txt(m.eq[s] ? EQUIP[m.eq[s]].name : '-', 178, 108 + i * 26); });
    wrap(c.bio || '', 290).slice(0, 2).forEach((l, i) => txt(l, 16, 206 + i * 12, '#c0c0d0'));
    txt('< >', SW - 12, 8, '#808090', 'right');
  }
  drawEquip() {
    const m = this.members[this.pi], st = stats(m);
    win(0, 0, SW, 104);
    drawPortrait(m.id, 10, 10, 40);
    txt(CAST[m.id].name, 60, 10, '#ffe080');
    ['weapon', 'armor', 'acc'].forEach((s, i) => { txt(['Weapon', 'Armor', 'Acc.'][i], 72, 32 + i * 16, '#a0c0ff'); txt(m.eq[s] ? EQUIP[m.eq[s]].name : '-', 150, 32 + i * 16); });
    if (this.mode === 'equip') cursor(58, 32 + this.slot * 16);
    let preview = null;
    if (this.mode === 'equiplist' && this.list.cur) { const slot = ['weapon', 'armor', 'acc'][this.slot]; preview = stats({ ...m, eq: { ...m.eq, [slot]: this.list.cur.id } }); }
    win(206, 104, 114, 136);
    [['Attack', st.str + st.atk, preview && preview.str + preview.atk], ['Magic', st.mag, preview && preview.mag], ['Defense', st.def, preview && preview.def],
      ['M.Def', st.mdef, preview && preview.mdef], ['Speed', st.spd, preview && preview.spd], ['Max HP', st.maxhp, preview && preview.maxhp]]
      .forEach(([k, v, p], i) => {
        txt(k, 212, 112 + i * 20, '#a0c0ff');
        txt(String(v), 270, 122 + i * 20, '#fff', 'right');
        if (p != null) txt(String(p), 314, 122 + i * 20, p > v ? '#80ff80' : p < v ? '#ff8080' : '#fff', 'right');
      });
    if (this.mode === 'equiplist') this.list.draw();
    else { win(4, 108, 200, 40); txt('A: change   B: back', 12, 122, '#c0c0d0'); }
  }
  drawConfig() {
    win(0, 0, SW, SH);
    txt('Config', 16, 12, '#ffe080');
    const rows = [['Text speed', ['Slow', 'Normal', 'Fast', 'Instant'][S.config.textSpeed]], ['Battle speed', S.config.battleSpeed + 1 + ' / 5'],
      ['Music volume', S.config.music + ' / 10'], ['Sound volume', S.config.sfx + ' / 10']];
    rows.forEach(([k, v], i) => { txt(k, 32, 40 + i * 20); txt('< ' + v + ' >', 300, 40 + i * 20, '#ffe080', 'right'); });
    cursor(16, 40 + this.ci * 20);
    txt('Left/Right to change, B to go back.', 16, 200, '#c0c0d0');
  }
}
function applyConfig() {
  if (!S) return;
  Sound.vol.music = S.config.music / 10 * 0.6; Sound.vol.sfx = S.config.sfx / 10; Sound.setVolumes();
}

// ------------------------------------------------------------ save / load
class SlotScene {
  constructor() { this.i = 0; this.msg = ''; this.opaque = true; }
  update() {
    if (Input.pressed('up')) { this.i = (this.i + 2) % 3; Sound.play('cursor'); }
    if (Input.pressed('down')) { this.i = (this.i + 1) % 3; Sound.play('cursor'); }
    if (Input.pressed('b')) { Sound.play('cancel'); this.cancel(); }
    else if (Input.pressed('a')) this.choose(this.i + 1);
  }
  draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    win(0, 0, SW, 26); txt(this.title, 12, 9, '#ffe080');
    for (let k = 0; k < 3; k++) {
      const y = 30 + k * 66, s = slotSummary(k + 1);
      win(0, y, SW, 64);
      txt('File ' + (k + 1), 22, y + 8, '#a0c0ff');
      if (!s) { txt('- empty -', 160, y + 28, '#808090', 'center'); }
      else {
        s.party.forEach((id, j) => drawPortrait(id, 22 + j * 30, y + 22, 26));
        txt(CAST[s.lead].name + '  Lv ' + s.lv, 150, y + 10);
        txt('Chapter ' + s.chapter, 150, y + 24, '#c0c0d0');
        txt(s.place || '', 150, y + 38, '#ffe080');
        txt(fmtTime(s.time), 310, y + 10, '#fff', 'right');
      }
      if (k === this.i) cursor(6, y + 8);
    }
    if (this.msg) { win(60, 100, 200, 30); txt(this.msg, SW / 2, 111, '#fff', 'center'); }
  }
}
class SaveScene extends SlotScene {
  constructor() { super(); this.title = 'Save to which file?'; }
  cancel() { Scenes.pop(this); }
  choose(slot) {
    if (saveGame(slot)) { Sound.play('save'); this.msg = 'Saved!'; setTimeout(() => Scenes.pop(this), 700); }
    else { Sound.play('error'); this.msg = 'Could not save.'; }
  }
}
class LoadScene extends SlotScene {
  constructor(fromGameOver) { super(); this.title = 'Load which file?'; this.fromGameOver = fromGameOver; }
  cancel() { Scenes.replaceAll(new TitleScene()); }
  choose(slot) {
    const d = loadSlot(slot); if (!d) { Sound.play('error'); return; }
    Sound.play('confirm');
    startFromState(d.S);
  }
}
async function startFromState(state) {
  S = state; applyConfig();
  await fadeTo(1, 20);
  const f = new FieldScene(); Ev.field = f;
  Scenes.replaceAll(f);
  f.load(S.pos.map, S.pos.x, S.pos.y, S.pos.dir);
  await fadeTo(0, 20);
}

// ------------------------------------------------------------ title
class TitleScene {
  constructor() { this.opaque = true; this.i = anySave() ? 1 : 0; this.t = 0; }
  enter() { Music.play('title'); }
  get opts() { return ['New Game', 'Continue', 'Cast & Credits']; }
  update() {
    this.t++;
    if (Input.pressed('up')) { this.i = (this.i + 2) % 3; Sound.play('cursor'); }
    if (Input.pressed('down')) { this.i = (this.i + 1) % 3; Sound.play('cursor'); }
    if (!Input.pressed('a')) return;
    Sound.unlock();
    if (this.i === 0) { Sound.play('confirm'); startNewGame(); }
    else if (this.i === 1) { if (!anySave()) { Sound.play('error'); return; } Sound.play('confirm'); Scenes.replaceAll(new LoadScene()); }
    else { Sound.play('confirm'); Scenes.push(new CastScene()); }
  }
  draw() {
    drawSkyBackdrop('intro', this.t);
    const heroes = ['hero1', 'hero2', 'hero3', 'hero4'];
    heroes.forEach((id, i) => ctx.drawImage(charSprite(CAST[id].look, 'down', Math.floor(this.t / 12 + i) % 4), 88 + i * 40, 128, 32, 32));
    ctx.save(); ctx.globalAlpha = 0.35;
    ctx.drawImage(charSprite(CAST.villain1.look, 'down', 0), 112, 6, 96, 96); ctx.restore();
    txt(CONFIG.title, SW / 2, 62, '#ffe080', 'center', 16);
    txt(CONFIG.subtitle || '', SW / 2, 86, '#ffffff', 'center');
    this.opts.forEach((o, i) => txt(o, 120, 174 + i * 15, i === 1 && !anySave() ? '#808090' : '#fff'));
    cursor(104, 174 + this.i * 15);
    txt(CONFIG.credits || '', SW / 2, 226, '#c0c0d0', 'center');
  }
}
class CastScene {
  constructor() { this.opaque = true; this.ids = Object.keys(CAST); this.i = 0; }
  update() {
    const n = this.ids.length;
    if (Input.pressed('left') || Input.pressed('up')) { this.i = (this.i + n - 1) % n; Sound.play('cursor'); }
    if (Input.pressed('right') || Input.pressed('down')) { this.i = (this.i + 1) % n; Sound.play('cursor'); }
    if (Input.pressed('a')) { const c = CAST[this.ids[this.i]]; if (!Sound.clip((c.clips || {}).intro)) Sound.blip(c.voice); }
    if (Input.pressed('b')) { Sound.play('cancel'); Scenes.pop(this); }
  }
  draw() {
    const id = this.ids[this.i], c = CAST[id];
    drawSkyBackdrop(id.startsWith('villain') ? 'final1' : 'festival', G.frame);
    win(10, 10, 300, 220);
    txt('CAST  ' + (this.i + 1) + '/' + this.ids.length, 20, 20, '#a0c0ff');
    drawPortrait(id, 24, 40, 80);
    ctx.drawImage(charSprite(c.look, 'down', Math.floor(G.frame / 12) % 4), 120, 70, 48, 48);
    ctx.drawImage(charSprite(c.look, 'left', 0, 'attack'), 180, 70, 48, 48);
    txt(c.name, 24, 132, '#ffe080', 'left', 16);
    txt(c.title || '', 24, 154, '#c0c0d0');
    txt('Played by ' + (c.actor || '?'), 24, 168);
    wrap(c.bio || '', 270).slice(0, 3).forEach((l, i) => txt(l, 24, 186 + i * 12, '#c0c0d0'));
    txt('< >  A: voice   B: back', 300, 20, '#808090', 'right');
  }
}
