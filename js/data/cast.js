// =====================================================================
//  CAST  —  the characters of the First Fantasy movie
// =====================================================================
//  Looks are taken from frames of the movie; portraits are faces cropped
//  from those frames (assets/portraits). Swap in sharper crops any time
//  with tools/make_portrait.sh.
//
//  look      : colours of the 3D model. Optional costume parts:
//              cap, headband (colours), glasses (true), dress (colour),
//              sleeveless (true), sleeve (t-shirt sleeve colour), gunArm (true),
//              weapon ('katana'), coat (true), vneck (true), baggy (true), bulk (1.2 = muscular),
//              hairLen, hairStyle: 'short' | 'long' | 'spiky' | 'hood' | 'buzz'
//  portrait  : photo of the actor (square, e.g. 128x128)
//  voice     : synthesised talk blip when there is no recorded clip
//  clips     : voice lines cut from the movie (tools/cut_audio.sh)
//              keys: intro, attack, hurt, burst, victory, ko
//  actor     : the friend who plays the role (shown in the credits)
//  job       : battle style -> brawler | monk | gunner   (party members only)
// =====================================================================

window.CAST = {
  // ---------------------------- THE THREE FRIENDS -------------------
  hero1: {
    name: 'Terry Bogard', actor: 'Actor (Terry)', job: 'brawler', title: 'The Lone Wolf',
    burstName: 'Lone Wolf Rush',
    look: { skin: '#d8a47a', hair: '#2a1c12', hairStyle: 'short', cap: '#e4ddcc', outfit: '#b02a24', outfit2: '#8a1c18',
            sleeve: '#f2f2ee', accent: '#e8c050', pants: '#3a5888', boots: '#5a3a20', eyes: '#2a1a10' },
    voice: { pitch: 150, wave: 'square' },
    portrait: 'assets/portraits/terry.png',
    clips: {},
    bio: 'Visits his father\'s grave and remembers the night the Pendant was stolen. Leads the journey to take it back.'
  },
  hero2: {
    name: 'Ryu', actor: 'Actor (Ryu)', job: 'monk', title: 'The Wandering Fighter',
    burstName: 'Dragon Wave',
    look: { skin: '#b9845a', hair: '#141010', hairStyle: 'short', headband: '#c4201c', outfit: '#f2f2ee', outfit2: '#dcdcd6',
            sleeveless: true, vneck: true, baggy: true, accent: '#1a1a1a', pants: '#f2f2ee', boots: '#b9845a', eyes: '#1a1010' },
    voice: { pitch: 175, wave: 'triangle' },
    portrait: 'assets/portraits/ryu.png',
    clips: {},
    bio: 'A martial artist in a white gi and red headband. Kyo Kusanagi was once his childhood friend.'
  },
  hero3: {
    name: 'Barret', actor: 'Actor (Barret)', job: 'gunner', title: 'The Gun-Arm',
    burstName: 'Heavy Barrage',
    look: { skin: '#c69466', hair: '#1a1410', hairStyle: 'buzz', bulk: 1.2, stubble: true, outfit: '#4a5638', outfit2: '#3a4430', sleeveless: true,
            gunArm: true, accent: '#6a5a3a', pants: '#3a3a36', boots: '#2a2420', eyes: '#1a1010' },
    voice: { pitch: 105, wave: 'sawtooth' },
    portrait: 'assets/portraits/barret.png',
    clips: {},
    bio: 'Big, loud and loyal, with a gun bolted where his right arm should be. Has a score to settle with Rufus.'
  },

  // ---------------------------- VILLAINS ----------------------------
  villain1: {
    name: 'Sephiroth', actor: 'Actor (Sephiroth)', title: 'Seeker of the Pendant',
    look: { skin: '#d8c0b0', hair: '#e8dce4', hairStyle: 'long', outfit: '#141414', outfit2: '#222226', accent: '#8a8a90',
            pants: '#141414', boots: '#0a0a0a', eyes: '#50ff90', fierce: true, weapon: 'katana', coat: true, hairLen: 1.0 },
    voice: { pitch: 90, wave: 'sawtooth' },
    portrait: 'assets/portraits/sephiroth.png',
    clips: {},
    bio: 'Hunts the Pendant, a relic powerful enough to destroy the universe.'
  },
  villain2: {
    name: 'Rufus', actor: 'Actor (Rufus)', title: 'The Man in Shades',
    look: { skin: '#d0a07a', hair: '#1a1410', hairStyle: 'short', glasses: true, outfit: '#161616', outfit2: '#161616',
            sleeve: '#161616', accent: '#2a2a2a', pants: '#4a6a9a', boots: '#2a2a2a', eyes: '#1a1010' },
    voice: { pitch: 125, wave: 'square' },
    portrait: 'assets/portraits/rufus.png',
    clips: {},
    bio: 'Works for Sephiroth. Barret\'s sworn enemy.'
  },
  villain3: {
    name: 'Kyo Kusanagi', actor: 'Actor (Kyo)', title: 'The Old Friend',
    look: { skin: '#d0a07a', hair: '#141010', hairStyle: 'short', headband: '#f0f0f0', outfit: '#151515', outfit2: '#0e0e0e',
            accent: '#9a9a9a', pants: '#7a8aa8', boots: '#3a3a3a', eyes: '#1a1010' },
    voice: { pitch: 140, wave: 'square' },
    portrait: 'assets/portraits/kyo.png',
    clips: {},
    bio: 'Ryu\'s childhood friend, now guarding the island for Sephiroth.'
  },
  villain4: {
    name: 'The Stranger', actor: 'Actor (Stranger)', title: 'Something in the Dark',
    look: { skin: '#b8a090', hair: '#1a1a1a', hairStyle: 'hood', outfit: '#2a2a30', outfit2: '#1a1a20', accent: '#4a4a50',
            pants: '#222228', boots: '#141414', eyes: '#ffffff' },
    voice: { pitch: 80, wave: 'sawtooth' },
    portrait: null, clips: {},
    bio: 'A random stranger met while running through the forest at night.'
  },
  villain5: {
    name: 'Black Viper', actor: 'Actor (Villain 2)', title: 'Second Unknown Villain',
    look: { skin: '#c89a70', hair: '#101010', hairStyle: 'spiky', outfit: '#3a1a40', outfit2: '#24102a', accent: '#c0a040',
            pants: '#1a1a1a', boots: '#101010', eyes: '#ff3030' },
    voice: { pitch: 115, wave: 'square' },
    portrait: null, clips: {},
    bio: 'The second villain, who takes on Ryu. Placeholder name: rename in js/data/cast.js.'
  },
  villain6: {
    name: 'The Cartographer', actor: 'Actor (Villain 3)', title: 'Third Unknown Villain',
    look: { skin: '#d0a07a', hair: '#5a3a1a', hairStyle: 'long', outfit: '#6a4a2a', outfit2: '#4a3018', accent: '#e0c050',
            pants: '#3a2a1a', boots: '#2a1a10', eyes: '#202020' },
    voice: { pitch: 120, wave: 'triangle' },
    portrait: null, clips: {},
    bio: 'The third villain. Carries the map of the island. Placeholder name: rename in js/data/cast.js.'
  },

  // ---------------------------- SUPPORTING ROLES --------------------
  aeris: {
    name: 'Aeris', actor: 'Actress (Aeris)', title: 'Old Friend',
    look: { skin: '#e0b48c', hair: '#4a2e1c', hairStyle: 'long', dress: '#a8201c', outfit: '#a8201c', outfit2: '#8a1814',
            sleeveless: true, accent: '#a8201c', pants: '#a8201c', boots: '#5a2a1a', eyes: '#2a5a30' },
    voice: { pitch: 270, wave: 'triangle' },
    portrait: 'assets/portraits/aeris.png',
    clips: {},
    bio: 'A friend of the three, waiting for them at the Roman theater.'
  },
  father: {
    name: 'Terry\'s Father', actor: 'Actor (Father)', title: 'Keeper of the Pendant',
    look: { skin: '#d0a07a', hair: '#9a9a9a', hairStyle: 'short', outfit: '#e8e4dc', outfit2: '#c8c4bc', sleeve: '#e8e4dc',
            accent: '#5a4a3a', pants: '#5a5a60', boots: '#3a2a1a', eyes: '#202020' },
    voice: { pitch: 120, wave: 'triangle' }, portrait: null, clips: {},
    bio: 'Guarded the Pendant at the family villa until the night he was attacked.'
  }
};
