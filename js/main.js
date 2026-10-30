// Boot: title screen, new game flow, play-time counter.
'use strict';

async function startNewGame() {
  newGame(); applyConfig();
  await fadeTo(1, 30);
  Scenes.replaceAll({ opaque: true, draw() { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); } });
  await fadeTo(0, 1);
  await STORY.intro();
  await fadeTo(1, 20);
  const f = new FieldScene(); Ev.field = f;
  Scenes.replaceAll(f);
  f.load('town1');
  await fadeTo(0, 30);
  await f.run(() => STORY.onEnter('town1', f));
}

setInterval(() => { if (S && !document.hidden) S.time += 60; }, 1000);

(async function boot() {
  bindTouch(); fit();
  for (const c of Object.values(CAST)) Img.get(c.portrait);
  for (const p of Object.values(CONFIG.scenes || {})) Img.get(p);
  try { await document.fonts.load('8px "Press Start 2P"'); } catch (e) { /* offline: fallback font */ }
  Scenes.push(new TitleScene());
  requestAnimationFrame(loop);
})();
