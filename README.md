# First Fantasy — The Pendant

A short PS1-style 3D RPG based on the *First Fantasy* fan movie (parts 1 & 2) by Walid Ben Jemia
and friends. It runs in any web browser, on desktop or phone, with nothing to install.

**Story:** Sephiroth is hunting the Pendant, a relic powerful enough to destroy the universe.
Terry Bogard, Ryu and Barret set out to stop him. The game follows the movie scene by scene:
- Terry's flashback at the graveyard
- the night run through the Dark Forest
- Barret vs Rufus
- Ryu's fight with the second villain
- the third villain and the island map
- the boat crossing and the jet ski attack
- Kyo Kusanagi on the island
- Aeris and the final battle with Sephiroth at the Roman theater

**Built from the movie so far:** character faces and costumes come from frames of the movie
(`assets/reference`, cropped into `assets/portraits`), and movie stills are used as cutscene
backdrops (`assets/scenes`). Not yet known from the movie: the names of the second and third
villains (placeholders: Black Viper, The Cartographer), the Stranger's look, Terry's costume
apart from the cap, and the actors' names (`actor` in `js/data/cast.js`).

The character names (Terry Bogard, Ryu, Barret, Sephiroth, Rufus, Kyo Kusanagi, Aeris) belong to
their publishers. That's fine for a personal fan project like the movie, but don't sell the game.

## Play

- **Desktop:** open `index.html` in a browser (double-click works, no server needed).
- **One file to share:** `node tools/bundle.js` writes `dist/first-fantasy.html`. That single file
  holds the whole game, including any portraits, voices and stills you've added, so you can send it to friends.
- **Phone / share with friends:** enable GitHub Pages for this repo (Settings → Pages → deploy from
  branch) and open the published URL. On-screen D-pad and A/B buttons appear on touch screens.

| Action | Keyboard | Touch |
|---|---|---|
| Move / menu cursor | Arrow keys or WASD | D-pad |
| Confirm, talk, open chests | Z, Enter, Space | A |
| Cancel, open the field menu | X, Esc, Backspace | B |
| Switch between ready heroes in battle | Left / Right | D-pad |

The game saves to the browser (3 slots). Save on the world map, at blue crystals in dungeons, or at an inn.

## What's in the game

- **HD 3D graphics in the spirit of FF7 and modern fighting games:** muscular, detailed character
  models with layered costumes (Terry's quilted vest, popped collar and fingerless gloves, Ryu's
  crossover gi, black belt and torn hems, Barret's tank top, shoulder pad and Gatling arm, Sephiroth's
  leather coat and katana), painted faces and hair, real-time battles with soft shadows,
  painted sky panoramas (Mediterranean villages, sea horizons, canyon mesas, the starry night forest),
  sky-lit materials and generated textures (grass, sand, cobblestones, whitewash, ancient stone,
  wood, water, leather). The scenery is filled with umbrella pines, cypresses, olive trees, palms,
  bougainvillea, grass, dry-stone walls, agaves, driftwood, lanterns, braziers, statues, loungers and
  barrels, with fireflies, dust and embers in the air. All of it is generated in code, so the game stays a single small file.
  Set `graphics: 'low'` in `js/data/config.js` for older phones.
- **Faces:** the 3D models get painted faces in each actor's colours, and the actors' real photos
  appear in dialogue, menus, the battle bar and the cast screen. With sharp, front-facing photos,
  `photoFaces: true` in `config.js` puts the photos on the 3D heads too.
- **Length:** five chapters, four towns, six dungeons (25 floors). A first run should take roughly
  4–6 hours. That's an estimate from encounter rates and the level curve, not a timed playthrough.
  The optional shrine and superboss add more. To lengthen it, raise `floors` (and add `loot` rows)
  per dungeon in `js/data/world.js`.
- **Party of three**, each with their own fighting style: Terry the Brawler (Ground Wave, Knuckle Rush,
  Geyser), Ryu the Martial Artist (Ki Blast, Rising Dragon, Chi Heal, Revive) and Barret the Gunner
  (Big Shot, Rapid Fire, Grenade, Gatling). Each learns 8–12 moves by level.
- **Active-time battles** in the style of the 16-bit classics: ATB gauges, elemental
  weaknesses, status effects (poison, sleep, silence, blind, slow, protect, shell, haste, regen),
  and a **Burst** gauge that fills as a hero takes damage and unleashes a named super move.
- **Villains as bosses:** the Stranger, Rufus and his bodyguards, two more villains, a jet ski gang at sea,
  Kyo Kusanagi (who runs away mid-fight, like in the movie) and Sephiroth in two phases.
- **World:** a sunny Mediterranean coast with whitewashed towns, olive hills, a canyon and beaches,
  unlocked in story order, plus the island reached by boat. Dungeon floors are generated from a fixed seed, so each
  floor is the same every time. Treasure chests hold gear you can't buy.
