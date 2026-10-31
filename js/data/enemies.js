// Monsters, villains and encounter zones.
// Stats are derived from the level; `hp` and `mod` are multipliers on that baseline.
// el: element multipliers (2 = weak, 0.5 = resist, 0 = immune, -1 = absorb)
// Villains from the movie use  kind: 'human', cast: '<cast id>'.
// kind 'thug' is a person in street clothes; pal = [shirt, pants, skin, hair].
'use strict';

const ENEMIES = {
  // ---- Around Old Town
  straydog: { name: 'Stray Dog', kind: 'wolf', pal: ['#a07a50'], lv: 1, hp: 0.9, mod: { spd: 1.2 }, skills: [['attack', 3], ['bite', 1]], drop: ['potion', 0.15] },
  seagull: { name: 'Angry Seagull', kind: 'bat', pal: ['#e8e8e8', '#9a9aa0'], lv: 2, hp: 0.7, mod: { spd: 1.4 }, skills: [['attack', 3], ['bite', 1]], drop: ['antidote', 0.1] },
  thug: { name: 'Street Thug', kind: 'thug', pal: ['#c03030', '#3a4a6a', '#c89a70', '#1a1410'], lv: 2, hp: 1, skills: [['attack', 1]], steal: 'potion', drop: ['potion', 0.15] },
  jelly: { name: 'Beach Jelly', kind: 'slime', pal: ['#80b0e0'], lv: 3, hp: 1.0, el: { bolt: 1.5 }, skills: [['attack', 2], ['sting', 1]] },
  // ---- Dark Forest (night)
  nightbat: { name: 'Night Bat', kind: 'bat', pal: ['#3a2a3a', '#1a101a'], lv: 4, hp: 0.8, mod: { spd: 1.4 }, skills: [['attack', 2], ['bite', 1]], drop: ['antidote', 0.25] },
  timberwolf: { name: 'Timber Wolf', kind: 'wolf', pal: ['#6a6a6a'], lv: 5, hp: 1.1, mod: { spd: 1.3 }, skills: [['attack', 3], ['bite', 2]] },
  mandrake: { name: 'Screaming Root', kind: 'plant', pal: ['#c0a080', '#3a5a2a'], lv: 4, hp: 1, el: { fire: 2 }, skills: [['attack', 3], ['sleepspore', 1]], steal: 'eyedrop' },
  stalker: { name: 'Shadow Stalker', kind: 'wraith', pal: ['#2a2a34', '#14141a'], lv: 6, hp: 1.1, mod: { def: 1.5 }, el: { holy: 2 }, skills: [['attack', 2], ['shadowbolt', 1]] },
  hermit: { name: 'Forest Hermit', kind: 'thug', pal: ['#5a4a30', '#3a3020', '#c09070', '#5a5050'], lv: 6, hp: 1.2, mod: { str: 1.2 }, skills: [['attack', 3], ['tackle', 1]], drop: ['potion', 0.2] },
  // ---- Harbor Town coast
  seacrab: { name: 'Sea Crab', kind: 'crab', pal: ['#d05030'], lv: 7, hp: 1.1, mod: { def: 1.8 }, el: { bolt: 2, water: 0 }, skills: [['attack', 2], ['claw', 1]] },
  pirate: { name: 'Dock Pirate', kind: 'thug', pal: ['#2a3a6a', '#2a2a2a', '#b8885e', '#141010'], lv: 8, hp: 1.1, skills: [['attack', 3], ['claw', 1]], steal: 'echo' },
  brinejelly: { name: 'Brine Jelly', kind: 'slime', pal: ['#4080e0'], lv: 8, hp: 1.2, el: { bolt: 2, water: -1, fire: 0.5 }, skills: [['attack', 2], ['watergun', 1]] },
  bigseagull: { name: 'Gull Captain', kind: 'bat', pal: ['#f0f0f0', '#e0a020'], lv: 9, hp: 1, mod: { spd: 1.3 }, skills: [['attack', 3], ['claw', 1]] },
  // ---- Dry Hills (Rufus)
  bodyguard: { name: 'Rufus\'s Bodyguard', kind: 'thug', pal: ['#141414', '#141414', '#c89a70', '#101010'], lv: 11, hp: 1.3, mod: { def: 1.3 }, skills: [['attack', 3], ['rage', 1]], drop: ['hipotion', 0.1] },
  jackal: { name: 'Jackal', kind: 'wolf', pal: ['#c09050'], lv: 10, hp: 1.1, mod: { spd: 1.3 }, skills: [['bite', 2], ['attack', 2]] },
  scorpion: { name: 'Scorpion', kind: 'crab', pal: ['#8a3018'], lv: 11, hp: 1.1, mod: { def: 1.4 }, el: { ice: 1.5 }, skills: [['attack', 2], ['sting', 2]], drop: ['antidote', 0.3] },
  pricklypear: { name: 'Prickly Pear', kind: 'plant', pal: ['#e06070', '#3a8a3a'], lv: 12, hp: 1, mod: { spd: 1.4 }, el: { fire: 2 }, skills: [['attack', 2], ['sweep', 1]], steal: 'remedy' },
  // ---- Olive hills
  boar: { name: 'Wild Boar', kind: 'wolf', pal: ['#5a4030', '#3a2a20'], lv: 14, hp: 1.3, mod: { str: 1.2 }, skills: [['tackle', 2], ['bite', 2]] },
  dustdevil: { name: 'Dust Devil', kind: 'wraith', pal: ['#c8aa78'], lv: 15, hp: 0.9, mod: { mag: 1.2 }, el: { water: 2, earth: -1 }, skills: [['quake', 1], ['attack', 2]], steal: 'ether' },
  rockgolem: { name: 'Rock Golem', kind: 'golem', pal: ['#9a8a70'], lv: 15, hp: 1.6, mod: { def: 1.6, spd: 0.7 }, el: { water: 2, earth: -1 }, skills: [['attack', 2], ['tackle', 1]], drop: ['hipotion', 0.1] },
  vulture: { name: 'Vulture', kind: 'bat', pal: ['#3a2a20', '#d0c0b0'], lv: 16, hp: 1.0, mod: { spd: 1.3 }, skills: [['attack', 2], ['claw', 2]] },
  // ---- Rocky Canyon (second villain)
  bandit: { name: 'Canyon Bandit', kind: 'thug', pal: ['#8a5a2a', '#4a3a2a', '#c09068', '#2a1a10'], lv: 18, hp: 1.3, mod: { str: 1.2 }, skills: [['attack', 3], ['rage', 1]], drop: ['phoenix', 0.1] },
  sandsnake: { name: 'Sand Snake', kind: 'snake', pal: ['#c0a060'], lv: 18, hp: 1.2, el: { ice: 2, earth: 0 }, skills: [['bite', 2], ['poisonbite', 1]] },
  canyoneye: { name: 'Canyon Watcher', kind: 'eye', pal: ['#b06040'], lv: 19, hp: 1, mod: { mag: 1.3 }, el: { bolt: 2 }, skills: [['fira', 2], ['gaze', 1]], steal: 'hiether' },
  bouldergolem: { name: 'Boulder Golem', kind: 'golem', pal: ['#8a5a3a'], lv: 20, hp: 1.8, mod: { def: 1.7, spd: 0.7 }, el: { water: 2 }, skills: [['tackle', 2], ['quake', 1]], drop: ['hipotion', 0.2] },
  // ---- Fishing Port coast
  sandworm: { name: 'Sand Worm', kind: 'snake', pal: ['#d8b870'], lv: 22, hp: 1.4, el: { ice: 2, earth: 0 }, skills: [['bite', 2], ['quake', 1]] },
  smuggler: { name: 'Smuggler', kind: 'thug', pal: ['#e8e0d0', '#2a3a2a', '#b8885e', '#141010'], lv: 22, hp: 1.1, mod: { spd: 1.3 }, skills: [['attack', 2], ['ink', 1]], drop: ['remedy', 0.2] },
  firebat: { name: 'Fire Bat', kind: 'bat', pal: ['#e05020', '#801010'], lv: 24, hp: 1, mod: { spd: 1.4 }, el: { ice: 2, fire: 0.5 }, skills: [['bite', 2], ['fira', 1]] },
  reefcrab: { name: 'Reef Crab', kind: 'crab', pal: ['#e08040'], lv: 23, hp: 1.2, mod: { def: 1.8 }, el: { bolt: 2 }, skills: [['claw', 2], ['harden', 1]] },
  // ---- Cliff Hideout (third villain)
  henchman: { name: 'Henchman', kind: 'thug', pal: ['#4a4a4a', '#1a1a1a', '#c89a70', '#101010'], lv: 26, hp: 1.4, mod: { str: 1.2 }, skills: [['attack', 3], ['rage', 1]], drop: ['xpotion', 0.08] },
  cavegolem: { name: 'Cave Golem', kind: 'golem', pal: ['#6a6a70', '#4a4a50', '#9a9aa0'], lv: 26, hp: 1.8, mod: { def: 1.6, spd: 0.7 }, el: { water: 2 }, skills: [['tackle', 2], ['quake', 1]] },
  oldbones: { name: 'Old Bones', kind: 'skeleton', pal: ['#d8c8a0'], lv: 27, hp: 1.4, el: { fire: 2, holy: 3, dark: 0 }, skills: [['attack', 2], ['doom', 1]], drop: ['remedy', 0.2] },
  hiredblade: { name: 'Hired Blade', kind: 'knight', pal: ['#606878'], lv: 28, hp: 1.5, mod: { def: 1.8, str: 1.2 }, el: { bolt: 1.5 }, skills: [['attack', 2], ['rage', 1], ['harden', 1]], drop: ['xpotion', 0.08] },
  // ---- At sea
  jetski: { name: 'Jet Ski Rider', kind: 'jetski', pal: ['#e0e020', '#202020', '#c89a70', '#101010'], lv: 28, hp: 1.3, mod: { spd: 1.6 }, el: { bolt: 2 }, skills: [['tackle', 2], ['watergun', 1]], drop: ['hiether', 0.2] },
  // ---- The Island
  islandcrab: { name: 'Giant Crab', kind: 'crab', pal: ['#c03020'], lv: 30, hp: 1.5, mod: { def: 1.9 }, el: { bolt: 2 }, skills: [['claw', 2], ['harden', 1]] },
  seaeagle: { name: 'Sea Eagle', kind: 'bat', pal: ['#6a4a2a', '#f0f0f0'], lv: 30, hp: 1.2, mod: { spd: 1.4 }, skills: [['claw', 2], ['rage', 1]] },
  wildbull: { name: 'Wild Bull', kind: 'wolf', pal: ['#2a1a14', '#1a0e08'], lv: 31, hp: 1.7, mod: { str: 1.3 }, skills: [['tackle', 2], ['rage', 1], ['quake', 1]], drop: ['xpotion', 0.1] },
  // ---- Roman Theater
  gladiator: { name: 'Gladiator', kind: 'knight', pal: ['#b08040', '#7a5020', '#e0c070', '#c02020'], lv: 33, hp: 1.6, mod: { def: 1.6, str: 1.3 }, skills: [['attack', 2], ['rage', 1]], drop: ['xpotion', 0.12] },
  centurion: { name: 'Centurion', kind: 'knight', pal: ['#c02020', '#801010', '#d8c070', '#e0c040'], lv: 34, hp: 1.6, mod: { def: 1.8, str: 1.2 }, skills: [['attack', 2], ['harden', 1], ['sweep', 1]], drop: ['hiether', 0.15] },
  lion: { name: 'Arena Lion', kind: 'wolf', pal: ['#d0a040', '#8a6020'], lv: 34, hp: 1.5, mod: { str: 1.3, spd: 1.2 }, skills: [['bite', 2], ['rage', 1]] },
  romanghost: { name: 'Roman Ghost', kind: 'wraith', pal: ['#e8e4d8'], lv: 33, hp: 1.3, mod: { mag: 1.4, def: 2 }, el: { holy: 3, dark: -1 }, skills: [['darkwave', 2], ['drain', 1], ['silencewave', 1]], steal: 'elixir' },
  // ---- Forgotten Shrine (optional)
  elderdragon: { name: 'Elder Dragon', kind: 'dragon', pal: ['#d0b040', '#806010', '#fff0a0'], lv: 42, hp: 2.2, mod: { str: 1.2 }, skills: [['claw', 2], ['firebreath', 1], ['quake', 1]], drop: ['elixir', 0.2] },
  archlich: { name: 'Archlich', kind: 'wraith', pal: ['#202020', '#000000', '#606060', '#ff2020'], lv: 42, hp: 1.6, mod: { mag: 1.5, def: 2 }, el: { holy: 3, dark: -1 }, skills: [['darkwave', 2], ['oblivion', 1], ['slowga', 1]], steal: 'ribbon' },

  // ============================ VILLAINS ============================
  boss_stranger: { name: null, cast: 'villain4', kind: 'human', boss: true, lv: 7, hp: 8.5, mod: { str: 1.25, def: 1.2 },
    skills: [['attack', 3], ['tackle', 1], ['shadowbolt', 1]], steal: 'powerband', gil: 400, exp: 3 },
  boss_rufus: { name: null, cast: 'villain2', kind: 'human', boss: true, lv: 14, hp: 9, mod: { str: 1.25, def: 1.2, spd: 1.2 },
    skills: [['attack', 3], ['rage', 1], ['ink', 1]], phases: [{ below: 0.5, skills: [['attack', 2], ['rage', 2], ['summon', 1]] }],
    minions: ['bodyguard'], summons: ['bodyguard'], steal: 'starpendant', gil: 1500, exp: 3 },
  boss_viper: { name: null, cast: 'villain5', kind: 'human', boss: true, lv: 22, hp: 11, mod: { str: 1.3, mag: 1.2, def: 1.3, spd: 1.2 },
    skills: [['attack', 2], ['doom', 2], ['shadowbolt', 1], ['hasteself', 1]], phases: [{ below: 0.5, skills: [['rage', 3], ['doom', 2], ['slowga', 1]] }],
    steal: 'guardring', gil: 3500, exp: 3 },
  boss_cartographer: { name: null, cast: 'villain6', kind: 'human', boss: true, lv: 30, hp: 12, mod: { str: 1.35, mag: 1.3, def: 1.3 },
    skills: [['attack', 3], ['firaga', 1], ['ink', 1]], phases: [{ below: 0.5, skills: [['darkwave', 2], ['rage', 2], ['summon', 1]] }],
    minions: ['henchman'], summons: ['henchman'], steal: 'swiftanklet', gil: 6000, exp: 3 },
  boss_jetskis: { name: 'Jet Ski Boss', kind: 'jetski', pal: ['#e02020', '#101010', '#c89a70', '#101010'], boss: true, size: 3, lv: 30, hp: 6, mod: { spd: 1.5, str: 1.2 },
    el: { bolt: 2 }, skills: [['tackle', 2], ['tidal', 1]], minions: ['jetski', 'jetski'], gil: 2500, exp: 2 },
  boss_kyo: { name: null, cast: 'villain3', kind: 'human', boss: true, lv: 33, hp: 14, flee: 0.35, mod: { str: 1.4, mag: 1.4, def: 1.3, spd: 1.25 },
    el: { fire: -1 }, skills: [['attack', 2], ['fira', 2], ['firebreath', 1]], steal: 'lifecharm', gil: 5000, exp: 3 },
  boss_sephiroth: { name: null, cast: 'villain1', kind: 'human', boss: true, lv: 37, hp: 16, mod: { str: 1.4, mag: 1.5, def: 1.4, mdef: 1.4, spd: 1.2 },
    el: { holy: 1.5, dark: -1 }, skills: [['attack', 2], ['shadowbolt', 2], ['darkwave', 2], ['ward', 1]],
    phases: [{ below: 0.5, skills: [['riftstorm', 2], ['darkwave', 2], ['slowga', 1], ['silencewave', 1]] }], steal: 'elixir', gil: 0, exp: 2 },
  boss_sephiroth2: { name: null, cast: 'villain1', kind: 'human', boss: true, size: 4, aura: true, lv: 40, hp: 11,
    mod: { str: 1.3, mag: 1.3, def: 1.4, mdef: 1.4, spd: 1.0 }, el: { holy: 1.5, dark: -1 },
    skills: [['rage', 2], ['riftstorm', 2], ['firebreath', 1], ['frostbreath', 1]],
    phases: [{ below: 0.35, skills: [['oblivion', 2], ['riftstorm', 2], ['rage', 2], ['selfheal', 1]] }], steal: 'megalixir', gil: 0, exp: 0 },
  boss_forgotten: { name: 'The Forgotten', kind: 'golem', pal: ['#e0c040', '#806010', '#fff8c0', '#ff4040'], boss: true, size: 6, lv: 50, hp: 15,
    mod: { str: 1.35, mag: 1.35, def: 1.6, mdef: 1.6 }, skills: [['tackle', 2], ['quake', 2], ['riftstorm', 1], ['harden', 1]],
    phases: [{ below: 0.4, skills: [['oblivion', 2], ['rage', 2], ['slowga', 1]] }], steal: 'ribbon', gil: 20000, exp: 4 }
};

