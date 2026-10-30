# First Fantasy — The Game

A short, classic-style JRPG inspired by the *First Fantasy* movie (parts 1 & 2). It runs in any
web browser, on desktop or phone, with nothing to install.

> **Status:** the engine, world, battle system and a full five-chapter campaign are done and playable.
> The **cast, dialogue and place names are placeholders** because the movie could not be watched
> while this was built. They all live in a few data files so the movie's characters, actors'
> photos, voices and scenes can be dropped in. See [Make it *your* movie](#make-it-your-movie).

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

- **Late-90s 3D style:** low-poly characters with chunky limbs and textured faces, real-time
  3D battles with a camera that spins in and follows the action, a 3D world map, towns and
  dungeons. The 3D is rendered at low resolution with PlayStation-style vertex wobble, under
  blue gradient menu windows. Dialogue portraits are rendered from each character's 3D model,
  or use the actor's photo when you add one.

- **Length:** five chapters, four towns, six dungeons (25 floors). A first run should take roughly
  4–6 hours. That's an estimate from encounter rates and the level curve, not a timed playthrough.
  The optional shrine and superboss add more. To lengthen it, raise `floors` (and add `loot` rows)
  per dungeon in `js/data/world.js`.
- **Party of four**, each with a job: Knight (heavy hits, party buffs), Mage (elemental magic),
  Healer (cures, revives, Holy), Rogue (steals rare items, fast multi-hits). Each has 8–14 skills learned by level.
- **Active-time battles** in the style of the 16-bit classics: ATB gauges, elemental
  weaknesses, status effects (poison, sleep, silence, blind, slow, protect, shell, haste, regen),
  and a **Burst** gauge that fills as a hero takes damage and unleashes a named super move.
- **Villains as bosses:** four villains from the cast fight you in person. The final battle has two phases.
- **World:** a 72×52 overworld with four regions (grassland, coast, snowfields, desert) unlocked
  in story order, plus the Rift wasteland. Dungeon floors are generated from a fixed seed, so each
  floor is the same every time. Treasure chests hold gear you can't buy.
- **Economy:** shops with gear upgrades per town, inns, sell-back, and steal-only items.
- **Original chiptune soundtrack** (title, town, field, dungeon, battle, boss, final, victory, ending),
  synthesised live. Any track can be replaced by music from the movie.

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
js/engine.js          canvas, input, audio synth, scene stack
js/render3d.js        3D layer: PS1-style renderer, low-poly characters/monsters, battle & cutscene stages, 3D maps
js/sprites.js         map tile definitions and 2D fallback art (used if WebGL is unavailable)
js/vendor/three.min.js  three.js r128 (MIT, see three.LICENSE)
js/field.js           map exploration, NPCs, chests, encounters, event-script API (Ev)
js/battle.js          active-time battle system
js/menu.js            field menu, equipment, status, save/load, title, cast screen
js/ui.js              dialogue boxes, choices, shops, cutscene backdrops
js/state.js           party, stats, inventory, saves
js/data/*.js          cast, config, story, rules (jobs/skills/items/gear), enemies, world, music
tools/*.sh            ffmpeg helpers to pull portraits, voices, stills and music from the movie
tools/bundle.js       packs the game and its assets into a single shareable HTML file
tests/                balance simulator, world/dungeon connectivity checks, browser flow tests
```

## Tests

```bash
node tests/world_check.js        # every region/dungeon reachable in story order, data references valid
node tests/balance.js            # Monte-Carlo win rates for every stage of the game
python3 -m http.server 8765 &    # then, with Playwright installed:
node tests/flows.js http://localhost:8765/index.html /tmp   # story, bosses, shop, menus, save/load, game over
```
