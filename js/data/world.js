// World layout. The overworld is drawn from a coarse "macro" map where each
// character is a 4x4 block of tiles. Towns use one hand-made template.
// Dungeons are generated from a seed so each floor is always the same.
'use strict';

//  ~ sea   ^ mountains   g grass   f forest   s snow   d desert   k wasteland
//  1-4 towns   A-E dungeons   S secret shrine   x y z w  gates opened by story flags
const MACRO = [
  '~~~~~~~~~~~~~~~~~~',
  '~ffg2gg^ss3ssssC^~',
  '~fgggfgyssssssss^~',
  '~ggBggg^ss^^ssSs^~',
  '~gggggg^ssssss^^^~',
  '~~~x~~~^^^^^z^^^^~',
  '~ggfggg^dd4ddddd^~',
  '~gfgggf^dddd^ddd^~',
  '~g1gggg^ddDddddd^~',
  '~ggggAf^ddddd^^^^~',
  '~fggggf^dddddwkE^~',
  '~ffgggf^ddd^^^^^^~',
  '~~~~~~~~~~~~~~~~~~'
];
const GATES = {
  x: { kind: 'bridge', flag: 'gate_bridge', msg: 'The bridge is broken. You cannot cross.' },
  y: { kind: 'pass', flag: 'gate_pass', msg: 'A great boulder blocks the mountain pass.' },
  z: { kind: 'pass', flag: 'gate_snow', msg: 'Snow and rock have sealed the southern pass.' },
  w: { kind: 'rift', flag: 'gate_rift', msg: 'A wall of dark energy bars the way.' }
};
const LOCS = {
  1: { id: 'town1', tile: 'town1' }, 2: { id: 'town2', tile: 'town2' }, 3: { id: 'town3', tile: 'town3' }, 4: { id: 'town4', tile: 'town4' },
  A: { id: 'dungeon1', tile: 'cave1' }, B: { id: 'dungeon2', tile: 'cave2' }, C: { id: 'dungeon3', tile: 'cave3' },
  D: { id: 'dungeon4', tile: 'cave4' }, E: { id: 'dungeon5', tile: 'cave5' }, S: { id: 'secret', tile: 'shrine' }
};
const PASSABLE_MACRO = 'gfsdk1234ABCDES';

function worldZone(tx, ty) {
  const cx = tx >> 2, cy = ty >> 2;
  if (cx >= 14 && cy === 10) return 'r5';
  if (cx <= 7) return cy >= 6 ? 'r1' : 'r2';
  return cy <= 5 ? 'r3' : 'r4';
}
function regionGround(zone) { return { r1: 'grass', r2: 'grass', r3: 'snow', r4: 'sand', r5: 'waste' }[zone]; }
function regionMountain(zone) { return { r1: 'mountain', r2: 'mountain', r3: 'smountain', r4: 'dmountain', r5: 'wmountain' }[zone]; }

