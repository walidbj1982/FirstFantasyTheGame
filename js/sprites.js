// Procedural pixel art: characters (built from CAST looks), monsters, map tiles, faces.
'use strict';

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function shade(hex, f) {
  let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const m = v => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255);
  return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function paintGrid(c2, rows, pal, ox = 0, oy = 0, flip = false) {
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[flip ? 15 - x : x];
      if (!ch || ch === '.' || !pal[ch]) continue;
      c2.fillStyle = pal[ch]; c2.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

// ------------------------------------------------------------ characters
const HEADS = {
  short: {
    down: ['.....KKKKKK.....', '...KKHHHHHHKK...', '..KHHHHHHHHHHK..', '..KHHHHHHHHHHK..', '.KHHhSSSSSShHHK.',
      '.KHSESSSSSSESHK.', '.KHSESSSSSSESHK.', '..KSSSSssSSSSK..', '...KKSSSSSSKK...'],
    up: ['.....KKKKKK.....', '...KKHHHHHHKK...', '..KHHHHHHHHHHK..', '..KHHHHHHHHHHK..', '.KHHHHHHHHHHHHK.',
      '.KHHHHHHHHHHHHK.', '.KHHhHHHHHHhHHK.', '..KhhHHHHHHhhK..', '...KKKSSSSKKK...'],
    side: ['.....KKKKKK.....', '...KKHHHHHHKK...', '..KHHHHHHHHHHK..', '..KHHHHHHHHHHK..', '.KHHHHHHhSSSSK..',
      '.KHHHHHSSSSESK..', '.KHHHHHSSSSESK..', '..KHHHSSSSSSK...', '...KKKSSSSKK....']
  }
};
HEADS.spiky = {
  down: ['..K..K.KK.K..K..', '.KHKKHKHHKHKKHK.', ...HEADS.short.down.slice(2)],
  up: ['..K..K.KK.K..K..', '.KHKKHKHHKHKKHK.', ...HEADS.short.up.slice(2)],
  side: ['....K..K.K......', '..KHKKHKHKKK....', ...HEADS.short.side.slice(2)]
};
HEADS.long = HEADS.short; HEADS.hood = HEADS.short;
const LONG_HAIR = {
  down: ['..KH........HK..', '..KH........HK..', '..Kh........hK..'],
  up: ['....KHHHHHHK....', '....KHHHHHHK....', '....KhhhhhhK....'],
  side: ['...KHH..........', '...KHH..........', '...Khh..........']
};
const BODIES = {
  down: [
    ['...KOOOAAOOOK...', '..KSOOOOOOOOSK..', '..KSKoOOOOoKSK..', '...KAAAAAAAAK...', '...KPPPKKPPPK...', '...KPPK..KPPK...', '...KKK....KKK...'],
    ['...KOOOAAOOOK...', '..KSOOOOOOOOSK..', '..KSKoOOOOoKSK..', '...KAAAAAAAAK...', '...KPPPKKPPPK...', '...KPPK..KKK....', '...KKK..........']
  ],
  up: [
    ['...KOOOOOOOOK...', '..KSOOOOOOOOSK..', '..KSKoOOOOoKSK..', '...KAAAAAAAAK...', '...KPPPKKPPPK...', '...KPPK..KPPK...', '...KKK....KKK...'],
    ['...KOOOOOOOOK...', '..KSOOOOOOOOSK..', '..KSKoOOOOoKSK..', '...KAAAAAAAAK...', '...KPPPKKPPPK...', '...KPPK..KKK....', '...KKK..........']
  ],
  side: [
    ['....KOOOOAOK....', '....KOOOSSK.....', '....KoOOOOK.....', '....KAAAAAK.....', '....KPPPPK......', '....KPKKPK......', '....KK..KK......'],
    ['....KOOOOAOK....', '....KOOOSSK.....', '....KoOOOOK.....', '....KAAAAAK.....', '...KPPKPPK......', '..KPPK..KPK.....', '..KK.....KK.....']
  ]
};
// battle poses (side view, facing right; mirrored when drawn facing left)
const POSE_BODIES = {
  attack: ['....KOOOOAOKSSK.', '....KOOOOOOKK...', '....KoOOOOK.....', '....KAAAAAK.....', '...KPPKPPK......', '..KPPK..KPK.....', '..KK.....KK.....'],
  cast: ['..KSKOOOOAOKSK..', '..KSKOOOOOOKSK..', '....KoOOOOK.....', '....KAAAAAK.....', '....KPPPPK......', '....KPKKPK......', '....KK..KK......'],
  hurt: ['.....KOOOOAOK...', '.....KOOOSSK....', '.....KoOOOOK....', '.....KAAAAAK....', '....KPPPPK......', '...KPK.KPK......', '...KK..KK.......']
};

function lookPalette(look) {
  const hood = look.hairStyle === 'hood';
  return {
    K: '#1a1420', S: look.skin, s: shade(look.skin, -0.18), E: look.eyes || '#202030', W: '#ffffff',
    H: hood ? look.outfit2 : look.hair, h: shade(hood ? look.outfit2 : look.hair, -0.3),
    O: look.outfit, o: look.outfit2 || shade(look.outfit, -0.3), A: look.accent || '#e0c050', P: look.pants || '#333'
  };
}
const SprCache = {};
// returns a 16x16 canvas; dir: down|up|left|right, frame 0..3, pose: walk|attack|cast|hurt
function charSprite(look, dir = 'down', frame = 0, pose = 'walk') {
  const key = JSON.stringify(look) + dir + frame + pose;
  if (SprCache[key]) return SprCache[key];
  const c = mkCanvas(16, 16), c2 = c.getContext('2d'), pal = lookPalette(look);
  const d = dir === 'left' || dir === 'right' ? 'side' : dir;
  const flip = dir === 'left';
  const style = HEADS[look.hairStyle] ? look.hairStyle : 'short';
  let body;
  if (pose !== 'walk' && POSE_BODIES[pose]) body = POSE_BODIES[pose];
  else {
    const f = frame % 4; const bs = BODIES[d];
    body = f === 1 ? bs[1] : f === 3 ? (d === 'side' ? bs[1] : bs[1].map(r => r.split('').reverse().join(''))) : bs[0];
  }
  paintGrid(c2, body, pal, 0, 9, flip);
  if (look.hairStyle === 'long') paintGrid(c2, LONG_HAIR[d], pal, 0, 9, flip);
  const yoff = pose === 'hurt' ? 1 : 0;
  paintGrid(c2, HEADS[style][d], pal, pose === 'hurt' ? (flip ? -1 : 1) : 0, yoff, flip);
  return (SprCache[key] = c);
}

// pixel face used when no portrait photo is supplied (32x32)
function genFace(look) {
  const key = 'face' + JSON.stringify(look);
  if (SprCache[key]) return SprCache[key];
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  const head = charSprite(look, 'down', 0);
  g.fillStyle = shade(look.outfit, -0.5); g.fillRect(0, 0, 32, 32);
  g.imageSmoothingEnabled = false;
  g.drawImage(head, 0, 0, 16, 11, 0, 2, 32, 22);
  g.drawImage(head, 0, 9, 16, 4, 0, 24, 32, 8);
  return (SprCache[key] = c);
}
function portraitOf(id) {
  const c = CAST[id]; if (!c) return null;
  return Img.get(c.portrait) || (typeof Portraits !== 'undefined' && Portraits.get(id)) || genFace(c.look);
}
function drawPortrait(id, x, y, size) {
  const p = portraitOf(id); if (!p) return;
  ctx.save(); ctx.imageSmoothingEnabled = !!(CAST[id] && (Img.get(CAST[id].portrait) || R3.ok));
  const sw = p.width || p.naturalWidth, sh = p.height || p.naturalHeight, s = Math.min(sw, sh);
  ctx.drawImage(p, (sw - s) / 2, (sh - s) / 2, s, s, x, y, size, size);
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 0.5, y - 0.5, size + 1, size + 1);
}

