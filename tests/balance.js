// Monte-Carlo balance check using the real game data and damage formula.
// Simulates each stage at the expected party level/gear and prints win rate,
// average rounds and the party HP left. Usage: node tests/balance.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { window: {}, console, Math, JSON, Object, Array, String, Number, Proxy };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(`
  const clamp=(v,a,b)=>v<a?a:v>b?b:v, rand=(a,b)=>a+Math.random()*(b-a), chance=p=>Math.random()<p, pick=a=>a[Math.floor(Math.random()*a.length)];
  function mulberry32(s){return Math.random} function hashStr(){return 1}
`, ctx);
for (const f of ['data/config.js', 'data/cast.js', 'data/rules.js', 'data/enemies.js', 'state.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx);
// pull calcDamage/elemMul out of battle.js without the scene class
const bsrc = fs.readFileSync(path.join(__dirname, '../js/battle.js'), 'utf8');
vm.runInContext(bsrc.slice(bsrc.indexOf('function avg('), bsrc.indexOf('// ------------------------------------------------------------ backgrounds')), ctx);
vm.runInContext(`
var SIM = {};
SIM.run = function(stage, n) {
  let wins = 0, rounds = 0, hpLeft = 0;
  for (let k = 0; k < n; k++) {
    newGame();
    S.party = []; S.members = {};
    for (const id of stage.party) { addMember(id, stage.lv); const m = S.members[id]; Object.assign(m.eq, stage.gear[CAST[id].job]); const st = stats(m); m.hp = st.maxhp; m.mp = st.maxmp; }
    const heroes = S.party.map(id => { const m = S.members[id], st = stats(m); return { m, isEnemy:false, job: CAST[id].job, lv: m.lv, hp: st.maxhp, maxhp: st.maxhp, mp: st.maxmp, str: st.str, atk: st.atk, mag: st.mag, def: st.def, mdef: st.mdef, spd: st.spd, weaponEl: st.el, status: {}, el: {} }; });
    const ens = stage.enemies.map(id => { const e = makeEnemy(id); return e; });
    for (const e of [...ens]) if (ENEMIES[e.id].minions) for (const mid of ENEMIES[e.id].minions) ens.push(makeEnemy(mid));
    let r = 0, potions = stage.potions || 0;
    while (r < 200 && heroes.some(h => h.hp > 0) && ens.some(e => e.hp > 0)) {
      r++;
      const order = [...heroes, ...ens].filter(b => b.hp > 0).sort((a, b) => b.spd * rand(0.8, 1.2) - a.spd * rand(0.8, 1.2));
      for (const b of order) {
        if (b.hp <= 0) continue;
        const foes = (b.isEnemy ? heroes : ens).filter(x => x.hp > 0); if (!foes.length) break;
        if (b.isEnemy) {
          let skills = b.skills; for (const ph of b.phases) if (b.hp / b.maxhp < ph.below) skills = ph.skills;
          let tot = skills.reduce((a, s) => a + s[1], 0), x = Math.random() * tot, id = skills[0][0];
          for (const [sid, w] of skills) if ((x -= w) < 0) { id = sid; break; }
          const s = SKILLS[id];
          if (s.kind === 'phys' || s.kind === 'magic' || s.kind === 'drain') {
            const ts = s.target === 'enemies' ? foes : [pick(foes)];
            for (let h = 0; h < (s.hits || 1); h++) for (const t of ts) { const d = calcDamage(b, t, s); if (!d.miss) t.hp = Math.max(0, t.hp - d.dmg); }
          } else if (s.kind === 'heal') b.hp = Math.min(b.maxhp, b.hp + s.pow * (b.mag + b.lv) / 4);
          continue;
        }
        // simple hero AI
        const low = heroes.filter(h => h.hp > 0 && h.hp < h.maxhp * 0.4);
        const known = knownSkills(b.m);
        if (b.job === 'monk' && low.length) {
          const sk = ['healingwave', 'chiheal'].find(s => known.includes(s) && b.mp >= SKILLS[s].mp);
          if (sk) { b.mp -= SKILLS[sk].mp; for (const t of SKILLS[sk].target === 'allies' ? heroes.filter(h=>h.hp>0) : [low[0]]) t.hp = Math.min(t.maxhp, t.hp + SKILLS[sk].pow * (b.mag + b.lv) / 4); continue; }
        }
        if (low.length && potions > 0) { potions--; low[0].hp = Math.min(low[0].maxhp, low[0].hp + (stage.potionHeal || 120)); continue; }
        let s = SKILLS.attack;
        if (b.job === 'monk') {
          const best = known.filter(id => SKILLS[id].kind === 'magic' && b.mp >= SKILLS[id].mp).sort((a, c) => SKILLS[c].pow - SKILLS[a].pow)[0];
          if (best) { s = SKILLS[best]; b.mp -= s.mp; }
        }
        if (b.job === 'brawler' || b.job === 'gunner') {
          const best = known.filter(id => SKILLS[id].kind === 'phys' && SKILLS[id].mp && b.mp >= SKILLS[id].mp).sort((a, c) => SKILLS[c].pow * (SKILLS[c].hits||1) - SKILLS[a].pow * (SKILLS[a].hits||1))[0];
          if (best && ens.some(e=>e.boss)) { s = SKILLS[best]; b.mp -= s.mp; }
        }
        const ts = s.target === 'enemies' ? foes : [foes.sort((a,c)=>a.hp-c.hp)[0]];
        for (let h = 0; h < (s.hits || 1); h++) for (const t of ts) { if (t.hp<=0) continue; const d = calcDamage(b, t, s); if (!d.miss) t.hp = Math.max(0, Math.min(t.maxhp, t.hp - d.dmg)); if (t.fleeAt && t.hp < t.maxhp * t.fleeAt) t.hp = 0; }
      }
    }
    if (ens.every(e => e.hp <= 0)) { wins++; hpLeft += heroes.reduce((a, h) => a + h.hp / h.maxhp, 0) / heroes.length; }
    rounds += r;
  }
  return { win: (wins / n * 100).toFixed(0) + '%', rounds: (rounds / n).toFixed(1), hpLeft: wins ? (hpLeft / wins * 100).toFixed(0) + '%' : '-' };
};
`, ctx);
const G = (gl, bd, gn, hv, rb, lt, acc) => ({ brawler: { weapon: gl, armor: lt, acc }, monk: { weapon: bd, armor: rb, acc }, gunner: { weapon: gn, armor: hv, acc } });
const T1 = G('leathergloves', 'clothwraps', 'gunarm', 'chainmail', 'cottonrobe', 'leathervest');
const T2 = G('ironknuckles', 'trainingband', 'assaultgun', 'ironarmor', 'silkrobe', 'brigandine');
const T3 = G('steelknuckles', 'dragonband', 'heavyvulcan', 'mythrilmail', 'magerobe', 'mythrilvest');
const T4 = G('flameknuckles', 'spiritwraps', 'flamecannon', 'flameplate', 'sagerobe', 'ninjagarb');
const T5 = G('crystalknuckles', 'sageband', 'thundercannon', 'crystalmail', 'lumenrobe', 'shadowgarb');
const P1 = ['hero1'], P3 = ['hero1', 'hero2', 'hero3'];
const Z = vm.runInContext('ZONES', ctx);
const rnd = (z, k) => Array.from({ length: k }, () => Z[z].pool[Math.floor(Math.random() * Z[z].pool.length)]);
const stages = [
  ['r1 L2 x3', P3, 2, T1, () => rnd('r1', 3), 2],
  ['d1 L5 x3', P3, 5, T1, () => rnd('d1', 3), 2],
  ['STRANGER L7', P3, 7, T2, () => ['boss_stranger'], 4],
  ['r2 L9 x3', P3, 9, T2, () => rnd('r2', 3), 2],
  ['d2 L12 x3', P3, 12, T2, () => rnd('d2', 3), 2],
  ['RUFUS L14', P3, 14, T2, () => ['boss_rufus'], 5],
  ['r3 L16 x3', P3, 16, T3, () => rnd('r3', 3), 2],
  ['d3 L19 x3', P3, 19, T3, () => rnd('d3', 3), 2],
  ['VIPER L22', P3, 22, T3, () => ['boss_viper'], 6],
  ['r4 L24 x3', P3, 24, T4, () => rnd('r4', 3), 2],
  ['d4 L27 x3', P3, 27, T4, () => rnd('d4', 3), 2],
  ['CARTOGRAPHER L30', P3, 30, T4, () => ['boss_cartographer'], 6],
  ['JETSKIS L31', P3, 31, T4, () => ['boss_jetskis'], 6],
  ['KYO L33 (to flee)', P3, 33, T5, () => ['boss_kyo'], 6],
  ['d5 L34 x3', P3, 34, T5, () => rnd('d5', 3), 2],
  ['SEPHIROTH L37', P3, 37, T5, () => ['boss_sephiroth'], 6],
  ['SEPHIROTH-2 L38', P3, 38, T5, () => ['boss_sephiroth2'], 6],
  ['FORGOTTEN L48', P3, 48, T5, () => ['boss_forgotten'], 6]
];
for (const [name, party, lv, gear, en, potions] of stages) {
  let agg = { w: 0, r: 0, h: 0, n: 0 };
  const res = ctx.SIM.run({ party, lv, gear, enemies: en(), potions, potionHeal: lv > 20 ? 450 : 120 }, 1);
  const N = 300; let wins = 0, rounds = 0, hp = 0, hpN = 0;
  for (let i = 0; i < N; i++) { const r = ctx.SIM.run({ party, lv, gear, enemies: en(), potions, potionHeal: lv > 20 ? 450 : 120 }, 1); if (r.win === '100%') { wins++; hp += parseFloat(r.hpLeft); hpN++; } rounds += +r.rounds; }
  console.log(name.padEnd(22), 'win', String(Math.round(wins / N * 100)).padStart(3) + '%', ' rounds', (rounds / N).toFixed(1).padStart(5), ' hpLeft', hpN ? Math.round(hp / hpN) + '%' : '-');
  void res; void agg;
}
