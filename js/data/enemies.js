// Monsters, bosses and encounter zones.
// Stats are derived from the level; `hp` and `mod` are multipliers on that baseline.
// el: element multipliers (2 = weak, 0.5 = resist, 0 = immune, -1 = absorb)
// Bosses that are characters from the movie use  kind: 'human', cast: '<cast id>'
'use strict';

const ENEMIES = {
  // ---- Region 1: around the first village
  jelly: { name: 'Green Jelly', kind: 'slime', pal: ['#58c050'], lv: 1, hp: 0.9, el: { fire: 1.5 }, skills: [['attack', 1]], drop: ['potion', 0.15] },
  cavebat: { name: 'Cave Bat', kind: 'bat', pal: ['#806040'], lv: 2, hp: 0.7, mod: { spd: 1.4 }, skills: [['attack', 3], ['bite', 1]], drop: ['antidote', 0.1] },
  goblin: { name: 'Goblin', kind: 'imp', pal: ['#5a9a3a'], lv: 2, hp: 1, skills: [['attack', 1]], steal: 'potion', drop: ['potion', 0.15] },
  hound: { name: 'Wild Hound', kind: 'wolf', pal: ['#9a7a5a'], lv: 3, hp: 1, mod: { spd: 1.2 }, skills: [['attack', 3], ['bite', 1]] },
  // ---- Whisper Woods
  mandrake: { name: 'Mandrake', kind: 'plant', pal: ['#d06080', '#2a7a2a'], lv: 4, hp: 1, el: { fire: 2 }, skills: [['attack', 3], ['sleepspore', 1]], steal: 'eyedrop' },
  timberwolf: { name: 'Timber Wolf', kind: 'wolf', pal: ['#7a7a7a'], lv: 5, hp: 1.1, mod: { spd: 1.3 }, skills: [['attack', 3], ['bite', 2]] },
  stinger: { name: 'Stinger', kind: 'bat', pal: ['#d0b030', '#806010'], lv: 4, hp: 0.8, mod: { spd: 1.4 }, skills: [['attack', 2], ['sting', 1]], drop: ['antidote', 0.25] },
  hobgoblin: { name: 'Hobgoblin', kind: 'imp', pal: ['#b05030'], lv: 6, hp: 1.2, mod: { str: 1.2 }, skills: [['attack', 3], ['tackle', 1]], steal: 'potion', drop: ['potion', 0.2] },
  mossling: { name: 'Mossling', kind: 'golem', pal: ['#5a8a3a', '#3a5a2a', '#8aba5a'], lv: 6, hp: 1.6, mod: { def: 1.5, spd: 0.7 }, el: { fire: 2, earth: 0.5 }, skills: [['attack', 2], ['tackle', 1]] },
  // ---- Region 2: coast
  shorecrab: { name: 'Shore Crab', kind: 'crab', pal: ['#d05030'], lv: 7, hp: 1.1, mod: { def: 1.8 }, el: { bolt: 2, water: 0 }, skills: [['attack', 2], ['claw', 1]] },
  harpy: { name: 'Harpy', kind: 'bat', pal: ['#c08060', '#7a4030'], lv: 8, hp: 1, mod: { spd: 1.3 }, skills: [['attack', 3], ['claw', 1]], steal: 'echo' },
  sahagin: { name: 'Sahagin', kind: 'imp', pal: ['#3a8ab0'], lv: 9, hp: 1.1, el: { bolt: 2, water: -1 }, skills: [['attack', 3], ['watergun', 1]], steal: 'potion' },
  brinejelly: { name: 'Brine Jelly', kind: 'slime', pal: ['#4080e0'], lv: 8, hp: 1.2, el: { bolt: 2, water: -1, fire: 0.5 }, skills: [['attack', 2], ['watergun', 1]] },
  // ---- Sunken Grotto
  drowned: { name: 'Drowned Bones', kind: 'skeleton', pal: ['#80a0a0'], lv: 10, hp: 1.2, el: { holy: 3, fire: 1.5, dark: 0 }, skills: [['attack', 3], ['claw', 1]], drop: ['phoenix', 0.1] },
  gazer: { name: 'Gazer', kind: 'eye', pal: ['#a050c0'], lv: 11, hp: 1, mod: { mag: 1.2 }, skills: [['attack', 1], ['gaze', 1], ['watergun', 1]], steal: 'echo', drop: ['ether', 0.12] },
  moray: { name: 'Moray', kind: 'snake', pal: ['#4a8a6a'], lv: 11, hp: 1.1, el: { bolt: 2 }, skills: [['attack', 2], ['poisonbite', 1]] },
  ironcrab: { name: 'Iron Crab', kind: 'crab', pal: ['#8a8a9a'], lv: 12, hp: 1.3, mod: { def: 2.2 }, el: { bolt: 2 }, skills: [['claw', 2], ['harden', 1]] },
  seaghost: { name: 'Sea Ghost', kind: 'wraith', pal: ['#80c0e0'], lv: 12, hp: 1, mod: { def: 2 }, el: { holy: 3, fire: 2 }, skills: [['attack', 1], ['watergun', 2]], steal: 'ether' },
  // ---- Region 3: snowfields
  snowwolf: { name: 'Snow Wolf', kind: 'wolf', pal: ['#e0e8f0', '#a0b0c8'], lv: 14, hp: 1.1, mod: { spd: 1.3 }, el: { fire: 2, ice: 0 }, skills: [['bite', 2], ['attack', 2]] },
  icegolem: { name: 'Ice Golem', kind: 'golem', pal: ['#a0d0f0'], lv: 15, hp: 1.6, mod: { def: 1.6, spd: 0.7 }, el: { fire: 2, ice: -1 }, skills: [['attack', 2], ['tackle', 1]], drop: ['hipotion', 0.1] },
  frostwisp: { name: 'Frost Wisp', kind: 'wraith', pal: ['#c0f0ff'], lv: 15, hp: 0.9, mod: { mag: 1.2 }, el: { fire: 2, ice: -1 }, skills: [['blizzara', 2], ['attack', 1]], steal: 'ether' },
  yeti: { name: 'Yeti Imp', kind: 'imp', pal: ['#e8e8f0'], lv: 16, hp: 1.2, mod: { str: 1.2 }, el: { fire: 1.5, ice: 0.5 }, skills: [['attack', 2], ['tackle', 1]], steal: 'hipotion' },
  // ---- Frost Keep
  frostknight: { name: 'Frost Knight', kind: 'knight', pal: ['#8ab0d8'], lv: 18, hp: 1.3, mod: { def: 1.6 }, el: { fire: 1.5, ice: 0 }, skills: [['attack', 3], ['rage', 1]], drop: ['phoenix', 0.1] },
  wight: { name: 'Wight', kind: 'skeleton', pal: ['#b0c8e8'], lv: 18, hp: 1.2, el: { holy: 3, fire: 1.5, dark: 0 }, skills: [['attack', 2], ['doom', 1]] },
  crystaleye: { name: 'Crystal Eye', kind: 'eye', pal: ['#60e0e0'], lv: 19, hp: 1, mod: { mag: 1.3 }, el: { bolt: 2 }, skills: [['blizzara', 2], ['gaze', 1]], steal: 'hiether' },
  banshee: { name: 'Banshee', kind: 'wraith', pal: ['#d0d0f0'], lv: 20, hp: 1.1, mod: { def: 2 }, el: { holy: 3, fire: 1.5 }, skills: [['silencewave', 1], ['shadowbolt', 1], ['attack', 1]] },
  glaciergolem: { name: 'Glacier Golem', kind: 'golem', pal: ['#70a0e0'], lv: 20, hp: 1.8, mod: { def: 1.7, spd: 0.7 }, el: { fire: 2, ice: -1 }, skills: [['tackle', 2], ['frostbreath', 1]], drop: ['hipotion', 0.2] },
  // ---- Region 4: desert
  sandworm: { name: 'Sand Worm', kind: 'snake', pal: ['#c0a060'], lv: 22, hp: 1.4, el: { ice: 2, earth: 0 }, skills: [['bite', 2], ['quake', 1]] },
  scorpion: { name: 'Scorpion', kind: 'crab', pal: ['#a03020'], lv: 22, hp: 1.1, mod: { def: 1.4 }, el: { ice: 1.5 }, skills: [['attack', 2], ['sting', 2]], drop: ['antidote', 0.3] },
  cactoid: { name: 'Cactoid', kind: 'plant', pal: ['#40a040', '#2a6a2a'], lv: 23, hp: 1, mod: { spd: 1.5 }, el: { fire: 2 }, skills: [['attack', 2], ['sweep', 1]], steal: 'remedy' },
  firebat: { name: 'Fire Bat', kind: 'bat', pal: ['#e05020', '#801010'], lv: 24, hp: 1, mod: { spd: 1.4 }, el: { ice: 2, fire: -1 }, skills: [['bite', 2], ['fira', 1]] },
  // ---- Ember Ruins
  magmagolem: { name: 'Magma Golem', kind: 'golem', pal: ['#c04020', '#601a0a', '#f0a040'], lv: 26, hp: 1.8, mod: { def: 1.6, spd: 0.7 }, el: { ice: 2, fire: -1, water: 2 }, skills: [['tackle', 2], ['firebreath', 1]] },
  salamander: { name: 'Salamander', kind: 'snake', pal: ['#f06030'], lv: 26, hp: 1.2, el: { ice: 2, fire: -1 }, skills: [['bite', 2], ['fira', 1]], steal: 'bomb' },
  mummy: { name: 'Mummy', kind: 'skeleton', pal: ['#d8c8a0'], lv: 27, hp: 1.4, el: { fire: 2, holy: 3, dark: 0 }, skills: [['attack', 2], ['doom', 1]], drop: ['remedy', 0.2] },
  flamewraith: { name: 'Flame Wraith', kind: 'wraith', pal: ['#f08030'], lv: 28, hp: 1.1, mod: { mag: 1.2, def: 2 }, el: { ice: 2, holy: 2, fire: -1 }, skills: [['fira', 2], ['firebreath', 1]], steal: 'hiether' },
  ruinguard: { name: 'Ruin Guard', kind: 'knight', pal: ['#b08040'], lv: 28, hp: 1.5, mod: { def: 1.8, str: 1.2 }, el: { bolt: 1.5 }, skills: [['attack', 2], ['rage', 1], ['harden', 1]], drop: ['xpotion', 0.08] },
  // ---- Wasteland around the Rift
  wyvern: { name: 'Wyvern', kind: 'dragon', pal: ['#6a8a4a'], lv: 30, hp: 1.4, mod: { spd: 1.2 }, el: { ice: 1.5 }, skills: [['claw', 2], ['firebreath', 1]] },
  behemoth: { name: 'Behemoth', kind: 'wolf', pal: ['#6a3a8a', '#3a1a5a'], lv: 31, hp: 1.7, mod: { str: 1.3 }, skills: [['bite', 2], ['rage', 1], ['quake', 1]], drop: ['xpotion', 0.1] },
  voideye: { name: 'Void Eye', kind: 'eye', pal: ['#401060'], lv: 31, hp: 1.1, mod: { mag: 1.3 }, el: { holy: 2, dark: -1 }, skills: [['darkwave', 1], ['gaze', 1], ['slowga', 1]], steal: 'hiether' },
  // ---- Rift Citadel
  darkknight: { name: 'Dark Knight', kind: 'knight', pal: ['#3a3a4a', '#1a1a2a', '#6a6a7a', '#c02040'], lv: 33, hp: 1.6, mod: { def: 1.7, str: 1.3 }, el: { holy: 2, dark: 0 }, skills: [['attack', 2], ['rage', 1], ['shadowbolt', 1]], drop: ['xpotion', 0.12] },
  lich: { name: 'Lich', kind: 'wraith', pal: ['#6a2a8a'], lv: 33, hp: 1.3, mod: { mag: 1.4, def: 2 }, el: { holy: 3, dark: -1, fire: 1.5 }, skills: [['darkwave', 2], ['drain', 1], ['silencewave', 1]], steal: 'elixir' },
  chimera: { name: 'Chimera', kind: 'dragon', pal: ['#b06030', '#603010', '#e0a060', '#3060c0'], lv: 34, hp: 1.6, el: {}, skills: [['claw', 2], ['firebreath', 1], ['frostbreath', 1]] },
  riftgolem: { name: 'Rift Golem', kind: 'golem', pal: ['#5a2a7a', '#2a0a3a', '#a060e0'], lv: 34, hp: 2, mod: { def: 1.8, spd: 0.8 }, el: { holy: 2 }, skills: [['tackle', 2], ['quake', 1]], drop: ['hiether', 0.2] },
  riftdemon: { name: 'Rift Demon', kind: 'imp', pal: ['#8a1a3a', '#4a0a1a', '#e04060'], lv: 35, hp: 1.4, mod: { str: 1.2, mag: 1.2, spd: 1.2 }, el: { holy: 2, dark: -1 }, skills: [['attack', 2], ['shadowbolt', 1], ['firaga', 1]], steal: 'megalixir' },
  // ---- Forgotten Shrine (optional)
  elderdragon: { name: 'Elder Dragon', kind: 'dragon', pal: ['#d0b040', '#806010', '#fff0a0'], lv: 42, hp: 2.2, mod: { str: 1.2 }, skills: [['claw', 2], ['firebreath', 1], ['quake', 1]], drop: ['elixir', 0.2] },
  archlich: { name: 'Archlich', kind: 'wraith', pal: ['#202020', '#000000', '#606060', '#ff2020'], lv: 42, hp: 1.6, mod: { mag: 1.5, def: 2 }, el: { holy: 3, dark: -1 }, skills: [['darkwave', 2], ['oblivion', 1], ['slowga', 1]], steal: 'ribbon' },

  // ============================ BOSSES ============================
  boss_grimble: { name: null, cast: 'villain4', kind: 'human', boss: true, lv: 7, hp: 6.5, mod: { str: 1.3, def: 1.2 },
    skills: [['attack', 3], ['tackle', 1]], steal: 'powerband', gil: 400, exp: 3 },
  boss_serpent: { name: 'Abyss Serpent', kind: 'snake', pal: ['#2a6a9a', '#103a5a', '#60b0e0', '#e0e060'], boss: true, size: 5, lv: 14, hp: 7.5, mod: { mag: 1.3, str: 1.2 },
    el: { bolt: 2, water: -1, fire: 0.5 }, skills: [['bite', 2], ['tidal', 2], ['ink', 1], ['poisonbite', 1]],
    phases: [{ below: 0.4, skills: [['tidal', 3], ['bite', 2], ['selfheal', 1]] }], steal: 'starpendant', gil: 1500, exp: 3 },
  boss_hask: { name: null, cast: 'villain3', kind: 'human', boss: true, lv: 22, hp: 8, mod: { str: 1.25, mag: 1.2, def: 1.3 },
    el: { fire: 1.5, ice: -1 }, skills: [['attack', 2], ['blizzaga', 2], ['frostbreath', 1], ['harden', 1]],
    phases: [{ below: 0.5, skills: [['blizzaga', 3], ['rage', 2], ['slowga', 1]] }], minions: ['frostknight', 'frostknight'], steal: 'guardring', gil: 3500, exp: 3 },
  boss_sable: { name: null, cast: 'villain2', kind: 'human', boss: true, lv: 31, hp: 13, mod: { str: 1.45, mag: 1.3, def: 1.3, spd: 1.2 },
    el: { holy: 1.5, dark: 0 }, skills: [['attack', 3], ['shadowbolt', 2], ['doom', 1], ['ink', 1]],
    phases: [{ below: 0.5, skills: [['darkwave', 2], ['rage', 2], ['summon', 1], ['hasteself', 1]] }], summons: ['flamewraith', 'ruinguard'],
    steal: 'swiftanklet', gil: 7000, exp: 3 },
  boss_vexis: { name: null, cast: 'villain1', kind: 'human', boss: true, lv: 37, hp: 15, mod: { str: 1.4, mag: 1.5, def: 1.4, mdef: 1.4, spd: 1.2 },
    el: { holy: 1.5, dark: -1 }, skills: [['attack', 2], ['shadowbolt', 2], ['darkwave', 2], ['ward', 1]],
    phases: [{ below: 0.5, skills: [['riftstorm', 2], ['darkwave', 2], ['slowga', 1], ['silencewave', 1]] }], steal: 'elixir', gil: 0, exp: 2 },
  boss_vexis2: { name: null, cast: 'villain1', kind: 'dragon', pal: ['#7a2a9a', '#3a0a5a', '#d070ff', '#ff2060', '#ff2060'], boss: true, size: 6, lv: 40, hp: 13,
    mod: { str: 1.3, mag: 1.3, def: 1.4, mdef: 1.4, spd: 1.0 }, el: { holy: 1.5, dark: -1 },
    skills: [['claw', 2], ['riftstorm', 2], ['firebreath', 1], ['frostbreath', 1]],
    phases: [{ below: 0.35, skills: [['oblivion', 2], ['riftstorm', 2], ['rage', 2], ['selfheal', 1]] }], steal: 'megalixir', gil: 0, exp: 0 },
  boss_forgotten: { name: 'The Forgotten', kind: 'golem', pal: ['#e0c040', '#806010', '#fff8c0', '#ff4040'], boss: true, size: 6, lv: 50, hp: 22,
    mod: { str: 1.35, mag: 1.35, def: 1.6, mdef: 1.6 }, skills: [['tackle', 2], ['quake', 2], ['riftstorm', 1], ['harden', 1]],
    phases: [{ below: 0.4, skills: [['oblivion', 2], ['rage', 2], ['slowga', 1]] }], steal: 'ribbon', gil: 20000, exp: 4 }
};

