// Plays every soundtrack track in a real (headless) browser and checks that each one is audible,
// and that switching tracks works.  Usage: node tests/audio_check.js [url]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:8765/index.html?gfx=off';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }), p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(1200);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(300); // first input unlocks audio
  const names = await p.evaluate(() => Object.keys(TRACKS));
  let bad = 0;
  for (const name of names) {
    const r = await p.evaluate(async name => {
      if (!window._an) { window._an = Sound.ac.createAnalyser(); window._an.fftSize = 4096; Sound.master.connect(window._an); }
      Music.play(name); await new Promise(r => setTimeout(r, 2500));
      const d = new Float32Array(4096); let s = 0, n = 0;
      for (let k = 0; k < 8; k++) { window._an.getFloatTimeDomainData(d); for (const x of d) { s += x * x; n++; } await new Promise(r => setTimeout(r, 120)); }
      return { playing: Music.name === name && !!Music.cur, rms: Math.sqrt(s / n) };
    }, name);
    const ok = r.playing && r.rms > 0.002;
    if (!ok) bad++;
    console.log(`${name.padEnd(8)} ${ok ? 'OK ' : 'SILENT'} rms ${r.rms.toFixed(4)}`);
  }
  if (errs.length) { console.log('page errors:', errs.slice(0, 5)); bad++; }
  console.log(bad ? `${bad} PROBLEM(S)` : 'ALL TRACKS AUDIBLE');
  await b.close(); process.exit(bad ? 1 : 0);
})();