// Encounter zones: pool of enemies and how many can appear at once.
const ZONES = {
  r1: { pool: ['straydog', 'straydog', 'seagull', 'thug', 'jelly'], max: 3, bg: 'grass' },
  d1: { pool: ['nightbat', 'timberwolf', 'mandrake', 'stalker', 'hermit'], max: 3, bg: 'woods' },
  r2: { pool: ['seacrab', 'pirate', 'brinejelly', 'bigseagull'], max: 3, bg: 'beach' },
  d2: { pool: ['bodyguard', 'jackal', 'scorpion', 'pricklypear'], max: 3, bg: 'scrub' },
  r3: { pool: ['boar', 'dustdevil', 'rockgolem', 'vulture'], max: 3, bg: 'scrub' },
  d3: { pool: ['bandit', 'sandsnake', 'canyoneye', 'bouldergolem'], max: 3, bg: 'canyon' },
  r4: { pool: ['sandworm', 'smuggler', 'firebat', 'reefcrab'], max: 3, bg: 'beach' },
  d4: { pool: ['henchman', 'cavegolem', 'oldbones', 'hiredblade'], max: 3, bg: 'cave' },
  r5: { pool: ['islandcrab', 'seaeagle', 'wildbull'], max: 3, bg: 'island' },
  d5: { pool: ['gladiator', 'centurion', 'lion', 'romanghost'], max: 3, bg: 'theater' },
  ds: { pool: ['elderdragon', 'archlich', 'lion', 'romanghost'], max: 3, bg: 'shrine' }
};