// ------------------------------------------------------------ monsters
const MON = {
  slime: ['................', '................', '................', '................', '.......KK.......', '......K33K......',
    '.....K3311K.....', '....K311111K....', '...K31111111K...', '..K1111111111K..', '..K11E1111E11K..', '.K111E1111E111K.',
    '.K11111WW11111K.', '.K2111111111 2K.', '..K2222222222K..', '...KKKKKKKKKK...'],
  bat: ['................', '................', '.K............K.', '.KK..........KK.', '.K1K..K..K..K1K.', '.K11K.K11K.K11K.',
    '.K111KK11KK111K.', '..K11K1111K11K..', '..K11K1E1EK11K..', '...K1K1111K1K...', '...KK.KWWK.KK...', '.....KK11KK.....',
    '.......KK.......', '................', '................', '................'],
  wolf: ['................', '................', '................', '..KK............', '..K1K....K......', '..K11KKKK1K.....',
    '.K1E1111111KKKK.', 'KW11111111111112K', '.KK21111111111K..', '..K221111111222K.', '...K22KKKKK22K...', '...K2K....K2K....',
    '...K2K....K2K...', '...KK.....KK....', '................', '................'],
  imp: ['................', '...K........K...', '...K1K....K1K...', '....K1KKKK1K....', '....K111111K....', '...K11E11E11K...',
    '...K111WW111K...', '....K111111K....', '..KK2K1111K2KK..', '.K2K.K1111K.K2K.', '.KK..K1111K..KK.', '.....K1AA1K.....',
    '.....K1KK1K.....', '....K11KK11K....', '....KKK..KKK....', '................'],
  plant: ['................', '.....KK..KK.....', '....K33KK33K....', '....K3111113K...', '...K11E11E11K...', '...K1111111K....',
    '....K1WWWW1K....', '.....K1111K.....', '..KK..K22K..KK..', '.K22K.K22K.K22K.', '..K22KK22KK22K..', '...KK2K22K2KK...',
    '.....KAAAAK.....', '....KAAAAAAK....', '....KKKKKKKK....', '................'],
  golem: ['................', '.....KKKKKK.....', '....K333333K....', '....K1E11E1K....', '....K111111K....', '..KKK222222KKK..',
    '.K33K111111K33K.', '.K11K1A11A1K11K.', '.K11K111111K11K.', '.K22K111111K22K.', '.KKKK222222KKKK.', '....K11KK11K....',
    '....K11KK11K....', '...K222KK222K...', '...KKKK..KKKK...', '................'],
  skeleton: ['................', '.....KKKKKK.....', '....KWWWWWWK....', '....KWKWWKWK....', '....KWWWWWWK....', '.....KWKKWK.....',
    '......KWWK......', '...KKKWWWWKKK...', '..KW.K1W1WK.WK..', '..KW.KWWWWK.WK..', '..K1..KWWK..1K..', '.....KWKKWK.....',
    '.....KWKKWK.....', '.....KWKKWK.....', '....KKK..KKK....', '................'],
  eye: ['................', '................', '.....KKKKKK.....', '...KK333333KK...', '..K3311111133K..', '.K311WWWWWW113K.',
    '.K11WWWKKWWW11K.', '.K11WWKEEKWW11K.', '.K11WWKEEKWW11K.', '.K11WWWKKWWW11K.', '.K211WWWWWW112K.', '..K2211111122K..',
    '...KK222222KK...', '..K2KKKKKKKK2K..', '.K2K..K22K..K2K.', '................'],
  snake: ['................', '.........KKKK...', '........K1111K..', '.......K1E11E1K.', '.......K111111K.', '........KW11WK..',
    '.........K11K...', '....KKKK.K11K...', '...K1111KK11K...', '..K11KK11111K...', '..K1K..KK11K....', '..K11K...KK.....',
    '...K111KKKKKK...', '....K2222222K...', '.....KKKKKKK....', '................'],
  crab: ['................', '................', '.KK..........KK.', 'K11K........K11K', 'K1K1K......K1K1K', '.K11K......K11K.',
    '..K1K.K..K.K1K..', '...KKEKKKKEKK...', '...K11111111K...', '..K3111111113K..', '..K1111111111K..', '...K22222222K...',
    '..K.K.K..K.K.K..', '.K..K.K..K.K..K.', '................', '................'],
  wraith: ['................', '.....KKKKKK.....', '....K333333K....', '...K31111113K...', '...K1KK11KK1K...', '...K1EK11KE1K...',
    '...K11111111K...', '..KK1KWWWWK1KK..', '.K1K11111111K1K.', '.K1K21111112K1K.', '..K.K211112K.K..', '....K221122K....',
    '....K2K22K2K....', '.....K.KK.K.....', '......K..K......', '................'],
  knight: ['................', '.....KKKKKK.....', '....K333333K....', '....K1KKKK1K....', '....K1EKKE1K....', '....K111111K....',
    '..KKKK1AA1KKKK..', '.KW3K111111K33K.', '.KW3K1AAAA1K11K.', '.KW3K111111K11K.', '.KW.K222222KKKK.', '.KW..K11K11K....',
    '.KK..K11K11K....', '.....K22K22K....', '....KKKK.KKKK...', '................'],
  dragon: ['................', '..K.......KK....', '.K1K.....K11K...', 'K1K1K...K1E1K...', 'K11K1K.K11111K..', '.K111KK11WW1K...',
    '..K11111111K....', '..K1111111K.KK..', '...K11111111K1K.', '..KK1111111111K.', '.K2KK1111111K1K.', '.K2K.K11AA11KK..',
    '..KK.K1AAAA1K...', '.....K2K..K2K...', '....KKK...KKK...', '................']
};

