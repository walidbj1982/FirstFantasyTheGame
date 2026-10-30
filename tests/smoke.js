// Headless smoke test: boots the game, plays through the opening and a battle, captures screenshots.
// Usage: node tests/smoke.js [url] [outDir]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html';
const out = process.argv[3] || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(1500);
  const shot = n => page.screenshot({ path: `${out}/${n}.png` });
  const press = async (k, n = 1, gap = 120) => { for (let i = 0; i < n; i++) { await page.keyboard.down(k); await page.waitForTimeout(40); await page.keyboard.up(k); await page.waitForTimeout(gap); } };
  await shot('01_title');
  await press('ArrowUp'); // ensure "New Game"
  await page.evaluate(() => { Scenes.top().i = 0; });
  await press('KeyZ');
  await page.waitForTimeout(800);
  await shot('02_intro');
  for (let i = 0; i < 60; i++) { await press('KeyZ', 1, 150); }
  await page.waitForTimeout(500);
  await shot('03_town');
  const st = await page.evaluate(() => ({ party: S.party, map: S.pos && S.pos.map, top: Scenes.top().constructor.name, flags: S.flags }));
  console.log('state', JSON.stringify(st));
  // force a battle
  await page.evaluate(() => { Ev.field.run(() => Ev.battle(['jelly', 'goblin', 'cavebat'], { bg: 'grass' })); });
  await page.waitForTimeout(3500);
  await shot('04_battle');
  for (let i = 0; i < 80; i++) { await press('KeyZ', 1, 100); const t = await page.evaluate(() => Scenes.top().constructor.name); if (t !== 'BattleScene') break; }
  await page.waitForTimeout(500);
  await shot('05_after_battle');
  console.log('after', await page.evaluate(() => JSON.stringify({ top: Scenes.top().constructor.name, lv: S.party.map(id => S.members[id].lv), gil: S.gil })));
  // world map
  await page.evaluate(() => Ev.field.goto('world', 9, 34, 'down'));
  await page.waitForTimeout(1200);
  await shot('06_world');
  // dungeon
  await page.evaluate(() => Ev.field.goto('dungeon1:0'));
  await page.waitForTimeout(1200);
  await shot('07_dungeon');
  // menu
  await press('KeyX'); await page.waitForTimeout(400); await shot('08_menu');
  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