function makeEnemy(id) {
  const d = ENEMIES[id], L = d.lv, m = d.mod || {};
  const name = d.name || (d.cast && CAST[d.cast].name) || id;
  const hp = Math.round((25 + 22 * L) * (d.hp || 1));
  const e = {
    id, name, isEnemy: true, boss: !!d.boss, lv: L, kind: d.kind, pal: d.pal, cast: d.cast, aura: d.aura,
    size: d.size || (d.boss ? 3 : 2),
    hp, maxhp: hp, mp: 999, maxmp: 999,
    str: Math.round((6 + 2.3 * L) * (m.str || 1)), mag: Math.round((6 + 2.1 * L) * (m.mag || 1)),
    def: Math.round((3 + 1.4 * L) * (m.def || 1)), mdef: Math.round((3 + 1.3 * L) * (m.mdef || 1)),
    spd: Math.round((8 + 0.4 * L) * (m.spd || 1)),
    el: d.el || {}, skills: d.skills, phases: d.phases || [], steal: d.steal, drop: d.drop, fleeAt: d.flee,
    exp: Math.round((3 + 1.6 * L * L) * (d.exp || 1)), gil: d.gil || Math.round(4 + 5 * L),
    status: {}, atb: Math.random() * 40, summons: d.summons
  };
  return e;
}
