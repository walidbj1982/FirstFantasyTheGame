// =====================================================================
//  CAST  —  EDIT THIS FILE TO PUT YOUR MOVIE INTO THE GAME
// =====================================================================
//  Every hero and villain in the game is defined here. The names, looks,
//  voices and portraits below are PLACEHOLDERS: replace them with the
//  characters (and actors) from your movie.
//
//  look      : colours used to draw the pixel-art sprite (any CSS colour)
//              hairStyle: 'short' | 'long' | 'spiky' | 'hood'
//  portrait  : path to a photo of the actor (square works best, e.g. 128x128)
//              shown in dialogue, menus and the battle status bar.
//              Use tools/extract_frames.sh + tools/make_portrait.sh to cut
//              one out of the movie. null = use a generated pixel face.
//  voice     : synthesised "talk blip" used when there is no recorded clip.
//              pitch in Hz (lower = deeper), wave: square|triangle|sawtooth|sine
//  clips     : short audio files cut from the movie (tools/cut_voice.sh).
//              Keys used by the game: intro, attack, hurt, burst, victory, ko
//              e.g. clips: { attack: 'assets/voices/hero1_attack.mp3' }
//  actor     : the real person playing the role (shown in the credits)
//  job       : battle class -> knight | mage | healer | rogue  (heroes only)
// =====================================================================

window.CAST = {
  // ---------------------------- HEROES ------------------------------
  hero1: {
    name: 'Ryn', actor: 'Actor 1', job: 'knight', title: 'Village Swordhand',
    burstName: 'Dawnbreaker',
    look: { skin: '#f0c090', hair: '#3a2416', hairStyle: 'spiky', outfit: '#2f5fb3',
            outfit2: '#1d3c78', accent: '#e8c050', pants: '#3b3346', eyes: '#1c1c3c' },
    voice: { pitch: 150, wave: 'square' },
    portrait: null,
    clips: {},
    bio: 'Placeholder hero. Replace with the lead character of your movie.'
  },
  hero2: {
    name: 'Lena', actor: 'Actor 2', job: 'mage', title: 'Spark Weaver',
    burstName: 'Starfall',
    look: { skin: '#f6d2b0', hair: '#b8322e', hairStyle: 'long', outfit: '#7a2f9a',
            outfit2: '#4a1a63', accent: '#f0e070', pants: '#2a2340', eyes: '#2a5a20' },
    voice: { pitch: 260, wave: 'triangle' },
    portrait: null,
    clips: {},
    bio: 'Placeholder hero. A spell-caster who joins in the first village.'
  },
  hero3: {
    name: 'Toma', actor: 'Actor 3', job: 'healer', title: 'Harbor Healer',
    burstName: 'Tide of Mercy',
    look: { skin: '#a8714a', hair: '#ececec', hairStyle: 'hood', outfit: '#e8e8f0',
            outfit2: '#3f9a8a', accent: '#3f9a8a', pants: '#4a4a5a', eyes: '#202020' },
    voice: { pitch: 200, wave: 'sine' },
    portrait: null,
    clips: {},
    bio: 'Placeholder hero. A healer met at the port town.'
  },
  hero4: {
    name: 'Kit', actor: 'Actor 4', job: 'rogue', title: 'Snowfield Thief',
    burstName: 'Thousand Cuts',
    look: { skin: '#e8b88a', hair: '#1a1a1a', hairStyle: 'short', outfit: '#3a6a3a',
            outfit2: '#203d20', accent: '#c07030', pants: '#2b2b2b', eyes: '#3a2010' },
    voice: { pitch: 230, wave: 'square' },
    portrait: null,
    clips: {},
    bio: 'Placeholder hero. A thief who starts on the wrong side.'
  },

  // ---------------------------- VILLAINS ----------------------------
  villain1: {
    name: 'Vexis', actor: 'Actor 5', title: 'Lord of the Rift',
    look: { skin: '#c8c0d8', hair: '#e0e0f0', hairStyle: 'long', outfit: '#1a1a24',
            outfit2: '#5a0e2a', accent: '#c02040', pants: '#101018', eyes: '#ff2040' },
    voice: { pitch: 95, wave: 'sawtooth' },
    portrait: null,
    clips: {},
    bio: 'Placeholder main villain. Make this your movie\'s big bad.'
  },
  villain2: {
    name: 'Sable', actor: 'Actor 6', title: 'The Black Hand',
    look: { skin: '#d8b090', hair: '#101010', hairStyle: 'hood', outfit: '#2a2a2a',
            outfit2: '#601818', accent: '#d0a030', pants: '#1a1a1a', eyes: '#ffb000' },
    voice: { pitch: 130, wave: 'sawtooth' },
    portrait: null,
    clips: {},
    bio: 'Placeholder second-in-command.'
  },
  villain3: {
    name: 'Hask', actor: 'Actor 7', title: 'Warden of Frost',
    look: { skin: '#9fb6c8', hair: '#ffffff', hairStyle: 'spiky', outfit: '#3a5a8a',
            outfit2: '#1a2a4a', accent: '#a0e0ff', pants: '#202a3a', eyes: '#80ffff' },
    voice: { pitch: 110, wave: 'square' },
    portrait: null,
    clips: {},
    bio: 'Placeholder lieutenant guarding the north.'
  },
  villain4: {
    name: 'Grimble', actor: 'Actor 8', title: 'Bumbling Henchman',
    look: { skin: '#b0c070', hair: '#5a3a1a', hairStyle: 'short', outfit: '#8a5a2a',
            outfit2: '#5a3a1a', accent: '#ff8030', pants: '#3a2a1a', eyes: '#000000' },
    voice: { pitch: 320, wave: 'square' },
    portrait: null,
    clips: {},
    bio: 'Placeholder comic henchman — the first boss.'
  },

  // ------------------------ SUPPORTING ROLES ------------------------
  elder: {
    name: 'Elder Maro', actor: 'Actor 9',
    look: { skin: '#e0b090', hair: '#d0d0d0', hairStyle: 'long', outfit: '#6a5a3a',
            outfit2: '#4a3a2a', accent: '#c0a060', pants: '#3a3a3a', eyes: '#202020' },
    voice: { pitch: 120, wave: 'triangle' }, portrait: null, clips: {}
  }
};
