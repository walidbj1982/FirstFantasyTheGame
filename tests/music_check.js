// Checks the soundtrack: every note parses, and every part of a track has the same length,
// so the instruments stay in sync when the track loops.  Usage: node tests/music_check.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/data/music.js'), 'utf8') + '\nthis.TRACKS = TRACKS; this.parseNotes = parseNotes; this.parseKit = parseKit; this.seqLength = seqLength;', ctx);
let bad = 0;
const ORCH = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
for (const [name, tr] of Object.entries(ctx.TRACKS)) {
  const lens = [];
  for (const [grp, parts] of [['intro', tr.intro || []], ['main', tr.parts]]) {
    const L = parts.map(p => {
      if (!p.kit && !new RegExp('\\b' + p.inst + ': \\{').test(ORCH)) { console.log(`  ${name}: unknown instrument ${p.inst}`); bad++; }
      const toks = p.kit ? [] : p.n.trim().split(/\s+/);
      for (const t of toks) { const n = t.replace('!', '').split(':')[0]; if (n !== 'r' && n.split('+').some(x => !/^[a-g][#b]?-?\d$/.test(x))) { console.log(`  ${name}: bad note "${t}"`); bad++; } }
      return ctx.seqLength(p.kit ? ctx.parseKit(p.kit) : ctx.parseNotes(p.n));
    });
    if (new Set(L).size > 1) { console.log(`  ${name} (${grp}): parts differ in length ${L.join(', ')}`); bad++; }
    if (grp === 'main') lens.push(L[0]);
  }
  const secs = lens[0] / 4 * 60 / tr.bpm;
  console.log(`${name.padEnd(8)} ${tr.bpm} bpm  ${tr.parts.length} parts  ${(lens[0] / 16).toFixed(1)} bars  ${secs.toFixed(0)} s loop`);
}
console.log(bad ? `${bad} PROBLEM(S)` : 'ALL TRACKS OK');
process.exit(bad ? 1 : 0);
