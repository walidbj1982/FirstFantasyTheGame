// Jobs, skills, items, equipment and status effects.
'use strict';

const JOBS = {
  knight: {
    name: 'Knight', weapon: 'sword', armor: ['heavy', 'light'],
    base: { hp: 75, mp: 6, str: 14, mag: 6, def: 10, mdef: 6, spd: 10 },
    grow: { hp: 26, mp: 2.2, str: 1.9, mag: 0.8, def: 1.2, mdef: 0.9, spd: 0.35 },
    skills: [[2, 'powerslash'], [6, 'shieldbash'], [10, 'crossslash'], [15, 'aegis'], [20, 'bladebeam'], [25, 'valor'], [31, 'skysplit'], [38, 'dawnstrike']],
    menu: 'Arts'
  },
  mage: {
    name: 'Mage', weapon: 'rod', armor: ['robe'],
    base: { hp: 52, mp: 14, str: 7, mag: 15, def: 6, mdef: 12, spd: 11 },
    grow: { hp: 15, mp: 5.5, str: 0.7, mag: 2.0, def: 0.7, mdef: 1.4, spd: 0.4 },
    skills: [[1, 'fire'], [1, 'blizzard'], [3, 'thunder'], [5, 'sleep'], [11, 'fira'], [12, 'blizzara'], [13, 'thundara'],
      [17, 'drain'], [20, 'slow'], [24, 'firaga'], [25, 'blizzaga'], [26, 'thundaga'], [32, 'flare'], [40, 'ultima']],
    menu: 'Magic'
  },
  healer: {
    name: 'Healer', weapon: 'staff', armor: ['robe'],
    base: { hp: 56, mp: 12, str: 8, mag: 13, def: 7, mdef: 13, spd: 11 },
    grow: { hp: 17, mp: 5, str: 0.9, mag: 1.8, def: 0.85, mdef: 1.5, spd: 0.4 },
    skills: [[1, 'cure'], [4, 'protect'], [7, 'esuna'], [10, 'cura'], [12, 'shell'], [15, 'raise'], [18, 'haste'],
      [22, 'curaga'], [25, 'regen'], [30, 'holy'], [36, 'arise']],
    menu: 'Prayer'
  },
  rogue: {
    name: 'Rogue', weapon: 'dagger', armor: ['light'],
    base: { hp: 62, mp: 8, str: 12, mag: 8, def: 8, mdef: 8, spd: 14 },
    grow: { hp: 20, mp: 2.8, str: 1.6, mag: 1.0, def: 0.95, mdef: 1.0, spd: 0.55 },
    skills: [[1, 'steal'], [4, 'doublecut'], [7, 'venom'], [10, 'mug'], [13, 'dazzle'], [18, 'shadowstep'], [22, 'knives'], [30, 'assassinate']],
    menu: 'Tricks'
  }
};

