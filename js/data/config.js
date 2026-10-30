// =====================================================================
//  GAME CONFIG  —  title, place names, movie stills and music overrides
// =====================================================================
window.CONFIG = {
  title: 'FIRST FANTASY',
  subtitle: 'The Game',
  credits: 'Based on the movie by Walid & friends',

  // Names of every place in the world. Rename them after your movie's locations.
  places: {
    world: 'Aerith Vale',
    town1: 'Elmrest',     dungeon1: 'Whisper Woods',
    town2: 'Saltmere',    dungeon2: 'Sunken Grotto',
    town3: 'Hollowpeak',  dungeon3: 'Frost Keep',
    town4: 'Duneveil',    dungeon4: 'Ember Ruins',
    dungeon5: 'Rift Citadel', secret: 'Forgotten Shrine'
  },

  // Movie stills used as backdrops for cutscenes and boss battles.
  // Extract them with tools/extract_frames.sh, then point each key at a file,
  // e.g.  intro: 'assets/scenes/intro.jpg'.   null = drawn backdrop.
  scenes: {
    intro: null, festival: null, woods: null, boss1: null,
    port: null, boss2: null, snow: null, boss3: null,
    desert: null, boss4: null, rift: null, final1: null, final2: null, ending: null
  },

  // Replace the built-in chiptune music with your movie's soundtrack.
  // Keys: title, town, field, dungeon, battle, boss, final, victory, sad, ending
  music: {
    // title: 'assets/music/main_theme.mp3',
  }
};
