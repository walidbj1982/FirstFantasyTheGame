// Browser test of the main flows: story events, boss fights, shop, menus, save/load.
// Usage: node tests/flows.js [url] [outDir]   (serve the repo root first, e.g. python3 -m http.server 8765)
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html';
const out = process.argv[3] || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 760 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(1200);
  const shot = n => page.screenshot({ path: `${out}/${n}.png` });
  const press = async (k, n = 1, gap = 90) => { for (let i = 0; i < n; i++) { await page.keyboard.down(k); await page.waitForTimeout(35); await page.keyboard.up(k); await page.waitForTimeout(gap); } };
  const top = () => page.evaluate(() => Scenes.top().constructor.name);
  const until = async (cond, key = 'KeyZ', max = 400) => { for (let i = 0; i < max; i++) { if (await page.evaluate(cond)) return true; await press(key, 1, 60); } return false; };
  // cast screen
  await page.evaluate(() => { Scenes.push(new CastScene()); }); await page.waitForTimeout(300); await shot('10_cast'); await press('KeyX');
  // new game, skip through intro
  await page.evaluate(() => { Scenes.top().i = 0; }); await press('KeyZ');
  await until(() => S && S.flags.ch1_start && Scenes.top() instanceof FieldScene && !Ev.field.lock);
  // dialog screenshot: talk to elder
  await page.evaluate(() => { const f = Ev.field; f.px = 11; f.py = 5; f.dir = 'up'; });
  await press('KeyZ'); await page.waitForTimeout(700); await shot('11_dialog'); await until(() => !Ev.field.lock);
  // shop
  await page.evaluate(() => { S.gil = 5000; Ev.field.run(() => Ev.field.shop('weapons')); }); await page.waitForTimeout(200);
  await press('KeyZ'); await press('ArrowDown'); await page.waitForTimeout(200); await shot('12_shop');
  await press('KeyZ'); await press('KeyZ'); await press('KeyX'); await press('KeyX'); await until(() => !Ev.field.lock, 'KeyX');
  // menu: equip
  await press('KeyX'); await page.waitForTimeout(200); await shot('13_menu');
  await press('ArrowDown', 2); await press('KeyZ'); await press('KeyZ'); await press('KeyZ'); await page.waitForTimeout(200); await shot('14_equip');
  await press('KeyZ'); await press('KeyX', 3);
  await press('ArrowUp', 8); await press('ArrowDown', 3); await press('KeyZ'); await press('KeyZ'); await page.waitForTimeout(200); await shot('15_status');
  await press('KeyX', 4); await until(() => !Ev.field.lock, 'KeyX');
  const eq = await page.evaluate(() => S.members.hero1.eq.weapon); console.log('hero1 weapon after equip:', eq);
  // world walk with encounters
  await page.evaluate(() => { Ev.field.goto('world', 6, 38, 'down'); }); await page.waitForTimeout(800);
  let enc = false;
  for (let i = 0; i < 60 && !enc; i++) { await page.keyboard.down(i % 2 ? 'ArrowRight' : 'ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up(i % 2 ? 'ArrowRight' : 'ArrowLeft'); enc = (await top()) === 'BattleScene'; }
  console.log('random encounter triggered by walking:', enc);
  if (enc) { await page.waitForTimeout(1200); await until(() => !(Scenes.top() instanceof BattleScene)); }
  // boss 1 with a stronger party
  await page.evaluate(() => { for (const id of S.party) { const m = S.members[id]; m.lv = 9; const st = stats(m); m.hp = st.maxhp; m.mp = st.maxmp; } Ev.field.goto('dungeon1:2'); return 0; });
  await page.waitForTimeout(900); await shot('16_boss_floor');
  await page.evaluate(() => { const f = Ev.field, b = f.map.objs.find(o => o.type === 'boss'); Ev.field.run(() => STORY.boss('dungeon1', f)); });
  await until(() => Scenes.top() instanceof BattleScene); await page.waitForTimeout(1500); await shot('17_boss_battle');
  await until(() => Scenes.top() instanceof BattleScene && Scenes.top().state === 'victory', 'KeyZ', 600); await page.waitForTimeout(300); await shot('18_victory');
  await until(() => Scenes.top() instanceof FieldScene && !Ev.field.lock, 'KeyZ', 400);
  console.log('after boss1', await page.evaluate(() => JSON.stringify({ flags: S.flags, portal: Ev.field.map.objs.filter(o => o.type === 'portal').length })));
  // chapter 2 arrival
  await page.evaluate(() => { Ev.field.goto('town2'); }); await page.waitForTimeout(500);
  await until(() => S.party.length === 3 && !Ev.field.lock, 'KeyZ', 300);
  console.log('party after ch2:', await page.evaluate(() => S.party.join(',')));
  // Hask fight with minions, 4 members
  await page.evaluate(() => { for (const id of S.party) { const m = S.members[id]; m.lv = 24; const st = stats(m); m.hp = st.maxhp; m.mp = st.maxmp; } Ev.field.run(() => Ev.battle(['boss_viper'], { boss: true, noRun: true, bg: 'canyon' })); });
  await page.waitForTimeout(1600); await shot('19_hask');
  // try skill menu
  await until(() => Scenes.top().menu); await press('ArrowDown'); await press('KeyZ'); await page.waitForTimeout(200); await shot('20_skillmenu'); await press('KeyX', 2);
  await until(() => !(Scenes.top() instanceof BattleScene), 'KeyZ', 900);
  console.log('after viper top:', await top());
  // final boss look
  await page.evaluate(() => { if (!(Scenes.top() instanceof FieldScene)) return; for (const id of S.party) { const m = S.members[id]; m.lv = 60; const st = stats(m); m.hp = st.maxhp; m.mp = st.maxmp; } Ev.field.run(() => Ev.battle(['boss_sephiroth2'], { boss: true, noRun: true, bg: 'rift', music: 'final' })); });
  await page.waitForTimeout(1600); await shot('21_final');
  await until(() => !(Scenes.top() instanceof BattleScene), 'KeyZ', 900);
  // save & load
  await page.evaluate(() => { Ev.field.goto('world', 10, 34); }); await page.waitForTimeout(600);
  await page.evaluate(() => saveGame(1));
  const saved = await page.evaluate(() => JSON.stringify(slotSummary(1)));
  console.log('slot1', saved);
  await page.evaluate(() => { Scenes.replaceAll(new LoadScene()); }); await page.waitForTimeout(200); await shot('22_load');
  await press('KeyZ'); await page.waitForTimeout(1200);
  console.log('after load top:', await top(), await page.evaluate(() => S.pos.map));
  // game over path
  await page.evaluate(() => { for (const id of S.party) S.members[id].hp = 1; S.members[S.party[0]].lv = 1; Ev.field.run(() => Ev.battle(['boss_forgotten'], { boss: true, noRun: true })); });
  await until(() => Scenes.top() instanceof GameOverScene, 'KeyX', 900); await page.waitForTimeout(1200); await shot('23_gameover');
  console.log('game over reached:', await top());
  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