// kind: phys | magic | heal | buff | debuff | revive | cure | steal | drain
// target: enemy | enemies | ally | allies | self | ko   (relative to the user)
const SKILLS = {
  attack: { name: 'Attack', mp: 0, kind: 'phys', target: 'enemy', pow: 1, fx: 'slash' },
  // knight
  powerslash: { name: 'Power Slash', mp: 4, kind: 'phys', target: 'enemy', pow: 1.7, fx: 'bigslash', desc: 'A heavy two-handed blow.' },
  shieldbash: { name: 'Shield Bash', mp: 6, kind: 'phys', target: 'enemy', pow: 1.1, st: ['sleep', 0.45], fx: 'hit', desc: 'Stuns the foe (sleep).' },
  crossslash: { name: 'Cross Slash', mp: 10, kind: 'phys', target: 'enemy', pow: 1.0, hits: 2, fx: 'bigslash', desc: 'Two fast cuts.' },
  aegis: { name: 'Aegis', mp: 14, kind: 'buff', target: 'allies', st: ['protect', 1], fx: 'buff', desc: 'Protect on the whole party.' },
  bladebeam: { name: 'Blade Beam', mp: 18, kind: 'phys', target: 'enemies', pow: 1.0, fx: 'beam', desc: 'A wave of light hits all foes.' },
  valor: { name: 'Valor', mp: 12, kind: 'buff', target: 'self', st: ['brave', 1], fx: 'buff', desc: 'Raise own attack by half.' },
  skysplit: { name: 'Sky Splitter', mp: 30, kind: 'phys', target: 'enemy', pow: 3.2, fx: 'bigslash', desc: 'Cleaves the very sky.' },
  dawnstrike: { name: 'Dawnstrike', mp: 46, kind: 'phys', target: 'enemies', pow: 2.0, el: 'holy', fx: 'holy', desc: 'Holy blade on all foes.' },
  // mage
  fire: { name: 'Fire', mp: 4, kind: 'magic', target: 'enemy', pow: 10, el: 'fire', fx: 'fire' },
  blizzard: { name: 'Blizzard', mp: 4, kind: 'magic', target: 'enemy', pow: 10, el: 'ice', fx: 'ice' },
  thunder: { name: 'Thunder', mp: 5, kind: 'magic', target: 'enemy', pow: 11, el: 'bolt', fx: 'bolt' },
  sleep: { name: 'Sleep', mp: 6, kind: 'debuff', target: 'enemy', st: ['sleep', 0.7], fx: 'debuff', desc: 'Puts a foe to sleep.' },
  fira: { name: 'Fira', mp: 12, kind: 'magic', target: 'enemy', pow: 24, el: 'fire', fx: 'fire' },
  blizzara: { name: 'Blizzara', mp: 12, kind: 'magic', target: 'enemy', pow: 24, el: 'ice', fx: 'ice' },
  thundara: { name: 'Thundara', mp: 13, kind: 'magic', target: 'enemy', pow: 25, el: 'bolt', fx: 'bolt' },
  drain: { name: 'Drain', mp: 14, kind: 'drain', target: 'enemy', pow: 20, el: 'dark', fx: 'dark', desc: 'Steal HP from a foe.' },
  slow: { name: 'Slow', mp: 10, kind: 'debuff', target: 'enemy', st: ['slow', 0.8], fx: 'debuff' },
  firaga: { name: 'Firaga', mp: 28, kind: 'magic', target: 'enemies', pow: 32, el: 'fire', fx: 'fire' },
  blizzaga: { name: 'Blizzaga', mp: 28, kind: 'magic', target: 'enemies', pow: 32, el: 'ice', fx: 'ice' },
  thundaga: { name: 'Thundaga', mp: 30, kind: 'magic', target: 'enemies', pow: 33, el: 'bolt', fx: 'bolt' },
  flare: { name: 'Flare', mp: 42, kind: 'magic', target: 'enemy', pow: 72, fx: 'flare' },
  ultima: { name: 'Ultima', mp: 70, kind: 'magic', target: 'enemies', pow: 62, fx: 'flare' },
  // healer
  cure: { name: 'Cure', mp: 4, kind: 'heal', target: 'ally', pow: 12, fx: 'heal', field: true },
  protect: { name: 'Protect', mp: 6, kind: 'buff', target: 'ally', st: ['protect', 1], fx: 'buff', desc: 'Halves physical damage.' },
  esuna: { name: 'Esuna', mp: 6, kind: 'cure', target: 'ally', fx: 'heal', field: true, desc: 'Cures bad status.' },
  cura: { name: 'Cura', mp: 10, kind: 'heal', target: 'ally', pow: 28, fx: 'heal', field: true },
  shell: { name: 'Shell', mp: 8, kind: 'buff', target: 'ally', st: ['shell', 1], fx: 'buff', desc: 'Halves magic damage.' },
  raise: { name: 'Raise', mp: 20, kind: 'revive', target: 'ko', pow: 0.3, fx: 'heal', field: true },
  haste: { name: 'Haste', mp: 12, kind: 'buff', target: 'ally', st: ['haste', 1], fx: 'buff' },
  curaga: { name: 'Curaga', mp: 24, kind: 'heal', target: 'allies', pow: 30, fx: 'heal', field: true },
  regen: { name: 'Regen', mp: 14, kind: 'buff', target: 'ally', st: ['regen', 1], fx: 'heal' },
  holy: { name: 'Holy', mp: 34, kind: 'magic', target: 'enemy', pow: 64, el: 'holy', fx: 'holy' },
  arise: { name: 'Arise', mp: 45, kind: 'revive', target: 'ko', pow: 1, fx: 'holy', field: true },
  // rogue
  steal: { name: 'Steal', mp: 0, kind: 'steal', target: 'enemy', fx: 'steal' },
  doublecut: { name: 'Double Cut', mp: 5, kind: 'phys', target: 'enemy', pow: 0.85, hits: 2, fx: 'slash' },
  venom: { name: 'Venom Edge', mp: 6, kind: 'phys', target: 'enemy', pow: 1.1, st: ['poison', 0.75], fx: 'slash' },
  mug: { name: 'Mug', mp: 6, kind: 'phys', target: 'enemy', pow: 1.0, steal: true, fx: 'slash', desc: 'Attack and steal.' },
  dazzle: { name: 'Dazzle', mp: 10, kind: 'debuff', target: 'enemies', st: ['blind', 0.6], fx: 'debuff', desc: 'Blinds all foes.' },
  shadowstep: { name: 'Shadowstep', mp: 14, kind: 'buff', target: 'self', st: ['haste', 1], fx: 'buff' },
  knives: { name: 'Fan of Knives', mp: 18, kind: 'phys', target: 'enemies', pow: 0.7, hits: 2, fx: 'slash' },
  assassinate: { name: 'Assassinate', mp: 24, kind: 'phys', target: 'enemy', pow: 2.4, st: ['death', 0.25], fx: 'bigslash' },
  // enemy-only
  bite: { name: 'Bite', kind: 'phys', target: 'enemy', pow: 1.3, fx: 'hit' },
  claw: { name: 'Claw', kind: 'phys', target: 'enemy', pow: 1.2, fx: 'slash' },
  tackle: { name: 'Tackle', kind: 'phys', target: 'enemy', pow: 1.5, fx: 'hit' },
  rage: { name: 'Rage', kind: 'phys', target: 'enemy', pow: 2.0, fx: 'bigslash' },
  sweep: { name: 'Sweep', kind: 'phys', target: 'enemies', pow: 0.9, fx: 'beam' },
  poisonbite: { name: 'Toxic Bite', kind: 'phys', target: 'enemy', pow: 1.0, st: ['poison', 0.6], fx: 'hit' },
  sting: { name: 'Sting', kind: 'phys', target: 'enemy', pow: 0.9, st: ['poison', 0.8], fx: 'hit' },
  sleepspore: { name: 'Sleep Spores', kind: 'debuff', target: 'enemies', st: ['sleep', 0.35], fx: 'debuff' },
  gaze: { name: 'Mute Gaze', kind: 'debuff', target: 'enemy', st: ['silence', 0.7], fx: 'debuff' },
  ink: { name: 'Ink Spray', kind: 'debuff', target: 'enemies', st: ['blind', 0.5], fx: 'debuff' },
  watergun: { name: 'Water Jet', kind: 'magic', target: 'enemy', pow: 14, el: 'water', fx: 'ice' },
  tidal: { name: 'Tidal Wave', kind: 'magic', target: 'enemies', pow: 22, el: 'water', fx: 'ice' },
  quake: { name: 'Quake', kind: 'magic', target: 'enemies', pow: 26, el: 'earth', fx: 'quake' },
  frostbreath: { name: 'Frost Breath', kind: 'magic', target: 'enemies', pow: 24, el: 'ice', fx: 'ice' },
  firebreath: { name: 'Fire Breath', kind: 'magic', target: 'enemies', pow: 26, el: 'fire', fx: 'fire' },
  darkwave: { name: 'Dark Wave', kind: 'magic', target: 'enemies', pow: 28, el: 'dark', fx: 'dark' },
  shadowbolt: { name: 'Shadow Bolt', kind: 'magic', target: 'enemy', pow: 30, el: 'dark', fx: 'dark' },
  riftstorm: { name: 'Rift Storm', kind: 'magic', target: 'enemies', pow: 34, el: 'dark', fx: 'flare' },
  oblivion: { name: 'Oblivion', kind: 'magic', target: 'enemies', pow: 46, el: 'dark', fx: 'flare' },
  selfheal: { name: 'Regenerate', kind: 'heal', target: 'self', pow: 40, fx: 'heal' },
  ward: { name: 'Dark Ward', kind: 'buff', target: 'self', st: ['shell', 1], fx: 'buff' },
  harden: { name: 'Harden', kind: 'buff', target: 'self', st: ['protect', 1], fx: 'buff' },
  enrage: { name: 'Fury', kind: 'buff', target: 'self', st: ['brave', 1], fx: 'buff' },
  hasteself: { name: 'Quicken', kind: 'buff', target: 'self', st: ['haste', 1], fx: 'buff' },
  doom: { name: 'Doom Claw', kind: 'phys', target: 'enemy', pow: 1.6, st: ['poison', 0.9], fx: 'bigslash' },
  silencewave: { name: 'Hush', kind: 'debuff', target: 'enemies', st: ['silence', 0.45], fx: 'debuff' },
  slowga: { name: 'Time Rot', kind: 'debuff', target: 'enemies', st: ['slow', 0.5], fx: 'debuff' },
  summon: { name: 'Call Minions', kind: 'summon', target: 'self', fx: 'dark' },
  bomb_fx: { name: 'Bomb', kind: 'item', fx: 'fire' }
};