function buildWorld() {
  const H = MACRO.length * 4, W = MACRO[0].length * 4;
  const r = mulberry32(1234);
  const tiles = new Array(W * H).fill('water');
  const set = (x, y, t) => { tiles[y * W + x] = t; };
  const M = (cx, cy) => (MACRO[cy] || '')[cx] || '~';
  const locs = [], gates = [];
  for (let cy = 0; cy < MACRO.length; cy++) for (let cx = 0; cx < MACRO[0].length; cx++) {
    const m = M(cx, cy), zone = worldZone(cx * 4, cy * 4), ground = regionGround(zone);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const tx = cx * 4 + x, ty = cy * 4 + y, v = r(); let t = ground;
      const center = x === 2 || y === 2;
      switch (m) {
        case '~': t = 'water'; break;
        case '^': t = regionMountain(zone); break;
        case 'f': t = v < 0.7 ? 'forest' : 'grass'; break;
        case 'g': t = v < 0.07 ? 'flowers' : v < 0.13 ? 'forest' : 'grass'; break;
        case 's': t = v < 0.12 ? 'snowtree' : 'snow'; break;
        case 'd': t = v < 0.1 ? 'dune' : (v < 0.14 && !center) ? 'cactus' : 'sand'; break;
        case 'k': t = 'waste'; break;
        default: t = ground;
      }
      set(tx, ty, t);
    }
    if (LOCS[m]) { const L = LOCS[m]; locs.push({ x: cx * 4 + 2, y: cy * 4 + 2, ...L }); set(cx * 4 + 2, cy * 4 + 2, L.tile); }
    if (GATES[m]) {
      const g = GATES[m];
      const pW = PASSABLE_MACRO.includes(M(cx - 1, cy)), pE = PASSABLE_MACRO.includes(M(cx + 1, cy));
      const horiz = pW && pE;
      const fill = g.kind === 'bridge' ? 'water' : g.kind === 'rift' ? 'riftwall' : regionMountain(zone);
      const path = g.kind === 'bridge' ? (horiz ? 'bridgeH' : 'bridgeV') : g.kind === 'rift' ? 'lightbridge' : 'road';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) set(cx * 4 + x, cy * 4 + y, fill);
      for (let i = 0; i < 4; i++) horiz ? set(cx * 4 + i, cy * 4 + 2, path) : set(cx * 4 + 2, cy * 4 + i, path);
      const closed = g.kind === 'bridge' ? 'brokenbridge' : g.kind === 'rift' ? 'riftwall' : 'boulder';
      gates.push({ x: cx * 4 + 2, y: cy * 4 + 2, flag: g.flag, open: path, closed, msg: g.msg });
    }
  }
  // roughen mountain/sea edges so blocks don't look square (never touches gates or locations)
  for (let cy = 0; cy < MACRO.length; cy++) for (let cx = 0; cx < MACRO[0].length; cx++) {
    const m = M(cx, cy); if (m !== '^' && m !== '~') continue;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
      const n = M(cx + dx, cy + dy); if (!'gfsdk'.includes(n)) continue;
      const ground = regionGround(worldZone((cx + dx) * 4, (cy + dy) * 4));
      for (let i = 0; i < 4; i++) {
        if (r() > 0.4) continue;
        const x = dx === -1 ? 0 : dx === 1 ? 3 : i, y = dy === -1 ? 0 : dy === 1 ? 3 : i;
        set(cx * 4 + x, cy * 4 + y, n === 'f' && r() < 0.5 ? 'forest' : ground);
      }
    }
  }
  return { id: 'world', type: 'world', w: W, h: H, tiles, locs, gates, music: 'field' };
}

// ------------------------------------------------------------------ towns
const TOWN_TEMPLATE = [
  'TTTTTTTTTTTTTTTTTTTTTTTT',
  'T,,,,,,,,,,,,,,,,,,,,,,T',
  'T,RRRRR,,,,,,,,,,RRRRR,T',
  'T,RRRRR,,,*,*,,,,RRRRR,T',
  'T,WNWDW,,,,,,,,,,WDWNW,T',
  'T,,,,,,,,,,,,,,,,,,,,,,T',
  'T,,ccc,,,,,F,,,,,,ccc,,T',
  'T,,,,,,,,,,::,,,,,,,,,,T',
  'T,,,,,,,,,,::,,,,,,,,,,T',
  'T,RRRRR,,,,::,,,,RRRRR,T',
  'T,RRRRR,,,,::,,,,RRRRR,T',
  'T,WDWNW,,,,::,,,,WNWDW,T',
  'T,,,,,,,,,,::,,,,,,,,,,T',
  'T,,ccc,,,,,::,,,,,,ccc,T',
  'T*,,,,,,w,,::,,S,,,,,,*T',
  'T,,,,,,,,,,::,,,,,,,,,,T',
  'TTTTTTTTTTT::TTTTTTTTTTT',
  'TTTTTTTTTTTEETTTTTTTTTTT'
];
const TOWN_KEY = { T: 'ttree', ',': 'tground', R: 'roof', W: 'wall', N: 'window', D: 'door', c: 'counter', F: 'fountain',
  ':': 'tpath', '*': 'tflower', S: 'sign', w: 'well', E: 'tpath' };
// stall keepers: [x, y, role]
const STALLS = [[4, 5, 'inn'], [19, 5, 'items'], [4, 12, 'weapons'], [20, 12, 'armor']];

