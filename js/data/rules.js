// Jobs, skills, items, equipment and status effects.
'use strict';

const JOBS = {
  brawler: {
    name: 'Brawler', weapon: 'glove', armor: ['light', 'heavy'],
    base: { hp: 80, mp: 8, str: 15, mag: 7, def: 10, mdef: 7, spd: 12 },
    grow: { hp: 27, mp: 2.6, str: 2.0, mag: 0.8, def: 1.15, mdef: 0.95, spd: 0.45 },
    skills: [[1, 'groundwave'], [5, 'knucklerush'], [9, 'risingtackle'], [14, 'rally'], [19, 'geyser'], [25, 'secondwind'],
      [31, 'crackshoot'], [38, 'triplegeyser']],
    menu: 'Moves', burst: 'single'
  },
  monk: {
    name: 'Martial Artist', weapon: 'band', armor: ['robe', 'light'],
    base: { hp: 66, mp: 14, str: 12, mag: 13, def: 9, mdef: 11, spd: 12 },
    grow: { hp: 22, mp: 4.6, str: 1.5, mag: 1.75, def: 1.0, mdef: 1.3, spd: 0.45 },
    skills: [[1, 'kiblast'], [1, 'chiheal'], [4, 'risingdragon'], [7, 'cleanse'], [10, 'whirlwind'], [12, 'ironbody'], [15, 'revive'],
      [18, 'kiburst'], [22, 'healingwave'], [26, 'innerpeace'], [30, 'dragonfist'], [36, 'rebirth']],
    menu: 'Ki', burst: 'all'
  },
  gunner: {
    name: 'Gunner', weapon: 'gun', armor: ['heavy', 'light'],
    base: { hp: 95, mp: 8, str: 14, mag: 8, def: 12, mdef: 8, spd: 9 },
    grow: { hp: 31, mp: 2.4, str: 1.85, mag: 0.9, def: 1.3, mdef: 1.0, spd: 0.32 },
    skills: [[1, 'bigshot'], [4, 'rapidfire'], [8, 'grenade'], [12, 'flashbang'], [16, 'coverfire'], [20, 'gatling'], [26, 'armorpierce'],
      [32, 'mortar'], [38, 'orbitalstrike']],
    menu: 'Guns', burst: 'multi'
  }
};

