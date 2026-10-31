// =====================================================================
//  ORIGINAL SOUNDTRACK  —  "First Fantasy: The Pendant"
// =====================================================================
//  Composed for this game and played live by the synthesised orchestra in js/engine.js
//  (strings, harp, flute, oboe, horns, brass, choir, organ, piano, guitars, timpani, drums).
//
//  Notes:  "c5:4" = C in octave 5 lasting 4 sixteenths   "c4+e4+g4:8" = chord   "r:4" = rest
//          a trailing "!" accents a note ("c5:4!").
//  Drums:  one character per sixteenth: K kick, s/S snare, r roll, h/o hi-hat, R ride, C crash,
//          t/u toms, D taiko, T tambourine, m shaker, H heartbeat, . rest   ("|" is ignored)
//  Any track can be replaced by a recording (e.g. from the movie) in CONFIG.music.
// =====================================================================
'use strict';

// ---------------------------------------------------------------- notation
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const midiName = n => NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
function parseNote(n) {
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(n); if (!m) return null;
  return 12 * (+m[3] + 1) + { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function parseNotes(str) {
  const out = [];
  for (let tok of str.trim().split(/\s+/)) {
    if (!tok) continue;
    const acc = tok.endsWith('!'); if (acc) tok = tok.slice(0, -1);
    const [n, l] = tok.split(':'), len = +(l || 2);
    if (n === 'r') { out.push([null, len, false]); continue; }
    const notes = n.split('+').map(parseNote).filter(x => x != null);
    out.push([notes.length ? notes : null, len, acc]);
  }
  return out;
}
function parseKit(str) { return [...str.replace(/[|\s]/g, '')].map(ch => [ch === '.' ? null : [ch], 1, false]); }
const seqLength = seq => seq.reduce((s, e) => s + e[1], 0);
const rep = (s, n) => Array(n).fill(s).join(' ');
// slice a note string by bars: barSlice(str, 8, 16) = from bar 9 to the end
function barSlice(str, from, to = 1e9, barLen = 16) {
  let pos = 0; const out = [];
  for (const tok of str.trim().split(/\s+/)) { const len = +(tok.replace('!', '').split(':')[1] || 2), bar = Math.floor(pos / barLen); if (bar >= from && bar < to) out.push(tok); pos += len; }
  return out.join(' ');
}
const octave = (str, d) => str.replace(/([a-g][#b]?)(-?\d)(?=[:+])/g, (m, a, o) => a + (+o + d));

// chords: "Am", "F#m", "Bb", "Ebm", "G7", "Dmaj7", "Asus4", "Cdim" — one per bar, "Am_" = half a bar
function chordNotes(ch, oct) {
  const m = /^([A-G])([#b]?)(m(?!aj)|dim)?(maj7|7|sus4|add9)?/.exec(ch);
  const root = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const base = 12 * (oct + 1) + root, minor = m[3] === 'm', dim = m[3] === 'dim';
  const third = m[4] === 'sus4' ? 5 : minor || dim ? 3 : 4, fifth = dim ? 6 : 7;
  const ns = [base, base + third, base + fifth];
  if (m[4] === '7') ns.push(base + 10); else if (m[4] === 'maj7') ns.push(base + 11); else if (m[4] === 'add9') ns.push(base + 14);
  return ns;
}
const bars = (chords, barLen = 16) => chords.trim().split(/\s+/).map(c => [c.replace('_', ''), c.endsWith('_') ? barLen / 2 : barLen]);
// sustained chords (root position triad + octave of the root in the bass)
function pad(chords, oct, barLen = 16, withBass = false) {
  return bars(chords, barLen).map(([c, l]) => { const ns = chordNotes(c, oct); if (withBass) ns.unshift(ns[0] - 12); return ns.map(midiName).join('+') + ':' + l; }).join(' ');
}
// broken chords: pattern of chord-tone indices (0 root, 1 third, 2 fifth, 3 octave, 4 tenth, 5 twelfth, 6 two octaves, -1 low root)
function arp(chords, oct, pat, step = 2, barLen = 16) {
  const out = [];
  for (const [c, l] of bars(chords, barLen)) {
    const ns = chordNotes(c, oct), tone = i => i === -1 ? ns[0] - 12 : i < 3 ? ns[i] : i < 6 ? ns[i - 3] + 12 : ns[0] + 24;
    for (let k = 0; k < l / step; k++) out.push(midiName(tone(pat[k % pat.length])) + ':' + step);
  }
  return out.join(' ');
}
// bass line: rhythm (lengths summing to a bar) and which chord tone each hit plays
function bassline(chords, oct, rhythm, tones = [0], barLen = 16) {
  const out = [];
  for (const [c, l] of bars(chords, barLen)) {
    const ns = chordNotes(c, oct), r = l === barLen ? rhythm : halve(rhythm, l);
    r.forEach((len, k) => { const t = tones[k % tones.length]; out.push(midiName(t === 'o' ? ns[0] + 12 : ns[t]) + ':' + len); });
  }
  return out.join(' ');
}
function halve(rhythm, l) { const out = []; let s = 0; for (const x of rhythm) { if (s + x > l) break; out.push(x); s += x; } if (s < l) out.push(l - s); return out; }
// repeated chord stabs (brass/guitar): length per hit, rests between
function stabs(chords, oct, hits, barLen = 16) { // hits: [[len, rest], ...] per bar
  return bars(chords, barLen).map(([c]) => hits.map(([l, rr]) => chordNotes(c, oct).slice(0, 3).map(midiName).join('+') + ':' + l + (rr ? ' r:' + rr : '')).join(' ')).join(' ');
}
// power chords for the rock guitar: root + fifth, chugging eighths
function power(chords, oct, step = 2, barLen = 16) {
  return bars(chords, barLen).map(([c, l]) => { const n = chordNotes(c, oct); return rep(midiName(n[0]) + '+' + midiName(n[0] + 7) + ':' + step, l / step); }).join(' ');
}
// string tremolo (fast repeated chord tones)
const tremolo = (chords, oct, barLen = 16) => arp(chords, oct, [0, 2, 1, 2], 1, barLen);

const TRACKS = {};

// ---------------------------------------------------------------- 1. THE PENDANT (title)
// Harp broken chords under a flute theme, answered by the strings an octave up.
{
  const ch = 'D Bm G A F#m G Em A Bm G D A G A D D';
  const theme =
    'f#5:6 e5:2 d5:4 a4:4  b4:8 d5:4 f#5:4  g5:6 f#5:2 e5:4 d5:4  e5:12 r:4 ' +
    'f#5:6 a5:2 a5:4 f#5:4  g5:4 f#5:4 e5:4 d5:4  b4:4 d5:4 e5:4 g5:4  a5:12 r:4 ' +
    'b5:6 a5:2 f#5:4 d5:4  e5:6 f#5:2 g5:8  f#5:4 a5:4 d6:4 c#6:4  b5:8 a5:8 ' +
    'g5:6 b5:2 d6:4 b5:4  a5:6 g5:2 f#5:4 e5:4  d5:16  r:16';
  TRACKS.title = { bpm: 74, reverb: 0.45, parts: [
    { inst: 'harp', v: 0.12, n: arp(ch, 3, [0, 2, 3, 4, 5, 4, 3, 2], 2), pan: -0.25 },
    { inst: 'flute', v: 0.15, n: theme, pan: 0.15 },
    { inst: 'strings', v: 0.035, n: pad(ch, 3), pan: 0.1 },
    { inst: 'cello', v: 0.07, n: bassline(ch, 2, [8, 8], [0, 2]) },
    { inst: 'celesta', v: 0.05, n: rep('r:16', 8) + ' ' + octave(barSlice(theme, 8), 1), pan: 0.4 }
  ] };
  // the ending: the same theme for the full orchestra, a little slower and warmer
  TRACKS.ending = { bpm: 66, reverb: 0.5, parts: [
    { inst: 'harp', v: 0.1, n: arp(ch, 3, [0, 2, 3, 4, 5, 4, 3, 2], 2), pan: -0.3 },
    { inst: 'violin', v: 0.12, n: theme, pan: 0.15 },
    { inst: 'horn', v: 0.08, n: octave(theme, -1), pan: -0.1 },
    { inst: 'strings', v: 0.045, n: pad(ch, 3), pan: 0.2 },
    { inst: 'contrabass', v: 0.1, n: bassline(ch, 1, [16]) },
    { inst: 'timp', v: 0.12, n: bassline(ch, 2, [4, 12], [0]).split(' ').map((x, i) => i % 2 ? x.replace(/^[a-g]#?\d/, 'r') : x).join(' ') },
    { kit: rep('C' + '.'.repeat(63), 4), v: 0.12 }
  ] };
}

// ---------------------------------------------------------------- 2. WHITEWASHED STREETS (towns)
// A lilting 6/8 with mandolin, nylon guitar and accordion, flute on the tune, tambourine.
{
  const B = 12, ch = 'G C D G Em C Am_ D_ G G Bm C G Em Am D G';
  const tune =
    'd5:2 g5:2 a5:2 b5:4 a5:2  g5:2 e5:2 g5:2 c6:6  a5:2 f#5:2 a5:2 d6:4 c6:2  b5:6 g5:6 ' +
    'e5:2 g5:2 b5:2 e6:4 d6:2  c6:2 b5:2 a5:2 g5:6  a5:2 c6:2 b5:2 a5:2 g5:2 f#5:2  g5:12 ' +
    'b5:2 d6:2 b5:2 g5:4 a5:2  b5:2 a5:2 f#5:2 d5:6  e5:2 g5:2 c6:2 e6:4 d6:2  d6:6 b5:6 ' +
    'g5:2 b5:2 e6:2 d6:2 b5:2 g5:2  a5:2 c6:2 e6:2 c6:6  d6:2 c6:2 a5:2 f#5:2 e5:2 f#5:2  g5:12';
  const c16 = 'G C D G Em C Am G G Bm C G Em Am D G'; // one chord per bar for the comping parts
  TRACKS.town = { bpm: 104, reverb: 0.3, parts: [
    { inst: 'flute', v: 0.13, n: tune, pan: 0.2 },
    { inst: 'mandolin', v: 0.07, n: octave(tune, -1), pan: -0.35, gate: 0.6 },
    { inst: 'guitar', v: 0.1, n: arp(c16, 3, [0, 2, 3, 4, 3, 2], 2, B), pan: 0.35 },
    { inst: 'accordion', v: 0.035, n: bars(c16, B).map(([c]) => { const n = chordNotes(c, 4).map(midiName).join('+'); return `r:2 ${n}:2 ${n}:2 r:2 ${n}:2 ${n}:2`; }).join(' '), pan: -0.15 },
    { inst: 'bass', v: 0.14, n: bassline(c16, 2, [6, 6], [0, 2], B) },
    { kit: rep('T.m.m.T.m.m.', 16), v: 0.18, pan: 0.3 }
  ] };
}

// ---------------------------------------------------------------- 3. ACROSS THE COAST (world map)
// The adventure theme: horns on the melody, string ostinato, a marching snare and timpani.
{
  const ch = 'D A Bm G D A G A Bm G D A Bm G Em A';
  const tune =
    'd5:6 a4:2 d5:4 e5:4  f#5:6 e5:2 c#5:8  d5:4 b4:4 f#5:4 e5:4  d5:8 b4:4 g4:4 ' +
    'a4:6 d5:2 f#5:4 a5:4  g5:4 f#5:4 e5:4 c#5:4  d5:4 e5:4 g5:4 f#5:2 e5:2  e5:12 r:4 ' +
    'f#5:6 g5:2 a5:4 f#5:4  g5:6 a5:2 b5:8  a5:6 f#5:2 d5:4 f#5:4  e5:12 c#5:4 ' +
    'd5:4 f#5:4 b5:4 a5:4  g5:4 b5:4 d6:4 b5:4  a5:6 g5:2 f#5:4 e5:4  a5:8 c#5:4 e5:4';
  TRACKS.field = { bpm: 126, reverb: 0.3, parts: [
    { inst: 'horn', v: 0.13, n: octave(tune, -1), pan: -0.1 },
    { inst: 'violin', v: 0.07, n: tune, pan: 0.2 },
    { inst: 'strings', v: 0.035, n: arp(ch, 3, [0, 2, 3, 2], 2), pan: 0.3, gate: 0.7 },
    { inst: 'cello', v: 0.08, n: bassline(ch, 2, [4, 4, 4, 4], [0, 0, 2, 0]), pan: -0.2, gate: 0.6 },
    { inst: 'contrabass', v: 0.08, n: bassline(ch, 1, [16]) },
    { inst: 'timp', v: 0.14, n: bassline(ch, 2, [4, 4, 8], [0, 2, 0]).split(' ').map((x, i) => i % 3 === 2 ? x.replace(/^[a-g]#?\d/, 'r') : x).join(' ') },
    { kit: rep('S..r s.r. S..r rrrr', 15) + ' S.rr rrrr S.rr SSSS', v: 0.16, pan: 0.1 },
    { kit: 'C' + '.'.repeat(127) + 'C' + '.'.repeat(127), v: 0.1 }
  ] };
}

// ---------------------------------------------------------------- 4. INTO THE DEPTHS (dry hills, canyon, cliff hideout)
// Pizzicato ostinato, a lonely oboe, cello answering, distant toms.
{
  const ch = 'Dm Dm Bb A Dm Gm Bb A';
  const tune = 'd5:8 e5:4 f5:4  e5:6 d5:2 a4:8  d5:4 f5:4 a#5:6 a5:2  g5:4 f5:4 e5:8  f5:6 e5:2 d5:4 a5:4  g5:6 f5:2 d5:8  f5:4 g5:4 a#5:4 a5:4  c#5:12 r:4';
  TRACKS.dungeon = { bpm: 84, reverb: 0.45, parts: [
    { inst: 'pizz', v: 0.11, n: arp(ch + ' ' + ch, 3, [0, 2, 1, 2], 2), pan: -0.3 },
    { inst: 'oboe', v: 0.1, n: tune + ' ' + rep('r:16', 8), pan: 0.25 },
    { inst: 'cello', v: 0.09, n: rep('r:16', 8) + ' ' + octave(tune, -2), pan: -0.1 },
    { inst: 'strings', v: 0.025, n: pad(ch + ' ' + ch, 3) },
    { inst: 'contrabass', v: 0.09, n: bassline(ch + ' ' + ch, 1, [16]) },
    { inst: 'celesta', v: 0.04, n: rep('r:12 a6:4 r:16 r:8 d6:4 f6:4 r:16', 4), pan: 0.5 },
    { kit: rep('t.......u.......|................', 8), v: 0.12 }
  ] };
}

// ---------------------------------------------------------------- 5. SOMETHING IN THE DARK (the night forest, the flashback)
// No tune to hold on to: a tritone drone, a heartbeat, whispering choir and stray bells.
{
  TRACKS.forest = { bpm: 60, reverb: 0.6, parts: [
    { inst: 'cello', v: 0.08, n: 'd2+a2:32 d2+g#2:32 d2+a2:32 c#2+g2:32' },
    { inst: 'pad', v: 0.05, n: 'd4+f4:32 c#4+e4:32 d4+g4:32 c#4+f4:32', pan: 0.2 },
    { inst: 'choir', v: 0.035, n: 'r:16 a4:16 r:16 g#4:16 r:16 a4:8 a#4:8 r:16 g#4:16', pan: -0.3 },
    { inst: 'celesta', v: 0.05, n: 'r:8 a#5:4 r:20 e6:4 r:28 c#6:4 r:20 g5:4 r:24 d#6:4 r:8', pan: 0.45 },
    { inst: 'violin', v: 0.03, n: 'r:48 d#6:16 r:48 d6:16', pan: -0.5 },
    { kit: rep('H...........H...|................', 4), v: 0.22 }
  ] };
}

// ---------------------------------------------------------------- 6. THE OLD THEATER (Roman theater, forgotten shrine)
// Ancient and grand: harp, a distant horn call, choir pads, soft timpani.
{
  const ch = 'Em C Am B Em C D B';
  const call = 'e4:8 g4:4 b4:4  c5:12 b4:4  a4:6 b4:2 c5:4 e5:4  d#5:16  e5:6 d5:2 b4:4 g4:4  c5:6 b4:2 a4:8  d5:4 c5:4 b4:4 a4:4  b4:16';
  TRACKS.rift = { bpm: 72, reverb: 0.55, parts: [
    { inst: 'harp', v: 0.1, n: arp(ch, 3, [0, 2, 3, 4, 3, 2, 3, 5], 2), pan: -0.3 },
    { inst: 'horn', v: 0.11, n: call, pan: 0.15 },
    { inst: 'choir', v: 0.035, n: pad(ch, 3), pan: 0.1 },
    { inst: 'contrabass', v: 0.09, n: bassline(ch, 1, [16]) },
    { inst: 'timp', v: 0.1, n: bassline(ch, 2, [4, 12]).split(' ').map((x, i) => i % 2 ? x.replace(/^[a-g]#?\d/, 'r') : x).join(' ') },
    { inst: 'flute', v: 0.06, n: rep('r:16', 4) + ' e6:12 d6:2 b5:2 c6:16 d6:8 b5:8 b5:16', pan: 0.5 }
  ] };
}

// ---------------------------------------------------------------- 7. FISTS CLENCHED (battle)
// Rock and orchestra: driving bass and power chords, brass and violins on the tune, string runs.
{
  const ch = 'Am F G E Am F Dm E F G Am Am F G E E';
  const tune =
    'a5:2 r:2 a5:2 b5:2 c6:4 e6:4  d6:2 c6:2 a5:4 f5:4 a5:4  b5:2 r:2 b5:2 c6:2 d6:4 g6:4  e6:6 d6:2 b5:4 g#5:4 ' +
    'a5:2 r:2 a5:2 b5:2 c6:4 e6:4  f6:4 e6:4 d6:4 c6:4  d6:4 f6:4 e6:4 d6:2 c6:2  b5:12 r:4 ' +
    'c6:6 a5:2 f5:4 c6:4  d6:6 b5:2 g5:4 d6:4  e6:4 d6:2 c6:2 b5:4 c6:4  a5:12 r:4 ' +
    'f6:6 e6:2 d6:4 c6:4  d6:6 c6:2 b5:4 d6:4  e6:4 g#6:4 b6:4 g#6:4  e6:12 r:4';
  TRACKS.battle = { bpm: 156, reverb: 0.2, parts: [
    { inst: 'brass', v: 0.1, n: octave(tune, -1), pan: -0.15 },
    { inst: 'violin', v: 0.07, n: tune, pan: 0.2 },
    { inst: 'chug', v: 0.06, n: power(ch, 2), pan: -0.4, gate: 0.6 },
    { inst: 'bass', v: 0.15, n: bassline(ch, 1, [2, 2, 2, 2, 2, 2, 2, 2], [0, 0, 'o', 0, 0, 'o', 0, 2]) },
    { inst: 'strings', v: 0.03, n: arp(ch, 4, [0, 1, 2, 3, 2, 1], 1), pan: 0.4, gate: 0.6 },
    { kit: 'C' + '.'.repeat(127) + 'C' + '.'.repeat(127), v: 0.12 },
    { kit: rep('K.h.S.h.K.K.S.h.', 15) + ' K.h.S.h.S.SrSSSS', v: 0.2 }
  ] };
}

// ---------------------------------------------------------------- 8. RIVAL'S CHALLENGE (bosses)
// Heavier: organ and distorted guitar, choir on the big chords, toms and crashes.
{
  const ch = 'Cm Cm Ab Bb Cm Cm Fm G Ab Bb Gm Cm Ab Bb G G';
  const tune =
    'c5:4 g5:4 f5:2 g5:2 g#5:4  g5:6 d#5:2 c5:8  c6:4 a#5:4 g#5:4 g5:4  f5:6 g5:2 a#5:8 ' +
    'c5:4 g5:4 f5:2 g5:2 c6:4  d6:4 d#6:4 d6:4 c6:4  g#5:4 c6:4 f6:4 d#6:2 d6:2  b5:12 r:4 ' +
    'd#6:6 c6:2 g#5:8  f6:6 d6:2 a#5:8  g6:4 f6:4 d#6:4 d6:4  c6:12 r:4 ' +
    'g#5:4 c6:4 d#6:4 g#6:4  g6:4 f6:4 d6:4 a#5:4  b5:4 d6:4 f6:4 g6:4  g6:8 f6:4 d6:4';
  TRACKS.boss = { bpm: 146, reverb: 0.25, parts: [
    { inst: 'lead', v: 0.06, n: tune, pan: 0.2 },
    { inst: 'violin', v: 0.06, n: octave(tune, -1), pan: -0.2 },
    { inst: 'organ', v: 0.035, n: pad(ch, 3), pan: -0.3 },
    { inst: 'chug', v: 0.06, n: power(ch, 2), pan: 0.4, gate: 0.6 },
    { inst: 'choir', v: 0.04, n: stabs(ch, 4, [[8, 0], [8, 0]]), pan: 0 },
    { inst: 'bass', v: 0.15, n: bassline(ch, 1, [2, 2, 2, 2, 2, 2, 2, 2], [0, 0, 'o', 0, 0, 0, 'o', 2]) },
    { kit: rep('K.hSK.hSK.hSKShS', 7) + ' K.hSK.hSttuuDDDD|' + rep('K.hSK.hSK.hSKShS', 7) + ' ttuuttuuDDDDSSSS', v: 0.19 },
    { kit: rep('C' + '.'.repeat(63), 4), v: 0.11 }
  ] };
}

// ---------------------------------------------------------------- 9. WINGS OF RUIN (Sephiroth)
// The villain's theme: choir chanting in a 3+3+2 pulse, organ, string tremolo, timpani and taiko.
{
  const ch = 'Bbm Gb Ebm F Bbm Gb C F Gb Ab F Bbm Gb Ab Bbm F';
  const chant =
    'a#4:6 a#4:6 c#5:4  c5:6 a#4:6 f#4:4  d#5:6 f5:6 f#5:4  f5:12 e5:4 ' +
    'a#5:6 g#5:6 f5:4  f#5:6 f5:6 c#5:4  e5:6 g5:6 a#5:4  a5:16 ' +
    'c#6:6 a#5:6 f#5:4  c6:6 g#5:6 d#5:4  c6:6 a5:6 f5:4  a#5:12 c#6:4 ' +
    'a#5:6 c#6:6 f#6:4  f6:6 d#6:6 c6:4  c#6:6 c6:6 a#5:4  a5:12 c6:4';
  TRACKS.final = { bpm: 138, reverb: 0.4, parts: [
    { inst: 'choir', v: 0.11, n: octave(chant, -1), pan: -0.1 },
    { inst: 'brass', v: 0.07, n: chant, pan: 0.2 },
    { inst: 'organ', v: 0.04, n: pad(ch, 3, 16, true), pan: -0.3 },
    { inst: 'strings', v: 0.03, n: tremolo(ch, 4), pan: 0.35, gate: 0.7 },
    { inst: 'contrabass', v: 0.1, n: bassline(ch, 1, [6, 6, 4]) },
    { inst: 'timp', v: 0.15, n: bassline(ch, 2, [6, 6, 4], [0, 0, 2]) },
    { kit: rep('D.....D...S.....', 7) + ' D.....D...SSSSrr|' + rep('D.....D...S.....', 7) + ' DDDDDDDDSSSSSSSS', v: 0.18 },
    { kit: rep('C' + '.'.repeat(63), 4), v: 0.12 }
  ] };
}

// ---------------------------------------------------------------- 10. TRIUMPH (victory)
// A brass fanfare (played once), then a bright march while the spoils are counted.
{
  const ch = 'C Am F G C Am Dm_ G_ C';
  TRACKS.victory = { bpm: 124, reverb: 0.35,
    intro: [
      { inst: 'brass', v: 0.12, n: 'g4:3 g4:1 c5:4! e5:4 g5:4  a5:4 g5:2 e5:2 c6:8!' },
      { inst: 'horn', v: 0.1, n: 'e4:3 e4:1 g4:4 c5:4 e5:4  f5:4 e5:2 c5:2 e5:8' },
      { inst: 'timp', v: 0.16, n: 'c3:4 g2:4 c3:4 g2:4 f2:8 c3:8' },
      { kit: 'C...........r.rr|rrrrrrrrC.......', v: 0.14 }
    ],
    parts: [
      { inst: 'brass', v: 0.12, n: 'e5:4 g5:4 c6:6 b5:2  a5:4 e5:4 a5:8  f5:4 a5:4 c6:4 a5:4  g5:12 r:4  e5:4 g5:4 c6:4 e6:4  d6:4 c6:4 a5:8  f5:4 a5:4 d6:2 c6:2 b5:4  c6:12 r:4', pan: 0.15 },
      { inst: 'flute', v: 0.07, n: 'e6:4 g6:4 c7:6 b6:2  a6:4 e6:4 a6:8  f6:4 a6:4 c7:4 a6:4  g6:12 r:4  e6:4 g6:4 c7:4 e7:4  d7:4 c7:4 a6:8  f6:4 a6:4 d7:2 c7:2 b6:4  c7:12 r:4', pan: 0.4 },
      { inst: 'strings', v: 0.03, n: arp(ch, 4, [0, 1, 2, 1], 2), pan: -0.3, gate: 0.7 },
      { inst: 'contrabass', v: 0.09, n: bassline(ch, 2, [4, 4, 4, 4], [0, 2, 0, 2]), gate: 0.6 },
      { kit: rep('K.h.s.h.K.h.s.hh', 8), v: 0.13 }
    ] };
}

// ---------------------------------------------------------------- 11. AERIS (sorrow, memories, game over)
// Piano alone at first, then strings and a violin carry the melody.
{
  const ch = 'F C Dm Bb F Am Bb C Dm Am Bb F Gm C F F';
  const tune =
    'a5:6 g5:2 f5:8  e5:6 f5:2 g5:8  f5:4 e5:4 d5:4 a4:4  a#4:12 r:4 ' +
    'c5:6 f5:2 a5:8  g5:6 a5:2 e5:8  f5:4 g5:4 a5:4 a#5:4  g5:12 r:4 ' +
    'a5:6 a#5:2 a5:4 f5:4  e5:6 f5:2 e5:4 c5:4  d5:4 f5:4 a#5:4 a5:4  a5:8 c5:8 ' +
    'a#4:6 d5:2 g5:4 f5:4  e5:6 g5:2 c6:8  a5:8 g5:4 f5:4  f5:16';
  TRACKS.sad = { bpm: 64, reverb: 0.5, parts: [
    { inst: 'piano', v: 0.22, n: tune, pan: 0.1 },
    { inst: 'piano', v: 0.11, n: arp(ch, 3, [-1, 2, 3, 4, 3, 2, 3, 2], 2), pan: -0.2 },
    { inst: 'violin', v: 0.08, n: rep('r:16', 8) + ' ' + octave(barSlice(tune, 8), 0), pan: 0.3 },
    { inst: 'strings', v: 0.025, n: rep('r:16', 4) + ' ' + pad(ch.split(' ').slice(4).join(' '), 3), pan: -0.1 },
    { inst: 'cello', v: 0.06, n: rep('r:16', 8) + ' ' + bassline(ch.split(' ').slice(8).join(' '), 2, [16]) }
  ] };
}

// ---------------------------------------------------------------- 12. TWO KILOMETRES (the boat to the island)
// A sea waltz in 3/4: accordion and flute over a rocking guitar and soft shaker.
{
  const B = 12, ch = 'D G A D Bm Em A D';
  const tune = 'a5:4 f#5:4 d5:4  b5:8 g5:4  c#6:4 e6:4 c#6:4  d6:12  f#6:4 d6:4 b5:4  g5:4 b5:4 e6:4  e6:4 c#6:4 a5:4  d6:12';
  TRACKS.sea = { bpm: 132, reverb: 0.35, parts: [
    { inst: 'flute', v: 0.12, n: tune + ' ' + octave(tune, -1), pan: 0.25 },
    { inst: 'accordion', v: 0.04, n: rep(bars(ch, B).map(([c]) => { const n = chordNotes(c, 4).map(midiName).join('+'); return `r:4 ${n}:4 ${n}:4`; }).join(' '), 2), pan: -0.2 },
    { inst: 'guitar', v: 0.09, n: rep(arp(ch, 3, [0, 2, 3, 4, 3, 2], 2, B), 2), pan: 0.4 },
    { inst: 'bass', v: 0.12, n: rep(bassline(ch, 2, [4, 8], [0, 2], B), 2) },
    { kit: rep('m.m.m.m.m.m.', 16), v: 0.12, pan: -0.3 }
  ] };
}
