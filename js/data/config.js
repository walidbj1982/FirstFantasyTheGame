// =====================================================================
//  GAME CONFIG  —  title, place names, movie stills and music overrides
// =====================================================================
window.CONFIG = {
  title: 'FIRST FANTASY',
  subtitle: 'The Pendant',
  credits: 'Based on the movie by Walid Ben Jemia & friends',

  // 3D quality: 'high' (sharp, soft shadows) or 'low' (for older phones).
  graphics: 'high',
  // Put the actors' portrait photos onto the 3D faces (works best with sharp, front-facing photos).
  photoFaces: false,

  // Places from the movie. Rename freely.
  places: {
    world: 'The Coast',
    town1: 'Old Town',       dungeon1: 'Dark Forest',
    town2: 'Harbor Town',    dungeon2: 'Dry Hills',
    town3: 'Olive Village',  dungeon3: 'Rocky Canyon',
    town4: 'Fishing Port',   dungeon4: 'Cliff Hideout',
    dungeon5: 'Roman Theater', island: 'The Island', secret: 'Forgotten Shrine'
  },

  // Stills from the movie (assets/scenes, cut with tools/save_still.sh).
  // A key set to null is staged in 3D instead.
  scenes: {
    intro: 'assets/scenes/title_gate.jpg',
    forest: 'assets/scenes/dark_forest.jpg',
    map: 'assets/scenes/world_map.jpg',
    boat: 'assets/scenes/boat.jpg',
    island: 'assets/scenes/island.jpg',
    sephiroth: 'assets/scenes/sephiroth.jpg',
    graveyard: null, flashback: null, festival: null, boss1: null, port: null, boss2: null, hills: null, boss3: null,
    coast: null, boss4: null, jetski: null, kyo: null, theater: null, final1: null, final2: null, ending: null
  },

  // Replace the built-in chiptune music with the movie's soundtrack.
  // Keys: title, town, field, dungeon, battle, boss, final, victory, sad, ending
  music: {
    // battle: 'assets/music/battle.mp3',
  }
};
// ?gfx=low in the page address forces the light graphics mode (?gfx=off: 2D fallback, used by tests)
try { const m = /[?&]gfx=(low|off)/.exec(location.search); if (m) CONFIG.graphics = m[1]; } catch (e) {}