// status: turns are counted in the bearer's own actions
const STATUS = {
  poison: { name: 'Poison', bad: true, col: '#a040e0', turns: 99 },
  sleep: { name: 'Sleep', bad: true, col: '#8080ff', turns: 3 },
  silence: { name: 'Silence', bad: true, col: '#c0c0c0', turns: 4 },
  blind: { name: 'Blind', bad: true, col: '#606060', turns: 5 },
  slow: { name: 'Slow', bad: true, col: '#4060a0', turns: 5 },
  protect: { name: 'Protect', col: '#e0c040', turns: 6 },
  shell: { name: 'Shell', col: '#40c0e0', turns: 6 },
  haste: { name: 'Haste', col: '#f08040', turns: 6 },
  regen: { name: 'Regen', col: '#40e080', turns: 8 },
  brave: { name: 'Brave', col: '#f04040', turns: 5 }
};

// ------------------------------------------------------------------ items
// use: heal hp / mp / both / revive / cure / dmg (battle) / tent (field)
const ITEMS = {
  potion: { name: 'Potion', price: 50, use: { hp: 120 }, desc: 'Restores 120 HP.' },
  hipotion: { name: 'Hi-Potion', price: 250, use: { hp: 450 }, desc: 'Restores 450 HP.' },
  xpotion: { name: 'X-Potion', price: 1200, use: { hp: 9999 }, desc: 'Fully restores HP.' },
  ether: { name: 'Ether', price: 300, use: { mp: 50 }, desc: 'Restores 50 MP.' },
  hiether: { name: 'Hi-Ether', price: 1100, use: { mp: 150 }, desc: 'Restores 150 MP.' },
  elixir: { name: 'Elixir', price: 0, sell: 2500, use: { hp: 9999, mp: 999 }, desc: 'Fully restores HP and MP.' },
  megalixir: { name: 'Megalixir', price: 0, sell: 5000, use: { hp: 9999, mp: 999, all: true }, desc: 'Full HP/MP to the party.' },
  phoenix: { name: 'Phoenix Down', price: 300, use: { revive: 0.25 }, desc: 'Revives an ally.' },
  antidote: { name: 'Antidote', price: 40, use: { cure: ['poison'] }, desc: 'Cures poison.' },
  eyedrop: { name: 'Eye Drops', price: 40, use: { cure: ['blind'] }, desc: 'Cures blindness.' },
  echo: { name: 'Echo Herb', price: 60, use: { cure: ['silence'] }, desc: 'Cures silence.' },
  remedy: { name: 'Remedy', price: 300, use: { cure: ['poison', 'blind', 'silence', 'sleep', 'slow'] }, desc: 'Cures all bad status.' },
  tent: { name: 'Tent', price: 250, use: { tent: true }, field: true, desc: 'Field/save point: full party rest.' },
  bomb: { name: 'Bomb Shard', price: 200, use: { dmg: 220, el: 'fire', fx: 'fire' }, battle: true, desc: 'Deals fire damage.' },
  arctic: { name: 'Arctic Wind', price: 200, use: { dmg: 220, el: 'ice', fx: 'ice' }, battle: true, desc: 'Deals ice damage.' },
  zeus: { name: 'Zeus Orb', price: 600, use: { dmg: 650, el: 'bolt', fx: 'bolt' }, battle: true, desc: 'Deals bolt damage.' },
  dragonfang: { name: 'Dragon Fang', price: 0, sell: 800, use: { dmg: 1500, el: 'fire', fx: 'flare', all: true }, battle: true, desc: 'Fire on all foes.' }
};