// Encounter zones: pool of monsters and how many can appear at once.
const ZONES = {
  r1: { pool: ['jelly', 'jelly', 'cavebat', 'goblin', 'hound'], max: 3, bg: 'grass' },
  d1: { pool: ['mandrake', 'timberwolf', 'stinger', 'hobgoblin', 'mossling'], max: 3, bg: 'woods' },
  r2: { pool: ['shorecrab', 'harpy', 'sahagin', 'brinejelly'], max: 3, bg: 'grass' },
  d2: { pool: ['drowned', 'gazer', 'moray', 'ironcrab', 'seaghost'], max: 4, bg: 'cave' },
  r3: { pool: ['snowwolf', 'icegolem', 'frostwisp', 'yeti'], max: 3, bg: 'snow' },
  d3: { pool: ['frostknight', 'wight', 'crystaleye', 'banshee', 'glaciergolem'], max: 4, bg: 'ice' },
  r4: { pool: ['sandworm', 'scorpion', 'cactoid', 'firebat'], max: 4, bg: 'desert' },
  d4: { pool: ['magmagolem', 'salamander', 'mummy', 'flamewraith', 'ruinguard'], max: 4, bg: 'ruins' },
  r5: { pool: ['wyvern', 'behemoth', 'voideye'], max: 3, bg: 'waste' },
  d5: { pool: ['darkknight', 'lich', 'chimera', 'riftgolem', 'riftdemon'], max: 4, bg: 'rift' },
  ds: { pool: ['elderdragon', 'archlich', 'chimera', 'riftdemon'], max: 3, bg: 'shrine' }
};

function makeEnemy(id) {
  const d = ENEMIES[id], L = d.lv, m = d.mod || {};
  const name = d.name || (d.cast && CAST[d.cast].name) || id;
  const hp = Math.round((25 + 22 * L) * (d.hp || 1));
  const e = {
    id, name, isEnemy: true, boss: !!d.boss, lv: L, kind: d.kind, pal: d.pal, cast: d.cast,
    size: d.size || (d.boss ? 3 : 2),
    hp, maxhp: hp, mp: 999, maxmp: 999,
    str: Math.round((6 + 2.3 * L) * (m.str || 1)), mag: Math.round((6 + 2.1 * L) * (m.mag || 1)),
    def: Math.round((3 + 1.4 * L) * (m.def || 1)), mdef: Math.round((3 + 1.3 * L) * (m.mdef || 1)),
    spd: Math.round((8 + 0.4 * L) * (m.spd || 1)),
    el: d.el || {}, skills: d.skills, phases: d.phases || [], steal: d.steal, drop: d.drop,
    exp: Math.round((3 + 1.6 * L * L) * (d.exp || 1)), gil: d.gil || Math.round(4 + 5 * L),
    status: {}, atb: Math.random() * 40, summons: d.summons
  };
  return e;
}