const TOWNS = {
  town1: { theme: 'town_grass', innPrice: 10,
    items: ['potion', 'antidote', 'eyedrop', 'tent'],
    weapons: ['bronzesword', 'oakrod', 'ashstaff', 'knife'],
    armor: ['chainmail', 'cottonrobe', 'leathervest'] },
  town2: { theme: 'town_port', innPrice: 30,
    items: ['potion', 'phoenix', 'ether', 'antidote', 'eyedrop', 'echo', 'tent'],
    weapons: ['ironblade', 'silverrod', 'healstaff', 'kris'],
    armor: ['ironarmor', 'silkrobe', 'brigandine', 'starpendant', 'powerband', 'magicring'] },
  town3: { theme: 'town_snow', innPrice: 80,
    items: ['potion', 'hipotion', 'phoenix', 'ether', 'remedy', 'tent', 'arctic', 'bomb'],
    weapons: ['mythrilsword', 'frostrod', 'prismstaff', 'mythrildagger'],
    armor: ['mythrilmail', 'magerobe', 'mythrilvest', 'guardring', 'lifecharm'] },
  town4: { theme: 'town_sand', innPrice: 150,
    items: ['hipotion', 'phoenix', 'ether', 'hiether', 'remedy', 'tent', 'zeus'],
    weapons: ['flamberge', 'emberrod', 'sagestaff', 'fang'],
    armor: ['flameplate', 'sagerobe', 'ninjagarb', 'swiftanklet', 'lifecharm'] }
};
function buildTown(id) {
  const def = TOWNS[id], W = 24, H = TOWN_TEMPLATE.length;
  const tiles = [];
  for (const row of TOWN_TEMPLATE) for (const ch of row) tiles.push(TOWN_KEY[ch] || 'tground');
  return { id, type: 'town', w: W, h: H, tiles, theme: THEMES[def.theme], music: 'town', start: { x: 11, y: 15, dir: 'up' } };
}

// ------------------------------------------------------------------ dungeons
const DUNGEONS = {
  dungeon1: { theme: 'woods', floors: 3, zone: 'd1', boss: 'boss1', bossLook: { cast: 'villain4' },
    loot: [['potion', 'gil:150'], ['ironblade', 'ether'], ['phoenix', 'silkrobe']] },
  dungeon2: { theme: 'cave', floors: 4, zone: 'd2', boss: 'boss2', bossLook: { kind: 'snake', pal: ENEMIES.boss_serpent.pal },
    loot: [['hipotion', 'gil:600'], ['brigandine', 'ether'], ['silverrod', 'phoenix'], ['magicring', 'hipotion']] },
  dungeon3: { theme: 'ice', floors: 4, zone: 'd3', boss: 'boss3', bossLook: { cast: 'villain3' },
    loot: [['hipotion', 'gil:1500'], ['mythrilvest', 'hiether'], ['prismstaff', 'phoenix'], ['powerband', 'remedy']] },
  dungeon4: { theme: 'ruins', floors: 5, zone: 'd4', boss: 'boss4', bossLook: { cast: 'villain2' },
    loot: [['xpotion', 'gil:3000'], ['flamberge', 'hiether'], ['sagerobe', 'phoenix'], ['zeus', 'elixir'], ['lifecharm', 'xpotion']] },
  dungeon5: { theme: 'rift', floors: 6, zone: 'd5', boss: 'boss5', bossLook: { cast: 'villain1' },
    loot: [['crystalsaber', 'xpotion'], ['starrod', 'hiether'], ['seraphstaff', 'elixir'], ['shadowblade', 'crystalmail'],
      ['lumenrobe', 'shadowgarb'], ['megalixir', 'elixir']] },
  secret: { theme: 'shrine', floors: 3, zone: 'ds', boss: 'bossS', bossLook: { kind: 'golem', pal: ENEMIES.boss_forgotten.pal },
    loot: [['dawnedge', 'riftscepter'], ['luminastaff', 'moonfang'], ['dawnarmor', 'riftrobe', 'phantomgarb', 'megalixir']] }
};

