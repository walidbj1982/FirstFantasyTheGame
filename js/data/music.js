// Original chiptune soundtrack. Notes: "c5:4" = C in octave 5 for 4 sixteenths, "r:4" = rest.
// Any track can be replaced by an audio file from the movie in CONFIG.music.
'use strict';

const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const midiName = n => NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);
function chordNotes(ch, oct) {
  const m = ch.match(/^([A-G])([#b]?)(m?)$/);
  let root = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  root = (root + 12) % 12;
  const base = 12 * (oct + 1) + root;
  return [base, base + (m[3] ? 3 : 4), base + 7];
}
function arp(chords, oct, pat = [0, 1, 2, 1], step = 2) {
  const out = [];
  for (const ch of chords.split(' ')) {
    const ns = chordNotes(ch, oct);
    for (let i = 0; i < 16 / step; i++) { const p = pat[i % pat.length]; out.push(midiName(ns[p % 3] + (p > 2 ? 12 : 0)) + ':' + step); }
  }
  return out.join(' ');
}
function bass(chords, oct, rhythm = [4, 4, 4, 4], octJump = false) {
  const out = [];
  for (const ch of chords.split(' ')) { const r = chordNotes(ch, oct)[0]; rhythm.forEach((l, i) => out.push(midiName(r + (octJump && i % 2 ? 12 : 0)) + ':' + l)); }
  return out.join(' ');
}
function drums(bars, pattern) { // pattern of 16: K kick, h hat, s snare, . rest
  const out = [];
  for (let b = 0; b < bars; b++) for (const c of pattern) out.push(c === 'K' ? 'c2:1' : c === 's' ? 'g3:1' : c === 'h' ? 'c7:1' : 'r:1');
  return out.join(' ');
}
const rep = (s, n) => Array(n).fill(s).join(' ');

const TRACKS = {};
{
  const ch = 'Am F C G Am F G E';
  TRACKS.title = { bpm: 84, ch: [
    { w: 'triangle', v: 0.16, n: 'e5:6 d5:2 c5:4 b4:4 c5:6 a4:2 a4:8 g4:4 c5:4 e5:4 g5:4 f5:6 e5:2 d5:8 e5:6 d5:2 c5:4 e5:4 a5:8 g5:4 f5:4 e5:4 d5:4 b4:4 g4:4 g#4:4 b4:4 e5:8' },
    { w: 'square', v: 0.03, n: arp(ch, 4, [0, 1, 2, 1], 2), gate: 0.6 },
    { w: 'triangle', v: 0.12, n: bass(ch, 2, [8, 8]) }
  ] };
  TRACKS.ending = { ...TRACKS.title, bpm: 72 };
}
{
  const ch = 'C G Am F C G F G';
  TRACKS.field = { bpm: 120, ch: [
    { w: 'square', v: 0.05, n: 'c5:4 e5:2 g5:2 g5:4 e5:4 d5:4 b4:2 d5:2 g5:8 a5:4 g5:2 e5:2 c5:4 e5:4 f5:6 e5:2 d5:4 c5:4 c5:4 e5:2 g5:2 c6:4 b5:4 a5:4 g5:2 f5:2 g5:8 a5:4 f5:4 c5:4 a5:4 g5:12 r:4', gate: 0.85 },
    { w: 'triangle', v: 0.05, n: arp(ch, 4, [0, 2, 1, 2], 2), gate: 0.5 },
    { w: 'triangle', v: 0.14, n: bass(ch, 2, [4, 4, 4, 4], true) },
    { w: 'noise', v: 0.04, n: drums(8, 'K.h.s.h.K.h.s.hh') }
  ] };
}
{
  const ch = 'F C Dm Bb F C Bb C';
  TRACKS.town = { bpm: 100, ch: [
    { w: 'triangle', v: 0.15, n: 'a4:4 c5:4 f5:4 e5:4 g5:6 e5:2 c5:8 d5:4 f5:4 a5:4 g5:4 f5:6 d5:2 a#4:8 a4:4 c5:4 f5:4 a5:4 g5:4 e5:4 c5:4 e5:4 d5:4 f5:4 a#5:4 a5:4 g5:8 e5:4 r:4' },
    { w: 'square', v: 0.025, n: arp(ch, 4, [0, 1, 2, 1], 4), gate: 0.4 },
    { w: 'triangle', v: 0.11, n: bass(ch, 2, [6, 2, 8]) }
  ] };
}
{
  const ch = 'Dm Dm Bb A Dm Gm A A';
  TRACKS.dungeon = { bpm: 88, ch: [
    { w: 'square', v: 0.035, n: 'd5:6 f5:2 e5:4 d5:4 a4:8 r:4 a4:4 a#4:6 d5:2 f5:4 e5:4 c#5:8 e5:8 d5:4 a5:4 g5:4 f5:4 g5:6 f5:2 d5:4 a#4:4 a4:4 c#5:4 e5:4 g5:4 a5:12 r:4', gate: 0.8 },
    { w: 'triangle', v: 0.06, n: arp(ch, 3, [0, 1, 2, 3], 2), gate: 0.5 },
    { w: 'triangle', v: 0.13, n: bass(ch, 2, [8, 8]) }
  ] };
  TRACKS.rift = { bpm: 80, ch: [{ ...TRACKS.dungeon.ch[0], w: 'sawtooth', v: 0.025 }, TRACKS.dungeon.ch[1], TRACKS.dungeon.ch[2]] };
}
{
  const ch = 'Em C D B Em C D B';
  TRACKS.battle = { bpm: 152, ch: [
    { w: 'square', v: 0.05, n: 'e5:2 e5:2 g5:2 e5:2 b5:4 a5:2 g5:2 e5:2 e5:2 g5:2 e5:2 c6:4 b5:2 a5:2 f#5:4 a5:4 d6:4 c6:2 a5:2 b5:8 d#5:4 f#5:4 g5:2 f#5:2 e5:2 f#5:2 g5:4 b5:4 a5:2 g5:2 e5:2 g5:2 c6:4 e6:4 d6:4 c6:2 b5:2 a5:4 f#5:4 b5:12 r:4', gate: 0.8 },
    { w: 'sawtooth', v: 0.025, n: arp(ch, 4, [0, 1, 2, 3], 1), gate: 0.5 },
    { w: 'triangle', v: 0.15, n: bass(ch, 2, [2, 2, 2, 2, 2, 2, 2, 2], true) },
    { w: 'noise', v: 0.05, n: drums(8, 'K.h.s.hKK.h.s.hh') }
  ] };
}
{
  const ch = 'Cm Ab Bb G Cm Ab Fm G';
  TRACKS.boss = { bpm: 140, ch: [
    { w: 'sawtooth', v: 0.04, n: 'c5:4 c5:2 d5:2 d#5:4 g5:4 g#5:6 g5:2 d#5:8 f5:4 d5:2 f5:2 a#5:4 g#5:4 g5:4 b4:4 d5:4 f5:4 c6:4 b5:2 c6:2 g5:8 g#5:4 g5:2 f5:2 d#5:4 c5:4 f5:4 g#5:4 c6:4 f5:4 g5:4 d5:4 b4:4 g4:4', gate: 0.85 },
    { w: 'square', v: 0.025, n: arp(ch, 4, [0, 2, 1, 2], 1), gate: 0.5 },
    { w: 'triangle', v: 0.16, n: bass(ch, 2, [2, 2, 2, 2, 2, 2, 2, 2], true) },
    { w: 'noise', v: 0.05, n: drums(8, 'K.hsK.hsK.hsKshs') }
  ] };
}
{
  const ch = 'Bbm Gb Ab F Bbm Gb Ab F';
  TRACKS.final = { bpm: 132, ch: [
    { w: 'sawtooth', v: 0.04, n: 'a#4:4 c#5:4 f5:4 a#5:4 g#5:4 f#5:4 c#5:8 c5:4 d#5:4 g#5:4 f#5:2 f5:2 f5:4 a4:4 c5:4 d#5:4 a#5:6 a5:2 a#5:4 f5:4 f#5:6 f5:2 c#5:4 a#4:4 d#5:4 g#5:4 c6:4 d#6:4 f6:8 e6:4 c6:4', gate: 0.85 },
    { w: 'square', v: 0.03, n: arp(ch, 4, [0, 1, 2, 3], 1), gate: 0.5 },
    { w: 'triangle', v: 0.16, n: bass(ch, 1, [2, 2, 2, 2, 2, 2, 2, 2], true) },
    { w: 'noise', v: 0.05, n: drums(8, 'KshsK.hsKshsKKss') }
  ] };
}
TRACKS.victory = { bpm: 140, ch: [
  { w: 'square', v: 0.06, n: 'g4:2 c5:2 e5:2 g5:6 e5:2 g5:8 r:2 a5:2 g5:2 f5:2 e5:2 d5:4 g5:4 c6:12 r:4 ' + rep('e5:4 g5:4 c6:4 g5:4 f5:4 a5:4 c6:4 a5:4', 1), gate: 0.85 },
  { w: 'triangle', v: 0.12, n: 'c3:8 e3:8 g3:4 f3:4 g3:8 c3:16 c3:16 f3:16' }
] };
TRACKS.sad = { bpm: 70, ch: [
  { w: 'triangle', v: 0.15, n: 'e5:8 d5:4 c5:4 f5:8 e5:4 d5:4 b4:8 g#4:4 b4:4 a4:16' },
  { w: 'square', v: 0.02, n: arp('Am Dm E Am', 4, [0, 1, 2, 1], 4), gate: 0.4 }
] };
