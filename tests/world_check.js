// Checks world/dungeon connectivity: each region opens only after its gate flag,
// and every dungeon floor's stairs, boss and chests are reachable. Usage: node tests/world_check.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { console, Math }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(`const clamp=(v,a,b)=>v<a?a:v>b?b:v, pick=a=>a[0];
function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}`, ctx);
for (const f of ['data/config.js', 'data/cast.js', 'sprites.js', 'data/rules.js', 'data/enemies.js', 'data/world.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx);
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
const R = s => vm.runInContext(s, ctx);
// --- macro rows all same width
const MACRO = R('MACRO'); ok(MACRO.every(r => r.length === MACRO[0].length), 'macro rows equal width');
const TT = R('TOWN_TEMPLATE'); ok(TT.every(r => r.length === 24), 'town rows 24 wide');
const W = R('buildWorld()'), TILE = R('TILE');
function reach(map, sx, sy, isSolid) {
  const seen = new Set([sy * map.w + sx]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, i = ny * map.w + nx;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || seen.has(i) || isSolid(nx, ny)) continue;
      seen.add(i); q.push([nx, ny]);
    }
  }
  return seen;
}
const order = ['gate_bridge', 'gate_pass', 'gate_snow', 'gate_rift'];
const expect = [['town1', 'dungeon1'], ['town2', 'dungeon2'], ['town3', 'dungeon3', 'secret'], ['town4', 'dungeon4'], ['dungeon5']];
const start = W.locs.find(l => l.id === 'town1');
for (let k = 0; k <= order.length; k++) {
  const open = new Set(order.slice(0, k));
  const tiles = W.tiles.slice();
  for (const g of W.gates) tiles[g.y * W.w + g.x] = open.has(g.flag) ? g.open : g.closed;
  const seen = reach(W, start.x, start.y, (x, y) => TILE[tiles[y * W.w + x]].solid);
  const can = W.locs.filter(l => seen.has(l.y * W.w + l.x)).map(l => l.id).sort();
  const want = expect.slice(0, k + 1).flat().sort();
  ok(JSON.stringify(can) === JSON.stringify(want), `with gates [${[...open]}] reachable ${can} expected ${want}`);
}
console.log('world', W.w + 'x' + W.h, 'locations', W.locs.map(l => l.id).join(','));
// --- dungeons
const D = R('DUNGEONS');
for (const did of Object.keys(D)) {
  for (let f = 0; f < D[did].floors; f++) {
    const m = R(`buildDungeonFloor('${did}', ${f})`);
    const solid = (x, y) => { const t = m.tiles[y * m.w + x]; if (TILE[t].solid && t !== 'crystal') return true; return m.objs.some(o => o.x === x && o.y === y && (o.type === 'chest' || o.type === 'boss')); };
    const seen = reach(m, m.start.x, m.start.y, solid);
    const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((y + dy) * m.w + x + dx));
    ok(seen.has(m.up.y * m.w + m.up.x), `${did}:${f} up stairs reachable`);
    if (m.down) ok(seen.has(m.down.y * m.w + m.down.x), `${did}:${f} down stairs reachable`);
    const boss = m.objs.find(o => o.type === 'boss');
    if (m.last) ok(boss && near(boss.x, boss.y), `${did}:${f} boss reachable`);
    const chests = m.objs.filter(o => o.type === 'chest');
    ok(chests.length === D[did].loot[f].length, `${did}:${f} all ${D[did].loot[f].length} chests placed (got ${chests.length})`);
    // chests may sit behind the boss on the last floor; count them reachable once boss is gone
    const seen2 = reach(m, m.start.x, m.start.y, (x, y) => { const t = m.tiles[y * m.w + x]; return TILE[t].solid || m.objs.some(o => o.x === x && o.y === y && o.type === 'chest'); });
    for (const c of chests) ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen2.has((c.y + dy) * m.w + c.x + dx)), `${did}:${f} chest ${c.item} reachable`);
    ok(TILE[m.tiles[m.start.y * m.w + m.start.x]] && !TILE[m.tiles[m.start.y * m.w + m.start.x]].solid, `${did}:${f} start tile walkable`);
  }
}
// --- every item referenced exists
const ITEMS = R('ITEMS'), EQUIP = R('EQUIP'), ENEMIES = R('ENEMIES'), SKILLS = R('SKILLS'), TOWNS = R('TOWNS'), ZONES = R('ZONES'), JOBS = R('JOBS');
const isItem = id => !!(ITEMS[id] || EQUIP[id]);
for (const t of Object.values(TOWNS)) for (const id of [...t.items, ...t.weapons, ...t.armor]) ok(isItem(id), 'shop item ' + id);
for (const d of Object.values(D)) for (const fl of d.loot) for (const id of fl) ok(id.startsWith('gil:') || isItem(id), 'loot ' + id);
for (const [id, e] of Object.entries(ENEMIES)) {
  for (const [s] of e.skills) ok(SKILLS[s], `${id} skill ${s}`);
  for (const ph of e.phases || []) for (const [s] of ph.skills) ok(SKILLS[s], `${id} phase skill ${s}`);
  if (e.steal) ok(isItem(e.steal), `${id} steal ${e.steal}`);
  if (e.drop) ok(isItem(e.drop[0]), `${id} drop ${e.drop[0]}`);
  for (const m of [...(e.minions || []), ...(e.summons || [])]) ok(ENEMIES[m], `${id} minion ${m}`);
  ok(['human', 'thug', 'jetski'].includes(e.kind) || R('MON')[e.kind], `${id} model kind ${e.kind}`);
}
for (const z of Object.values(ZONES)) for (const id of z.pool) ok(ENEMIES[id], 'zone enemy ' + id);
for (const j of Object.values(JOBS)) for (const [, s] of j.skills) ok(SKILLS[s], 'job skill ' + s);
console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