function buildDungeonFloor(did, floor) {
  const def = DUNGEONS[did], last = floor === def.floors - 1;
  const r = mulberry32(hashStr(did + ':' + floor));
  const W = last ? 30 : 40, H = last ? 22 : 30;
  const g = new Array(W * H).fill('dtop');
  const rooms = [];
  const want = last ? 4 : 7 + Math.floor(r() * 3);
  for (let tries = 0; rooms.length < want && tries < 400; tries++) {
    const w = 4 + Math.floor(r() * 5), h = 3 + Math.floor(r() * 4);
    const x = 1 + Math.floor(r() * (W - w - 2)), y = 2 + Math.floor(r() * (H - h - 3));
    if (rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  const carve = (x, y) => { if (x > 0 && y > 1 && x < W - 1 && y < H - 1) g[y * W + x] = 'dfloor'; };
  for (const o of rooms) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) carve(x, y);
  rooms.sort((a, b) => a.cx - b.cx || a.cy - b.cy);
  const link = (a, b) => {
    let x = a.cx, y = a.cy; const hFirst = r() < 0.5;
    const stepX = () => { while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); } };
    const stepY = () => { while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); } };
    if (hFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    carve(x, y);
  };
  for (let i = 1; i < rooms.length; i++) link(rooms[i - 1], rooms[i]);
  if (!last && rooms.length > 3) link(rooms[0], rooms[2 + Math.floor(r() * (rooms.length - 2))]);
  // distances from the first room to place the exit far away
  const dist = new Array(W * H).fill(-1), q = [[rooms[0].cx, rooms[0].cy]]; dist[rooms[0].cy * W + rooms[0].cx] = 0;
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, i = ny * W + nx;
      if (g[i] === 'dfloor' && dist[i] < 0) { dist[i] = dist[y * W + x] + 1; q.push([nx, ny]); }
    }
  }
  const far = rooms.slice(1).sort((a, b) => dist[b.cy * W + b.cx] - dist[a.cy * W + a.cx]);
  const start = rooms[0], end = far[0];
  // wall faces: rock directly above a floor tile
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++)
    if (g[y * W + x] === 'dtop' && g[(y + 1) * W + x] !== 'dtop') g[y * W + x] = 'dwall';
  g[start.cy * W + start.cx] = 'stairsup';
  const objs = [];
  if (!last) g[end.cy * W + end.cx] = 'stairsdown';
  else objs.push({ type: 'boss', x: end.cx, y: end.cy });
  if (last) { const cx = start.cx + 1 < start.x + start.w ? start.cx + 1 : start.cx - 1; g[(start.cy) * W + cx] = 'crystal'; }
  // chests in other rooms, placed on a room corner so they never block a corridor
  const loot = def.loot[floor] || [];
  const chestRooms = far.slice(1).concat([end]).filter(o => o !== start);
  loot.forEach((item, i) => {
    const o = chestRooms[i % chestRooms.length]; if (!o) return;
    const spots = [[o.x, o.y], [o.x + o.w - 1, o.y], [o.x, o.y + o.h - 1], [o.x + o.w - 1, o.y + o.h - 1]];
    for (const [x, y] of spots) {
      if (g[y * W + x] !== 'dfloor' || objs.some(c => c.x === x && c.y === y)) continue;
      // keep it off corridor entrances: needs at most 2 floor neighbours
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => (g[(y + dy) * W + x + dx] || '').startsWith('d') && g[(y + dy) * W + x + dx] === 'dfloor').length;
      if (n > 2) continue;
      objs.push({ type: 'chest', x, y, item, key: `chest:${did}:${floor}:${i}` }); break;
    }
  });
  return {
    id: did + ':' + floor, dungeon: did, floor, type: 'dungeon', w: W, h: H, tiles: g, objs,
    theme: THEMES[def.theme], zone: def.zone, music: last ? 'dungeon' : 'dungeon',
    start: { x: start.cx, y: start.cy + 1 < start.y + start.h ? start.cy + 1 : start.cy, dir: 'down' },
    up: { x: start.cx, y: start.cy }, down: last ? null : { x: end.cx, y: end.cy }, last
  };
}
