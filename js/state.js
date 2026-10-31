// Party, stats, inventory and save data.
'use strict';

let S = null; // current game state

const STARTING_GEAR = {
  brawler: { weapon: 'leathergloves', armor: 'leathervest', acc: null },
  monk: { weapon: 'clothwraps', armor: 'cottonrobe', acc: null },
  gunner: { weapon: 'gunarm', armor: 'chainmail', acc: null }
};

function newGame() {
  S = {
    party: [], members: {}, inv: { potion: 4, antidote: 2, tent: 1 }, gil: 200, flags: {},
    pos: null, chapter: 0, time: 0, steps: 0, encSteps: 20, battles: 0,
    config: { textSpeed: 2, battleSpeed: 2, music: 5, sfx: 7 }
  };
  addMember('hero1', 1);
}
function makeMember(id, lv) {
  const job = CAST[id].job;
  const m = { id, lv: 1, exp: 0, hp: 1, mp: 1, eq: { ...STARTING_GEAR[job] }, status: {}, burst: 0 };
  setLevel(m, lv);
  const st = stats(m); m.hp = st.maxhp; m.mp = st.maxmp;
  return m;
}
function setLevel(m, lv) { m.lv = lv; m.exp = 0; }
function addMember(id, lv) {
  if (S.party.includes(id)) return;
  S.members[id] = S.members[id] || makeMember(id, lv || 1);
  S.party.push(id);
}
function partyAvgLevel() {
  const ms = S.party.map(id => S.members[id]);
  return Math.max(1, Math.round(ms.reduce((a, m) => a + m.lv, 0) / ms.length));
}
function jobOf(m) { return JOBS[CAST[m.id].job]; }
function stats(m) {
  const j = jobOf(m), L = m.lv - 1, s = {};
  for (const k of ['hp', 'mp', 'str', 'mag', 'def', 'mdef', 'spd']) s[k] = Math.floor(j.base[k] + j.grow[k] * L + (k === 'hp' ? 0.25 * L * L : 0));
  s.atk = 0; s.ward = []; s.el = null;
  for (const slot of ['weapon', 'armor', 'acc']) {
    const e = EQUIP[m.eq[slot]]; if (!e) continue;
    s.atk += e.atk || 0; s.str += e.str || 0; s.mag += e.mag || 0; s.def += e.def || 0;
    s.mdef += e.mdef || 0; s.spd += e.spd || 0;
    if (e.hpPct) s.hp = Math.floor(s.hp * (1 + e.hpPct / 100));
    if (e.ward) s.ward.push(...e.ward);
    if (slot === 'weapon' && e.el) s.el = e.el;
  }
  s.maxhp = Math.min(9999, s.hp); s.maxmp = Math.min(999, s.mp);
  return s;
}
function knownSkills(m) { return jobOf(m).skills.filter(([lv]) => m.lv >= lv).map(([, id]) => id); }
function gainExp(m, amount) {
  const learned = [];
  let levels = 0;
  m.exp += amount;
  while (m.lv < MAX_LV && m.exp >= expNext(m.lv)) {
    m.exp -= expNext(m.lv); const before = knownSkills(m);
    const old = stats(m); m.lv++; levels++;
    const nw = stats(m); m.hp += nw.maxhp - old.maxhp; m.mp += nw.maxmp - old.maxmp;
    for (const s of knownSkills(m)) if (!before.includes(s)) learned.push(s);
  }
  return { levels, learned };
}
function fullHeal(all = true) {
  for (const id of S.party) { const m = S.members[id], st = stats(m); m.hp = st.maxhp; m.mp = st.maxmp; m.status = {}; }
}
function addItem(id, n = 1) { S.inv[id] = (S.inv[id] || 0) + n; if (S.inv[id] <= 0) delete S.inv[id]; }
function itemCount(id) {
  let n = S.inv[id] || 0;
  return n;
}
function equippedCount(id) { let n = 0; for (const pid in S.members) for (const s in S.members[pid].eq) if (S.members[pid].eq[s] === id) n++; return n; }

// ------------------------------------------------------------------ saving
const SAVE_KEY = 'firstfantasy_save_';
function saveGame(slot) {
  try {
    localStorage.setItem(SAVE_KEY + slot, JSON.stringify({ v: 1, when: Date.now(), S }));
    return true;
  } catch (e) { return false; }
}
function loadSlot(slot) {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY + slot)); return d && d.S ? d : null; } catch (e) { return null; }
}
function slotSummary(slot) {
  const d = loadSlot(slot); if (!d) return null;
  const lead = d.S.members[d.S.party[0]];
  return { lead: d.S.party[0], lv: lead.lv, chapter: d.S.chapter, time: d.S.time, place: d.S.pos && placeName(d.S.pos.map), party: d.S.party };
}
function anySave() { return [1, 2, 3].some(s => loadSlot(s)); }
function fmtTime(frames) {
  const s = Math.floor(frames / 60), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h + ':' + String(m).padStart(2, '0');
}
function placeName(mapId) {
  if (!mapId) return '';
  const base = mapId.split(':')[0];
  if (base === 'world') return CONFIG.places.world;
  const n = CONFIG.places[base] || base;
  return mapId.includes(':') ? n + ' ' + (+mapId.split(':')[1] + 1) + 'F' : n;
}