const MonCache = {};
function monSprite(kind, pal) {
  const key = kind + JSON.stringify(pal);
  if (MonCache[key]) return MonCache[key];
  const c = mkCanvas(16, 16), g = c.getContext('2d');
  const p = { K: '#120c18', '1': pal[0], '2': pal[1] || shade(pal[0], -0.35), '3': pal[2] || shade(pal[0], 0.35),
    A: pal[3] || '#e0c040', E: pal[4] || '#ff3030', W: '#f0f0f0' };
  paintGrid(g, MON[kind] || MON.slime, p);
  return (MonCache[key] = c);
}

// ------------------------------------------------------------ tiles
const T = 16;
const TILE = {};   // id -> { solid, draw(g, frame) }
function defTile(id, solid, fn, extra = {}) { TILE[id] = { id, solid, fn, ...extra }; }
const TileCache = {};
function tileCanvas(id, frame = 0, theme = null) {
  const def = TILE[id] || TILE.void;
  const f = def.anim ? frame % def.anim : 0;
  const key = id + '|' + f + '|' + (def.themed && theme ? theme.id : '');
  if (TileCache[key]) return TileCache[key];
  const c = mkCanvas(T, T), g = c.getContext('2d');
  const r = mulberry32(hashStr(id) + f * 7);
  def.fn(g, r, f, theme || THEMES.cave);
  return (TileCache[key] = c);
}
const px = (g, x, y, col, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
function speckle(g, r, base, cols, n) { px(g, 0, 0, base, 16, 16); for (let i = 0; i < n; i++) px(g, r() * 16 | 0, r() * 16 | 0, pick2(r, cols)); }
const pick2 = (r, a) => a[Math.floor(r() * a.length)];
function treeShape(g, ox, oy, leaf, dark, trunk = '#5a3a1a') {
  px(g, ox + 6, oy + 11, trunk, 4, 4);
  px(g, ox + 2, oy + 4, dark, 12, 8); px(g, ox + 4, oy + 1, dark, 8, 12);
  px(g, ox + 3, oy + 4, leaf, 10, 6); px(g, ox + 5, oy + 2, leaf, 6, 9);
  px(g, ox + 5, oy + 3, shade(leaf, 0.3), 3, 2);
}
function mountainShape(g, base, snow) {
  for (let y = 0; y < 14; y++) { const w = Math.floor((y + 2) * 0.55); px(g, 8 - w, y + 2, y < 4 ? snow : base, w * 2, 1); px(g, 8, y + 2, shade(base, -0.3), w, 1); }
}
function waterFn(g, r, f) {
  px(g, 0, 0, '#2a5ac8', 16, 16);
  for (let i = 0; i < 4; i++) { const y = (i * 4 + f * 2) % 16; px(g, (i * 5 + f * 3) % 12, y, '#5a8ae8', 4, 1); }
}
defTile('void', true, g => px(g, 0, 0, '#000', 16, 16));
defTile('water', true, waterFn, { anim: 2 });
defTile('grass', false, (g, r) => speckle(g, r, '#4a9a3a', ['#5aaa4a', '#3a8a2e', '#6aba4a'], 14));
defTile('flowers', false, (g, r) => { speckle(g, r, '#4a9a3a', ['#5aaa4a', '#3a8a2e'], 10); for (let i = 0; i < 4; i++) px(g, r() * 14 | 0, r() * 14 | 0, pick2(r, ['#f0e040', '#f06080', '#ffffff']), 2, 2); });
defTile('forest', false, (g, r) => { px(g, 0, 0, '#2a6a2a', 16, 16); treeShape(g, -3, -2, '#2e8a32', '#14481a'); treeShape(g, 5, 3, '#38963a', '#14481a'); });
defTile('tree', true, (g, r) => { speckle(g, r, '#4a9a3a', ['#3a8a2e'], 8); treeShape(g, 0, 0, '#2e8a32', '#14481a'); });
defTile('mountain', true, (g, r) => { speckle(g, r, '#4a9a3a', ['#3a8a2e'], 6); mountainShape(g, '#8a6a4a', '#e8e8f0'); });
defTile('sand', false, (g, r) => speckle(g, r, '#e0c070', ['#d0b060', '#f0d890'], 16));
defTile('dune', false, (g, r) => { speckle(g, r, '#e0c070', ['#d0b060'], 10); px(g, 2, 9, '#c8a050', 12, 2); px(g, 4, 8, '#f0d890', 8, 1); });
defTile('cactus', true, (g, r) => { speckle(g, r, '#e0c070', ['#d0b060'], 10); px(g, 7, 3, '#2a7a3a', 3, 12); px(g, 3, 6, '#2a7a3a', 2, 5); px(g, 3, 10, '#2a7a3a', 5, 2); px(g, 11, 5, '#2a7a3a', 2, 4); px(g, 9, 8, '#2a7a3a', 4, 2); });
defTile('dmountain', true, (g, r) => { speckle(g, r, '#e0c070', ['#d0b060'], 6); mountainShape(g, '#a05a3a', '#c07a4a'); });
defTile('snow', false, (g, r) => speckle(g, r, '#e8eef8', ['#d0dcf0', '#ffffff'], 14));
defTile('snowtree', false, (g, r) => { speckle(g, r, '#e8eef8', ['#d0dcf0'], 8); treeShape(g, 0, 0, '#2a6a5a', '#143a30'); px(g, 5, 2, '#fff', 6, 2); px(g, 3, 5, '#fff', 4, 1); px(g, 9, 6, '#fff', 4, 1); });
defTile('smountain', true, (g, r) => { speckle(g, r, '#e8eef8', ['#d0dcf0'], 6); mountainShape(g, '#7a8aa0', '#ffffff'); });
defTile('waste', false, (g, r) => speckle(g, r, '#3a2a40', ['#4a3050', '#2a1a30', '#6a3a5a'], 20));
defTile('wmountain', true, (g, r) => { speckle(g, r, '#3a2a40', ['#2a1a30'], 6); mountainShape(g, '#2a1a2a', '#8a2a4a'); });
defTile('road', false, (g, r) => speckle(g, r, '#c8a878', ['#b89868', '#d8b888'], 12));
defTile('bridgeH', false, g => { px(g, 0, 0, '#2a5ac8', 16, 16); px(g, 0, 3, '#8a5a2a', 16, 10); for (let x = 0; x < 16; x += 4) px(g, x, 3, '#5a3a1a', 1, 10); px(g, 0, 3, '#5a3a1a', 16, 1); px(g, 0, 12, '#5a3a1a', 16, 1); });
defTile('bridgeV', false, g => { px(g, 0, 0, '#2a5ac8', 16, 16); px(g, 3, 0, '#8a5a2a', 10, 16); for (let y = 0; y < 16; y += 4) px(g, 3, y, '#5a3a1a', 10, 1); px(g, 3, 0, '#5a3a1a', 1, 16); px(g, 12, 0, '#5a3a1a', 1, 16); });
defTile('brokenbridge', true, (g, r, f) => { waterFn(g, r, f); px(g, 3, 2, '#5a3a1a', 2, 4); px(g, 11, 9, '#5a3a1a', 2, 4); px(g, 6, 6, '#8a5a2a', 4, 2); }, { anim: 2 });
defTile('boulder', true, (g, r) => { speckle(g, r, '#c8a878', ['#b89868'], 8); px(g, 2, 3, '#4a4a52', 12, 11); px(g, 1, 6, '#4a4a52', 14, 6); px(g, 3, 4, '#7a7a88', 9, 6); px(g, 4, 5, '#9a9aa8', 4, 2); });
defTile('icewall', true, (g, r) => { speckle(g, r, '#c8c8d8', ['#b0b0c0'], 6); px(g, 1, 1, '#80c0f0', 14, 14); px(g, 3, 2, '#c0e8ff', 3, 10); px(g, 9, 4, '#c0e8ff', 2, 8); px(g, 1, 1, '#4080c0', 14, 1); });
defTile('riftwall', true, (g, r, f) => { px(g, 0, 0, '#1a0a20', 16, 16); for (let i = 0; i < 5; i++) px(g, (r() * 14 | 0), ((r() * 14 | 0) + f * 3) % 14, f ? '#c040ff' : '#8020c0', 2, 3); }, { anim: 2 });
defTile('lightbridge', false, (g, r, f) => { px(g, 0, 0, '#1a0a20', 16, 16); px(g, 0, 3, f ? '#f0e0ff' : '#c0a0ff', 16, 10); px(g, 0, 7, '#ffffff', 16, 2); }, { anim: 2 });
// world map locations
function townIcon(g, ground, roof) { px(g, 0, 0, ground, 16, 16); px(g, 1, 8, '#e8d8b8', 6, 6); px(g, 0, 5, roof, 8, 4); px(g, 9, 7, '#e8d8b8', 6, 7); px(g, 8, 4, roof, 8, 4); px(g, 3, 11, '#5a3a1a', 2, 3); px(g, 11, 10, '#5a3a1a', 2, 4); }
defTile('town1', false, g => townIcon(g, '#4a9a3a', '#c04030'));
defTile('town2', false, g => townIcon(g, '#4a9a3a', '#3060c0'));
defTile('town3', false, g => townIcon(g, '#e8eef8', '#4a6a8a'));
defTile('town4', false, g => townIcon(g, '#e0c070', '#c08030'));
function caveIcon(g, ground, rock) { px(g, 0, 0, ground, 16, 16); mountainShape(g, rock, shade(rock, 0.3)); px(g, 5, 9, '#000', 6, 7); px(g, 6, 8, '#000', 4, 1); }
defTile('cave1', false, g => { px(g, 0, 0, '#2a6a2a', 16, 16); treeShape(g, -4, -2, '#1e6a22', '#0a3810'); treeShape(g, 4, -2, '#1e6a22', '#0a3810'); px(g, 5, 9, '#0a1a0a', 6, 7); });
defTile('cave2', false, g => caveIcon(g, '#4a9a3a', '#6a6a7a'));
defTile('cave3', false, g => { px(g, 0, 0, '#e8eef8', 16, 16); px(g, 3, 4, '#80b0e0', 10, 12); px(g, 2, 2, '#a0d0f0', 3, 4); px(g, 11, 2, '#a0d0f0', 3, 4); px(g, 6, 9, '#203050', 4, 7); });
defTile('cave4', false, g => { px(g, 0, 0, '#e0c070', 16, 16); px(g, 2, 6, '#b07040', 12, 10); px(g, 4, 3, '#c08050', 8, 3); px(g, 6, 10, '#301810', 4, 6); px(g, 2, 6, '#e06020', 2, 2); px(g, 12, 6, '#e06020', 2, 2); });
defTile('cave5', false, (g, r, f) => { px(g, 0, 0, '#3a2a40', 16, 16); px(g, 4, 1, '#1a0a20', 8, 15); px(g, 6, 0, '#1a0a20', 4, 1); px(g, 2, 6, '#1a0a20', 12, 10); px(g, 7, 4, f ? '#ff40ff' : '#a020c0', 2, 2); px(g, 6, 11, '#000', 4, 5); }, { anim: 2 });
defTile('shrine', false, g => { px(g, 0, 0, '#e8eef8', 16, 16); px(g, 2, 5, '#a0a0b0', 12, 10); px(g, 1, 3, '#606070', 14, 2); px(g, 3, 6, '#808090', 2, 9); px(g, 11, 6, '#808090', 2, 9); px(g, 6, 9, '#202030', 4, 6); });

// town tiles (ground depends on town theme)
defTile('tground', false, (g, r, f, th) => speckle(g, r, th.ground, th.groundSpots, 12), { themed: true });
defTile('tpath', false, (g, r) => { speckle(g, r, '#c8b090', ['#b8a080', '#d8c0a0'], 10); px(g, 0, 0, '#a89070', 16, 1); });
defTile('ttree', true, (g, r, f, th) => { speckle(g, r, th.ground, th.groundSpots, 6); treeShape(g, 0, 0, th.leaf, shade(th.leaf, -0.5)); }, { themed: true });
defTile('roof', true, (g, r, f, th) => { px(g, 0, 0, th.roof, 16, 16); for (let y = 2; y < 16; y += 4) px(g, 0, y, shade(th.roof, -0.3), 16, 1); for (let y = 0; y < 16; y += 4) for (let x = (y / 4 % 2) * 4; x < 16; x += 8) px(g, x, y, shade(th.roof, -0.3), 1, 3); }, { themed: true });
defTile('wall', true, (g, r, f, th) => { px(g, 0, 0, th.wall, 16, 16); px(g, 0, 15, shade(th.wall, -0.4), 16, 1); px(g, 0, 0, shade(th.wall, -0.2), 1, 16); }, { themed: true });
defTile('window', true, (g, r, f, th) => { px(g, 0, 0, th.wall, 16, 16); px(g, 4, 4, '#3a2a1a', 8, 8); px(g, 5, 5, '#f0d070', 6, 6); px(g, 7, 5, '#3a2a1a', 1, 6); px(g, 5, 8, '#3a2a1a', 6, 1); }, { themed: true });
defTile('door', true, (g, r, f, th) => { px(g, 0, 0, th.wall, 16, 16); px(g, 3, 2, '#5a3a1a', 10, 14); px(g, 4, 3, '#7a4a2a', 8, 13); px(g, 10, 9, '#e0c050', 2, 2); }, { themed: true });
defTile('counter', true, g => { px(g, 0, 0, '#c8b090', 16, 16); px(g, 0, 4, '#7a4a2a', 16, 10); px(g, 0, 4, '#a06a3a', 16, 3); px(g, 0, 14, '#3a2a1a', 16, 2); });
defTile('fountain', true, (g, r, f) => { px(g, 0, 0, '#c8b090', 16, 16); px(g, 1, 3, '#909098', 14, 12); px(g, 3, 5, f ? '#5a8ae8' : '#2a5ac8', 10, 8); px(g, 7, 1, '#909098', 2, 8); px(g, 6 + f, 0, '#a0d0ff', 2, 3); }, { anim: 2 });
defTile('fence', true, (g, r, f, th) => { speckle(g, r, th.ground, th.groundSpots, 8); px(g, 0, 6, '#8a5a2a', 16, 2); px(g, 0, 11, '#8a5a2a', 16, 2); px(g, 2, 4, '#6a4a2a', 2, 11); px(g, 12, 4, '#6a4a2a', 2, 11); }, { themed: true });
defTile('tflower', false, (g, r, f, th) => { speckle(g, r, th.ground, th.groundSpots, 8); for (let i = 0; i < 5; i++) px(g, r() * 14 | 0, r() * 14 | 0, pick2(r, th.flowers), 2, 2); }, { themed: true });
defTile('sign', true, (g, r, f, th) => { speckle(g, r, th.ground, th.groundSpots, 8); px(g, 7, 8, '#5a3a1a', 2, 8); px(g, 2, 2, '#8a5a2a', 12, 7); px(g, 3, 3, '#b07a4a', 10, 5); });
defTile('well', true, (g, r, f, th) => { speckle(g, r, th.ground, th.groundSpots, 8); px(g, 3, 6, '#808088', 10, 9); px(g, 4, 7, '#101830', 8, 4); px(g, 3, 1, '#5a3a1a', 1, 6); px(g, 12, 1, '#5a3a1a', 1, 6); px(g, 2, 0, '#8a3a2a', 12, 2); });

// dungeon tiles (colours come from the dungeon theme)
defTile('dfloor', false, (g, r, f, th) => { speckle(g, r, th.floor, th.floorSpots, 14); px(g, 0, 0, shade(th.floor, -0.15), 16, 1); px(g, 0, 0, shade(th.floor, -0.15), 1, 16); }, { themed: true });
defTile('dwall', true, (g, r, f, th) => { px(g, 0, 0, th.wall, 16, 16); for (let y = 0; y < 16; y += 4) { px(g, 0, y, shade(th.wall, -0.3), 16, 1); for (let x = (y / 4 % 2) * 4; x < 16; x += 8) px(g, x, y, shade(th.wall, -0.3), 1, 4); } px(g, 0, 0, shade(th.wall, 0.2), 16, 1); }, { themed: true });
defTile('dtop', true, (g, r, f, th) => { px(g, 0, 0, th.top, 16, 16); for (let i = 0; i < 6; i++) px(g, r() * 15 | 0, r() * 15 | 0, shade(th.top, 0.15), 1, 1); }, { themed: true });
defTile('stairsdown', false, (g, r, f, th) => { px(g, 0, 0, th.floor, 16, 16); for (let i = 0; i < 4; i++) px(g, 2 + i, 3 + i * 3, shade(th.floor, -0.25 - i * 0.15), 12 - i * 2, 3); px(g, 2, 2, '#000', 12, 1); }, { themed: true });
defTile('stairsup', false, (g, r, f, th) => { px(g, 0, 0, th.floor, 16, 16); for (let i = 0; i < 4; i++) px(g, 5 - i, 3 + i * 3, shade(th.floor, 0.1 + i * 0.1), 6 + i * 2, 3); }, { themed: true });
defTile('chest', true, (g, r, f, th) => { px(g, 0, 0, th.floor, 16, 16); px(g, 2, 5, '#1a1008', 12, 10); px(g, 3, 6, '#a0602a', 10, 8); px(g, 3, 6, '#c07a3a', 10, 3); px(g, 3, 9, '#e0c050', 10, 1); px(g, 7, 8, '#f0e070', 2, 3); }, { themed: true });
defTile('chestopen', true, (g, r, f, th) => { px(g, 0, 0, th.floor, 16, 16); px(g, 2, 3, '#1a1008', 12, 12); px(g, 3, 4, '#5a3010', 10, 4); px(g, 3, 9, '#a0602a', 10, 5); px(g, 3, 9, '#e0c050', 10, 1); }, { themed: true });
defTile('crystal', true, (g, r, f, th) => { px(g, 0, 0, th.floor, 16, 16); px(g, 3, 13, '#606070', 10, 3); const c = f ? '#80f0ff' : '#40b0f0'; px(g, 6, 2, c, 4, 11); px(g, 5, 4, c, 6, 7); px(g, 7, 3, '#ffffff', 1, 6); }, { themed: true, anim: 2 });
defTile('portal', false, (g, r, f, th) => { px(g, 0, 0, th.floor, 16, 16); px(g, 2, 2, f ? '#ffffff' : '#a0f0ff', 12, 12); px(g, 4, 4, f ? '#80d0ff' : '#ffffff', 8, 8); px(g, 6, 6, '#4080ff', 4, 4); }, { themed: true, anim: 2 });
defTile('lava', true, (g, r, f) => { px(g, 0, 0, '#c02a0a', 16, 16); for (let i = 0; i < 5; i++) px(g, (i * 5 + f * 3) % 14, (i * 3 + f * 5) % 14, '#f0a020', 3, 2); }, { anim: 2 });
defTile('dwater', true, waterFn, { anim: 2 });

const THEMES = {
  woods: { id: 'woods', floor: '#4a7a32', floorSpots: ['#3a6a2a', '#5a8a3a'], wall: '#2a4a1a', top: '#143a14', hazard: 'dwater' },
  cave: { id: 'cave', floor: '#5a6a7a', floorSpots: ['#4a5a6a', '#6a7a8a'], wall: '#3a4a5a', top: '#1a2028', hazard: 'dwater' },
  ice: { id: 'ice', floor: '#b0d0e8', floorSpots: ['#a0c0e0', '#d0e8f8'], wall: '#6090c0', top: '#203a5a', hazard: 'dwater' },
  ruins: { id: 'ruins', floor: '#b08050', floorSpots: ['#a07040', '#c09060'], wall: '#7a4a2a', top: '#2a1408', hazard: 'lava' },
  rift: { id: 'rift', floor: '#3a2a4a', floorSpots: ['#4a3a5a', '#2a1a3a', '#6a2a6a'], wall: '#5a2a6a', top: '#0a0010', hazard: 'lava' },
  shrine: { id: 'shrine', floor: '#909098', floorSpots: ['#80808a', '#a0a0a8'], wall: '#606070', top: '#101018', hazard: 'dwater' },
  town_grass: { id: 'town_grass', ground: '#5aa04a', groundSpots: ['#4a904a', '#6ab05a'], leaf: '#2e8a32', roof: '#b04030', wall: '#e8d8b8', flowers: ['#f0e040', '#f06080', '#fff'] },
  town_port: { id: 'town_port', ground: '#5aa04a', groundSpots: ['#4a904a', '#6ab05a'], leaf: '#2e8a32', roof: '#3060b0', wall: '#f0f0e8', flowers: ['#80c0ff', '#ffffff'] },
  town_snow: { id: 'town_snow', ground: '#e8eef8', groundSpots: ['#d0dcf0', '#ffffff'], leaf: '#2a6a5a', roof: '#4a6a8a', wall: '#c8b8a0', flowers: ['#a0d0ff', '#ffffff'] },
  town_sand: { id: 'town_sand', ground: '#e0c070', groundSpots: ['#d0b060', '#f0d890'], leaf: '#3a8a3a', roof: '#c08030', wall: '#f0e0c0', flowers: ['#f06030', '#f0e040'] }
};