- **Economy:** shops with gear upgrades per town, inns, sell-back, and steal-only items.
- **Original orchestral soundtrack:** 13 pieces composed for the game and played live by a synthesised
  orchestra (strings, harp, flute, oboe, horns, brass, choir, church organ, piano, mandolin, guitars,
  timpani, rock and orchestral drums) in a concert-hall reverb:
  *The Pendant* (title), *Whitewashed Streets* (towns), *Across the Coast* (world map), *Something in
  the Dark* (the night forest), *Into the Depths* (hills, canyon, hideout), *The Old Theater*, *Two
  Kilometres* (the boat), *Fists Clenched* (battle), *Rival's Challenge* (bosses), *Wings of Ruin*
  (Sephiroth), *Triumph* (victory), *Aeris* (sorrow) and the ending. Any track can be replaced by
  music from the movie. `node tools/render_music.js` exports the whole soundtrack as WAV/MP3 files.

## Make it *your* movie

Everything about the movie lives in three files plus the `assets/` folder:

| File | What to change |
|---|---|
| `js/data/cast.js` | Each hero's and villain's name, actor, colours, hair style, voice pitch, **portrait photo** and **voice clips** |
| `js/data/config.js` | Game title, every place name, **movie stills** for cutscenes/boss fights, **soundtrack** overrides |
| `js/data/story.js` | All dialogue and cutscenes. Plain text with `${N.hero1}` for names |

### 1. Get the movie files
Put the two movie parts somewhere on your computer (the original files, or download your own
uploads with `yt-dlp https://youtu.be/SYmzlC6F2VE -o part1.mp4`). You need [ffmpeg](https://ffmpeg.org/) installed.

### 2. Faces: actor portraits
```bash
tools/extract_frames.sh part1.mp4 frames 5
```
Look through `frames/contact_*.jpg` (timestamps are printed on each tile), pick a frame where the
actor's face is clear, then crop a square around it (x, y = top-left corner, size in pixels):
```bash
tools/make_portrait.sh frames/frame_0042.jpg 210 60 180 assets/portraits/hero1.png
```
Then in `cast.js`: `portrait: 'assets/portraits/hero1.png'`. The photo appears in dialogue,
menus, the battle status bar, save files and the cast screen, and on the 3D model's face.

Also set each character's `look` colours (skin, hair, outfit) and `hairStyle` to match their
costume. The 3D models are built from these colours, and the portrait photo becomes their face texture.

### 3. Voices: real lines from the actors
```bash
tools/cut_audio.sh part1.mp4 00:03:12.5 1.8 assets/voices/hero1_attack.mp3
```
Then in `cast.js`: `clips: { attack: 'assets/voices/hero1_attack.mp3' }`. Supported keys:
`intro` (cast screen), `attack`, `hurt`, `burst`, `victory`, `ko`.
Any dialogue line can also play a clip: `Ev.say('hero1', 'Line text', 'assets/voices/line1.mp3')`.
Characters without clips "talk" with a synthesised blip at their `voice.pitch`.

### 4. Scenes: stills from the movie
```bash
tools/save_still.sh part2.mp4 00:41:10 assets/scenes/boss4.jpg
```
Then in `config.js`: `scenes: { boss4: 'assets/scenes/boss4.jpg', ... }`. Scene keys are used by
cutscenes and as the sky behind the matching boss battle. Cutscenes without a still are staged
in 3D, and each character steps on stage the first time they speak.

### 5. Music
```bash
tools/cut_audio.sh part2.mp4 00:12:00 90 assets/music/battle.mp3
```
Then in `config.js`: `music: { battle: 'assets/music/battle.mp3' }`.

### 6. Story, villains and places
Rename places in `config.js` and rewrite dialogue in `story.js` to follow the movie. The chapter
structure (village → port → snowfields → desert → final citadel) can be renamed freely. Boss
stats are in `js/data/enemies.js` (`boss_*`), and monsters per area are in `ZONES` in the same file.

## Project layout

```
index.html            page + touch controls
js/engine.js          canvas, input, sound effects, the synthesised orchestra, scene stack
js/gfx.js             procedural textures, painted sky panoramas, smooth geometry, trees and props
js/render3d.js        3D layer: HD renderer, characters/monsters, battle & cutscene stages, 3D maps
js/sprites.js         map tile definitions and 2D fallback art (used if WebGL is unavailable)
js/vendor/three.min.js  three.js r128 (MIT, see three.LICENSE)
js/field.js           map exploration, NPCs, chests, encounters, event-script API (Ev)
js/battle.js          active-time battle system
js/menu.js            field menu, equipment, status, save/load, title, cast screen
js/ui.js              dialogue boxes, choices, shops, cutscene backdrops
js/state.js           party, stats, inventory, saves
js/data/*.js          cast, config, story, rules (jobs/skills/items/gear), enemies, world, music (the score)
tools/*.sh            ffmpeg helpers to pull portraits, voices, stills and music from the movie
tools/bundle.js       packs the game and its assets into a single shareable HTML file
tools/render_music.js renders the soundtrack to WAV/MP3 files
tests/                balance simulator, world/dungeon connectivity checks, browser flow tests
```

## Tests

```bash
node tests/world_check.js        # every region/dungeon reachable in story order, data references valid
node tests/balance.js            # Monte-Carlo win rates for every stage of the game
node tests/music_check.js        # every track parses and its instruments stay in sync
node tests/audio_check.js        # every track is audible in a real browser (needs the local server)
python3 -m http.server 8765 &    # then, with Playwright installed:
node tests/flows.js "http://localhost:8765/index.html?gfx=off" /tmp   # story, bosses, shop, menus, save/load, game over (2D mode runs fast headless)
```
