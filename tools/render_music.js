// Renders the game's soundtrack to audio files (WAV, plus MP3 if ffmpeg is installed),
// using the same synthesised orchestra as the game, in a headless browser.
//   usage: node tools/render_music.js [outDir] [seconds] [track ...]
//   needs: a local server on port 8765 (python3 -m http.server 8765) and Playwright
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const outDir = process.argv[2] || 'dist/soundtrack', secs = +(process.argv[3] || 40), only = process.argv.slice(4);
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(), page = await browser.newPage();
  await page.goto('http://localhost:8765/index.html?gfx=off'); await page.waitForTimeout(1000);
  const names = only.length ? only : await page.evaluate(() => Object.keys(TRACKS));
  for (const name of names) {
    const res = await page.evaluate(async ([name, secs]) => {
      const SR = 44100, off = new OfflineAudioContext(2, SR * secs, SR), tr = TRACKS[name];
      const saved = { ac: Sound.ac, music: Sound.music, noiseBuf: Sound.noiseBuf, bus: Orchestra.bus, verb: Orchestra.verb, tg: Orchestra.tg };
      Sound.ac = off; Sound.music = off.createGain(); Sound.music.gain.value = 0.6; Sound.music.connect(off.destination);
      Sound.noiseBuf = off.createBuffer(1, SR, SR); const nd = Sound.noiseBuf.getChannelData(0); for (let i = 0; i < SR; i++) nd[i] = Math.random() * 2 - 1;
      Orchestra.bus = null; Orchestra.init(); const tg = Orchestra.track(tr.reverb != null ? tr.reverb : 0.3);
      const step = 60 / tr.bpm / 4, mk = p => ({ ...p, seq: p.kit ? parseKit(p.kit) : parseNotes(p.n) });
      const intro = (tr.intro || []).map(mk), main = tr.parts.map(mk), introLen = intro.length ? seqLength(intro[0].seq) * step : 0;
      const sched = (c, t, once) => {
        do {
          for (const [notes, len, acc] of c.seq) {
            if (t > secs) return;
            const dur = len * step, v = (c.v || 0.1) * (acc ? 1.35 : 1);
            if (notes) { if (c.kit) for (const ch of notes) Orchestra.drum(ch, t, v, c.pan || 0, tg); else for (const n of notes) Orchestra.note(c.inst, n + (c.t || 0), t, dur * (c.gate || 0.95), v, c.pan || 0, tg); }
            t += dur;
          }
        } while (!once && !tr.once && t < secs);
      };
      intro.forEach(c => sched(c, 0.05, true)); main.forEach(c => sched(c, 0.05 + introLen, false));
      const buf = await off.startRendering();
      Object.assign(Sound, { ac: saved.ac, music: saved.music, noiseBuf: saved.noiseBuf }); Object.assign(Orchestra, { bus: saved.bus, verb: saved.verb, tg: saved.tg });
      // 16-bit stereo WAV with a short fade-out
      const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, data = new DataView(new ArrayBuffer(44 + n * 4));
      const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
      data.setUint32(24, SR, true); data.setUint32(28, SR * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * 4, true);
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) {
        const f = Math.min(1, (n - i) / (SR * 2));
        const l = Math.max(-1, Math.min(1, L[i] * f)), r = Math.max(-1, Math.min(1, R[i] * f));
        peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sum += L[i] * L[i];
        data.setInt16(44 + i * 4, l * 32767, true); data.setInt16(46 + i * 4, r * 32767, true);
      }
      let bin = ''; const bytes = new Uint8Array(data.buffer);
      for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
      return { b64: btoa(bin), peak, rms: Math.sqrt(sum / n) };
    }, [name, secs]);
    const wav = path.join(outDir, name + '.wav');
    fs.writeFileSync(wav, Buffer.from(res.b64, 'base64'));
    let mp3 = '';
    try { execSync(`ffmpeg -y -loglevel error -i "${wav}" -b:a 160k "${wav.replace(/\.wav$/, '.mp3')}"`); mp3 = ' + mp3'; } catch (e) {}
    console.log(`${name.padEnd(8)} peak ${res.peak.toFixed(2)}  rms ${res.rms.toFixed(3)}  -> ${wav}${mp3}`);
  }
  await browser.close();
})();