// kind: phys | magic | heal | buff | debuff | revive | cure | steal | drain
// target: enemy | enemies | ally | allies | self | ko   (relative to the user)
const SKILLS = {
  attack: { name: 'Attack', mp: 0, kind: 'phys', target: 'enemy', pow: 1, fx: 'slash' },
  // brawler (Terry)
  groundwave: { name: 'Ground Wave', mp: 4, kind: 'phys', target: 'enemy', pow: 1.5, el: 'earth', fx: 'beam', desc: 'An energy wave that races along the ground.' },
  knucklerush: { name: 'Knuckle Rush', mp: 6, kind: 'phys', target: 'enemy', pow: 0.95, hits: 2, fx: 'hit', desc: 'Two flaming punches.' },
  risingtackle: { name: 'Rising Tackle', mp: 8, kind: 'phys', target: 'enemy', pow: 1.6, st: ['sleep', 0.35], fx: 'bigslash', desc: 'A spinning upward tackle that stuns.' },
  rally: { name: 'Rally', mp: 14, kind: 'buff', target: 'allies', st: ['brave', 1], fx: 'buff', desc: 'Fires up the whole team (attack up).' },
  geyser: { name: 'Geyser', mp: 18, kind: 'phys', target: 'enemies', pow: 1.05, el: 'earth', fx: 'quake', desc: 'Punches the ground: an eruption hits all foes.' },
  secondwind: { name: 'Second Wind', mp: 10, kind: 'heal', target: 'self', pow: 30, fx: 'heal', desc: 'Catches a breath and recovers HP.' },
  crackshoot: { name: 'Crack Shoot', mp: 26, kind: 'phys', target: 'enemy', pow: 3.1, fx: 'bigslash', desc: 'A devastating somersault kick.' },
  triplegeyser: { name: 'Triple Geyser', mp: 44, kind: 'phys', target: 'enemies', pow: 2.0, el: 'earth', fx: 'quake', desc: 'Three eruptions across the field.' },
  // martial artist (Ryu)
  kiblast: { name: 'Ki Blast', mp: 4, kind: 'magic', target: 'enemy', pow: 11, fx: 'holy', desc: 'Throws a ball of energy from both palms.' },
  chiheal: { name: 'Chi Heal', mp: 4, kind: 'heal', target: 'ally', pow: 12, fx: 'heal', field: true, desc: 'Restores an ally\'s HP.' },
  risingdragon: { name: 'Rising Dragon', mp: 6, kind: 'phys', target: 'enemy', pow: 1.7, fx: 'bigslash', desc: 'A rising uppercut.' },
  cleanse: { name: 'Cleanse', mp: 6, kind: 'cure', target: 'ally', fx: 'heal', field: true, desc: 'Cures bad status.' },
  whirlwind: { name: 'Whirlwind Kick', mp: 10, kind: 'phys', target: 'enemies', pow: 0.85, fx: 'slash', desc: 'A spinning kick that hits all foes.' },
  ironbody: { name: 'Iron Body', mp: 8, kind: 'buff', target: 'ally', st: ['protect', 1], fx: 'buff', desc: 'Halves physical damage.' },
  revive: { name: 'Revive', mp: 20, kind: 'revive', target: 'ko', pow: 0.3, fx: 'heal', field: true, desc: 'Brings a fallen friend back.' },
  kiburst: { name: 'Ki Burst', mp: 14, kind: 'magic', target: 'enemy', pow: 27, fx: 'holy', desc: 'A huge blast of energy.' },
  healingwave: { name: 'Healing Wave', mp: 22, kind: 'heal', target: 'allies', pow: 28, fx: 'heal', field: true, desc: 'Restores HP to the team.' },
  innerpeace: { name: 'Inner Peace', mp: 14, kind: 'buff', target: 'ally', st: ['regen', 1], fx: 'heal', desc: 'Slowly restores HP.' },
  dragonfist: { name: 'Dragon Fist', mp: 34, kind: 'magic', target: 'enemy', pow: 66, el: 'fire', fx: 'fire', desc: 'A blazing punch of pure ki.' },
  rebirth: { name: 'Rebirth', mp: 45, kind: 'revive', target: 'ko', pow: 1, fx: 'holy', field: true, desc: 'Revives with full HP.' },
  // gunner (Barret)
  bigshot: { name: 'Big Shot', mp: 4, kind: 'phys', target: 'enemy', pow: 1.6, fx: 'bolt', desc: 'A charged blast from the gun-arm.' },
  rapidfire: { name: 'Rapid Fire', mp: 6, kind: 'phys', target: 'enemy', pow: 0.65, hits: 3, fx: 'hit', desc: 'Three quick shots.' },
  grenade: { name: 'Grenade', mp: 10, kind: 'magic', target: 'enemies', pow: 14, el: 'fire', fx: 'fire', desc: 'Fire damage to all foes.' },
  flashbang: { name: 'Flashbang', mp: 8, kind: 'debuff', target: 'enemies', st: ['blind', 0.6], fx: 'debuff', desc: 'Blinds all foes.' },
  coverfire: { name: 'Cover Fire', mp: 14, kind: 'buff', target: 'allies', st: ['protect', 1], fx: 'buff', desc: 'Protect on the whole team.' },
  gatling: { name: 'Gatling', mp: 18, kind: 'phys', target: 'enemies', pow: 0.6, hits: 2, fx: 'hit', desc: 'Sprays bullets across all foes.' },
  armorpierce: { name: 'Armor Piercer', mp: 22, kind: 'phys', target: 'enemy', pow: 2.7, fx: 'bolt', desc: 'A shell that punches through anything.' },
  mortar: { name: 'Mortar', mp: 30, kind: 'magic', target: 'enemies', pow: 34, el: 'fire', fx: 'fire', desc: 'Shells rain on all foes.' },
  orbitalstrike: { name: 'Orbital Strike', mp: 52, kind: 'magic', target: 'enemies', pow: 60, fx: 'flare', desc: 'A beam from the sky.' },
  steal: { name: 'Steal', mp: 0, kind: 'steal', target: 'enemy', fx: 'steal' },
  // mage spells still used by enemies
  fira: { name: 'Fira', mp: 12, kind: 'magic', target: 'enemy', pow: 24, el: 'fire', fx: 'fire' },
  blizzara: { name: 'Blizzara', mp: 12, kind: 'magic', target: 'enemy', pow: 24, el: 'ice', fx: 'ice' },
  firaga: { name: 'Firaga', mp: 28, kind: 'magic', target: 'enemies', pow: 32, el: 'fire', fx: 'fire' },
  blizzaga: { name: 'Blizzaga', mp: 28, kind: 'magic', target: 'enemies', pow: 32, el: 'ice', fx: 'ice' },
  drain: { name: 'Drain', mp: 14, kind: 'drain', target: 'enemy', pow: 20, el: 'dark', fx: 'dark' },
  hasteself: { name: 'Quicken', kind: 'buff', target: 'self', st: ['haste', 1], fx: 'buff' },
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
  // gloves (Terry)
  leathergloves: { name: 'Leather Gloves', slot: 'weapon', type: 'glove', atk: 8, price: 120 },
  ironknuckles: { name: 'Iron Knuckles', slot: 'weapon', type: 'glove', atk: 18, price: 600 },
  steelknuckles: { name: 'Steel Knuckles', slot: 'weapon', type: 'glove', atk: 32, price: 2000 },
  flameknuckles: { name: 'Flame Knuckles', slot: 'weapon', type: 'glove', atk: 48, el: 'fire', price: 5200 },
  crystalknuckles: { name: 'Crystal Knuckles', slot: 'weapon', type: 'glove', atk: 66, price: 11000 },
  wolfgloves: { name: 'Wolf Fang Gloves', slot: 'weapon', type: 'glove', atk: 90, str: 10, price: 0 },
  // hand wraps and headbands (Ryu)
  clothwraps: { name: 'Cloth Wraps', slot: 'weapon', type: 'band', atk: 7, mag: 3, price: 110 },
  trainingband: { name: 'Training Band', slot: 'weapon', type: 'band', atk: 15, mag: 7, price: 560 },
  dragonband: { name: 'Dragon Band', slot: 'weapon', type: 'band', atk: 26, mag: 13, price: 1900 },
  spiritwraps: { name: 'Spirit Wraps', slot: 'weapon', type: 'band', atk: 38, mag: 21, price: 4900 },
  sageband: { name: 'Sage Band', slot: 'weapon', type: 'band', atk: 52, mag: 31, price: 10500 },
  heavenband: { name: 'Heaven Band', slot: 'weapon', type: 'band', atk: 72, mag: 44, price: 0 },
  // gun-arms (Barret)
  gunarm: { name: 'Gun-Arm', slot: 'weapon', type: 'gun', atk: 9, price: 130 },
  assaultgun: { name: 'Assault Gun', slot: 'weapon', type: 'gun', atk: 19, price: 620 },
  heavyvulcan: { name: 'Heavy Vulcan', slot: 'weapon', type: 'gun', atk: 34, price: 2050 },
  flamecannon: { name: 'Flame Cannon', slot: 'weapon', type: 'gun', atk: 50, el: 'fire', price: 5300 },
  thundercannon: { name: 'Thunder Cannon', slot: 'weapon', type: 'gun', atk: 68, el: 'bolt', price: 11200 },
  ultimacannon: { name: 'Ultima Cannon', slot: 'weapon', type: 'gun', atk: 92, str: 8, price: 0 },
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