// slot: weapon | armor | acc     type: sword rod staff dagger | heavy robe light
const EQUIP = {
  // swords
  bronzesword: { name: 'Bronze Sword', slot: 'weapon', type: 'sword', atk: 8, price: 120 },
  ironblade: { name: 'Iron Blade', slot: 'weapon', type: 'sword', atk: 18, price: 600 },
  mythrilsword: { name: 'Mythril Sword', slot: 'weapon', type: 'sword', atk: 32, price: 2000 },
  flamberge: { name: 'Flamberge', slot: 'weapon', type: 'sword', atk: 48, el: 'fire', price: 5200 },
  crystalsaber: { name: 'Crystal Saber', slot: 'weapon', type: 'sword', atk: 66, price: 11000 },
  dawnedge: { name: 'Dawn Edge', slot: 'weapon', type: 'sword', atk: 90, el: 'holy', str: 10, price: 0 },
  // rods
  oakrod: { name: 'Oak Rod', slot: 'weapon', type: 'rod', atk: 3, mag: 3, price: 100 },
  silverrod: { name: 'Silver Rod', slot: 'weapon', type: 'rod', atk: 6, mag: 8, price: 550 },
  frostrod: { name: 'Frost Rod', slot: 'weapon', type: 'rod', atk: 10, mag: 14, price: 1900 },
  emberrod: { name: 'Ember Rod', slot: 'weapon', type: 'rod', atk: 14, mag: 22, price: 4800 },
  starrod: { name: 'Star Rod', slot: 'weapon', type: 'rod', atk: 18, mag: 32, price: 10500 },
  riftscepter: { name: 'Rift Scepter', slot: 'weapon', type: 'rod', atk: 24, mag: 46, price: 0 },
  // staves
  ashstaff: { name: 'Ash Staff', slot: 'weapon', type: 'staff', atk: 4, mag: 2, price: 100 },
  healstaff: { name: 'Healing Staff', slot: 'weapon', type: 'staff', atk: 8, mag: 6, price: 520 },
  prismstaff: { name: 'Prism Staff', slot: 'weapon', type: 'staff', atk: 12, mag: 12, price: 1850 },
  sagestaff: { name: 'Sage Staff', slot: 'weapon', type: 'staff', atk: 16, mag: 20, price: 4700 },
  seraphstaff: { name: 'Seraph Staff', slot: 'weapon', type: 'staff', atk: 20, mag: 30, price: 10200 },
  luminastaff: { name: 'Lumina Staff', slot: 'weapon', type: 'staff', atk: 26, mag: 42, price: 0 },
  // daggers
  knife: { name: 'Knife', slot: 'weapon', type: 'dagger', atk: 7, price: 90 },
  kris: { name: 'Kris', slot: 'weapon', type: 'dagger', atk: 16, price: 560 },
  mythrildagger: { name: 'Mythril Dagger', slot: 'weapon', type: 'dagger', atk: 28, spd: 2, price: 1900 },
  fang: { name: "Viper's Fang", slot: 'weapon', type: 'dagger', atk: 42, spd: 3, price: 5000 },
  shadowblade: { name: 'Shadow Blade', slot: 'weapon', type: 'dagger', atk: 58, spd: 4, price: 10800 },
  moonfang: { name: 'Moonfang', slot: 'weapon', type: 'dagger', atk: 80, spd: 6, price: 0 },
  // heavy armour
  chainmail: { name: 'Chain Mail', slot: 'armor', type: 'heavy', def: 6, mdef: 1, price: 150 },
  ironarmor: { name: 'Iron Armor', slot: 'armor', type: 'heavy', def: 12, mdef: 3, price: 650 },
  mythrilmail: { name: 'Mythril Mail', slot: 'armor', type: 'heavy', def: 20, mdef: 6, price: 2100 },
  flameplate: { name: 'Flame Plate', slot: 'armor', type: 'heavy', def: 30, mdef: 10, price: 5200 },
  crystalmail: { name: 'Crystal Mail', slot: 'armor', type: 'heavy', def: 40, mdef: 16, price: 11000 },
  dawnarmor: { name: 'Dawn Armor', slot: 'armor', type: 'heavy', def: 54, mdef: 24, price: 0 },
  // robes
  cottonrobe: { name: 'Cotton Robe', slot: 'armor', type: 'robe', def: 3, mdef: 4, price: 110 },
  silkrobe: { name: 'Silk Robe', slot: 'armor', type: 'robe', def: 6, mdef: 9, price: 560 },
  magerobe: { name: 'Mage Robe', slot: 'armor', type: 'robe', def: 10, mdef: 16, price: 1900 },
  sagerobe: { name: 'Sage Robe', slot: 'armor', type: 'robe', def: 15, mdef: 24, mag: 3, price: 4900 },
  lumenrobe: { name: 'Lumen Robe', slot: 'armor', type: 'robe', def: 20, mdef: 32, mag: 5, price: 10400 },
  riftrobe: { name: 'Rift Robe', slot: 'armor', type: 'robe', def: 26, mdef: 44, mag: 8, price: 0 },
  // light armour
  leathervest: { name: 'Leather Vest', slot: 'armor', type: 'light', def: 4, mdef: 2, price: 120 },
  brigandine: { name: 'Brigandine', slot: 'armor', type: 'light', def: 9, mdef: 5, price: 580 },
  mythrilvest: { name: 'Mythril Vest', slot: 'armor', type: 'light', def: 15, mdef: 9, price: 1950 },
  ninjagarb: { name: 'Ninja Garb', slot: 'armor', type: 'light', def: 22, mdef: 14, spd: 2, price: 5000 },
  shadowgarb: { name: 'Shadow Garb', slot: 'armor', type: 'light', def: 30, mdef: 20, spd: 3, price: 10600 },
  phantomgarb: { name: 'Phantom Garb', slot: 'armor', type: 'light', def: 40, mdef: 28, spd: 4, price: 0 },
  // accessories
  powerband: { name: 'Power Band', slot: 'acc', str: 6, price: 900 },
  magicring: { name: 'Magic Ring', slot: 'acc', mag: 7, price: 900 },
  starpendant: { name: 'Star Pendant', slot: 'acc', ward: ['poison'], mdef: 2, price: 600 },
  guardring: { name: 'Guard Ring', slot: 'acc', def: 7, mdef: 7, price: 1500 },
  lifecharm: { name: 'Life Charm', slot: 'acc', hpPct: 20, price: 2400 },
  swiftanklet: { name: 'Swift Anklet', slot: 'acc', spd: 5, price: 3500 },
  ribbon: { name: 'Ribbon', slot: 'acc', ward: ['poison', 'sleep', 'silence', 'blind', 'slow', 'death'], mdef: 6, price: 0 },
  herocrest: { name: "Hero's Crest", slot: 'acc', str: 10, mag: 10, def: 10, mdef: 10, spd: 3, price: 0 }
};

function itemDef(id) { return ITEMS[id] || EQUIP[id]; }
function canEquip(job, eq) {
  const j = JOBS[job];
  if (eq.slot === 'acc') return true;
  if (eq.slot === 'weapon') return j.weapon === eq.type;
  return j.armor.includes(eq.type);
}

// experience needed to go from lv to lv+1
const expNext = lv => Math.round(12 * lv * lv + 8 * lv);
const MAX_LV = 60;
