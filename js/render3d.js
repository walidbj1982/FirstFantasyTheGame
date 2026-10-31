// PS1-style 3D layer: low-poly characters and monsters, battle/cutscene stages, 3D maps.
// Renders at low resolution with vertex snapping (the PlayStation "wobble") under the 2D UI canvas.
'use strict';

const R3 = {
  W: 640, H: 480, used: false, ok: false,
  init() {
    this.canvas = document.getElementById('gl');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(1); this.renderer.setSize(this.W, this.H, false);
      this.ok = true;
    } catch (e) { console.warn('WebGL unavailable', e); }
  },
  beginFrame() { this.used = false; },
  endFrame() { if (this.canvas) this.canvas.style.visibility = this.used ? 'visible' : 'hidden'; },
  render(scene, camera) {
    if (!this.ok) return;
    if (G.shake > 0) { camera.position.x += rand(-0.08, 0.08); camera.position.y += rand(-0.05, 0.05); }
    this.renderer.render(scene, camera); this.used = true;
  },
  // world position -> 320x240 screen coordinates of the 2D layer
  project(v, camera) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * SW, (1 - p.y) / 2 * SH, p.z]; }
};

// ------------------------------------------------------------------ materials
const SNAP = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include project_vertex', `#include project_vertex
    vec4 ps1 = gl_Position; ps1.xyz /= ps1.w;
    ps1.xy = floor(ps1.xy * vec2(160.0, 120.0) + 0.5) / vec2(160.0, 120.0);
    ps1.xyz *= gl_Position.w; gl_Position = ps1;`);
};
const MatCache = {};
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (MatCache[key]) return MatCache[key];
  const m = new THREE.MeshLambertMaterial({ color, emissive: o.emissive || 0x000000, transparent: !!o.opacity, opacity: o.opacity || 1, side: o.side || THREE.FrontSide });
  m.onBeforeCompile = SNAP;
  return (MatCache[key] = m);
}
let VMAT = null;
function vmat() {
  if (!VMAT) { VMAT = new THREE.MeshLambertMaterial({ vertexColors: true }); VMAT.onBeforeCompile = SNAP; }
  return VMAT;
}
function flat(geo) { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; }
const GEO = {};
const box = (w, h, d) => GEO['b' + w + h + d] || (GEO['b' + w + h + d] = new THREE.BoxGeometry(w, h, d));
const ico = (r, det = 1) => GEO['i' + r + det] || (GEO['i' + r + det] = flat(new THREE.IcosahedronGeometry(r, det)));
const cone = (r, h, n = 6) => GEO['c' + r + h + n] || (GEO['c' + r + h + n] = flat(new THREE.ConeGeometry(r, h, n)));
const cyl = (r1, r2, h, n = 6) => GEO['y' + r1 + r2 + h + n] || (GEO['y' + r1 + r2 + h + n] = flat(new THREE.CylinderGeometry(r1, r2, h, n)));
function add(parent, geo, color, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' || typeof color === 'number' ? mat(color, o) : color);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  if (o.s) m.scale.set(...(Array.isArray(o.s) ? o.s : [o.s, o.s, o.s]));
  parent.add(m); return m;
}
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// ------------------------------------------------------------------ faces
function faceTexture(look, castId) {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  const photo = castId && CAST[castId] && Img.get(CAST[castId].portrait);
  if (photo) {
    const s = Math.min(photo.naturalWidth, photo.naturalHeight);
    g.drawImage(photo, (photo.naturalWidth - s) / 2, (photo.naturalHeight - s) / 2, s, s, 0, 0, 64, 64);
  } else {
    g.fillStyle = look.skin; g.fillRect(0, 0, 64, 64);
    g.fillStyle = shade(look.skin, -0.1); g.fillRect(0, 54, 64, 10);
    for (const x of [19, 45]) {
      g.fillStyle = '#141420'; g.beginPath(); g.ellipse(x, 31, 4.5, 6.5, 0, 0, 7); g.fill();
      g.fillStyle = look.eyes && look.eyes !== '#000000' ? look.eyes : '#3a2a20'; g.beginPath(); g.ellipse(x, 33, 3, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(x - 2, 27, 2, 3);
      g.fillStyle = shade(look.hair, -0.25); g.fillRect(x - 6, 20, 12, 2);
    }
    g.fillStyle = shade(look.skin, -0.18); g.fillRect(31, 40, 2, 4);
    g.fillStyle = '#7a3030'; g.fillRect(28, 48, 8, 2);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

// ------------------------------------------------------------------ characters
// Chibi "field model" proportions: big head, blocky torso, chunky forearms. Faces +z, feet at y=0.
function buildCharacter(look, castId, job) {
  const root = new THREE.Group(), P = {};
  const hood = look.hairStyle === 'hood';
  const hair = hood ? look.outfit2 : look.hair, out = look.outfit, out2 = look.outfit2 || shade(look.outfit, -0.3);
  const acc = look.accent || '#e0c050', skin = look.skin;
  const dress = look.dress, pants = dress ? skin : (look.pants || '#333344'), boots = look.boots || out2;
  const upper = look.sleeveless ? skin : (look.sleeve || out), lower = (look.sleeveless || look.sleeve) ? skin : out2;
  const shirt = look.shirt || (look.sleeve && look.sleeve !== out ? look.sleeve : null);
  P.hips = pivot(root, 0, 0.8, 0);
  P.torso = pivot(P.hips, 0, 0, 0);
  add(P.torso, box(0.62, 0.62, 0.4), out, 0, 0.36, 0);
  if (shirt) add(P.torso, box(0.22, 0.56, 0.05), shirt, 0, 0.38, 0.19);
  add(P.torso, box(0.66, 0.1, 0.44), acc, 0, 0.06, 0);
  if (!look.sleeveless) for (const s of [-1, 1]) add(P.torso, box(0.26, 0.16, 0.34), look.sleeve && !shirt ? upper : out2, s * 0.38, 0.64, 0);
  if (dress) add(P.hips, cyl(0.3, 0.5, 0.78, 8), dress, 0, -0.32, 0);
  P.head = pivot(P.torso, 0, 0.74, 0);
  add(P.head, ico(0.36), skin, 0, 0.32, 0, { s: [1, 1.05, 0.84] });
  const fm = new THREE.MeshLambertMaterial({ map: faceTexture(look, castId), transparent: false }); fm.onBeforeCompile = SNAP;
  add(P.head, GEO.face || (GEO.face = new THREE.PlaneGeometry(0.42, 0.42)), fm, 0, 0.28, 0.305);
  const style = look.hairStyle || 'short';
  if (style === 'buzz') add(P.head, ico(0.37), hair, 0, 0.4, -0.04, { s: [1.0, 0.78, 0.86] });
  else { add(P.head, ico(0.39), hair, 0, 0.44, -0.07, { s: [1.02, 0.78, 0.86] }); add(P.head, box(0.6, 0.12, 0.12), hair, 0, 0.55, 0.22, { rx: 0.35 }); }
  if (style === 'spiky') {
    [[0, 0.75, -0.1, -0.5, 0], [0.22, 0.68, -0.15, -0.7, -0.6], [-0.22, 0.68, -0.15, -0.7, 0.6], [0.3, 0.5, -0.2, -1.2, -1.1],
      [-0.3, 0.5, -0.2, -1.2, 1.1], [0, 0.55, -0.35, -1.6, 0], [0.16, 0.72, 0.1, 0.3, -0.4], [-0.16, 0.72, 0.1, 0.35, 0.45]]
      .forEach(([x, y, z, rx, rz]) => add(P.head, cone(0.12, 0.42, 4), hair, x, y, z, { rx, rz }));
  } else if (style === 'long') {
    add(P.head, box(0.66, dress ? 0.9 : 0.82, 0.16), hair, 0, dress ? 0.05 : 0.08, -0.27);
    add(P.head, box(0.14, 0.55, 0.3), hair, 0.33, 0.16, -0.05); add(P.head, box(0.14, 0.55, 0.3), hair, -0.33, 0.16, -0.05);
  } else if (style === 'hood') {
    add(P.head, ico(0.43), hair, 0, 0.36, -0.08, { s: [1.05, 0.95, 1] });
    add(P.head, cone(0.16, 0.4, 5), hair, 0, 0.45, -0.42, { rx: -2.2 });
  }
  if (look.cap) {
    add(P.head, ico(0.4, 1), look.cap, 0, 0.52, -0.03, { s: [1.04, 0.62, 1.06] });
    add(P.head, box(0.44, 0.04, 0.32), look.cap, 0, 0.5, 0.36, { rx: -0.12 });
  }
  if (look.headband) {
    add(P.head, cyl(0.385, 0.385, 0.09, 10), look.headband, 0, 0.5, -0.02, { s: [1, 1, 0.88] });
    for (const s of [-1, 1]) add(P.head, box(0.07, 0.32, 0.03), look.headband, s * 0.06, 0.38, -0.36, { rz: s * 0.25, rx: 0.3 });
  }
  if (look.glasses) { for (const s of [-1, 1]) add(P.head, box(0.15, 0.09, 0.03), '#0a0a0a', s * 0.1, 0.33, 0.33); add(P.head, box(0.36, 0.025, 0.03), '#0a0a0a', 0, 0.35, 0.33); }
  if (look.beard) add(P.head, box(0.42, 0.16, 0.1), look.beard, 0, 0.1, 0.24);
  P.arms = [];
  [-1, 1].forEach((s, i) => {
    const sh = pivot(P.torso, s * 0.42, 0.56, 0);
    add(sh, box(0.17, 0.34, 0.18), upper, 0, -0.17, 0);
    const el = pivot(sh, 0, -0.34, 0);
    const hand = pivot(el, 0, -0.32, 0);
    if (i === 0 && look.gunArm) {
      add(el, box(0.26, 0.34, 0.26), '#9a9ea8', 0, -0.15, 0);
      for (const [x, z] of [[-0.05, 0.05], [0.05, 0.05], [0, -0.05]]) add(el, cyl(0.04, 0.04, 0.32, 6), '#4a4c52', x, -0.44, z);
      add(el, cyl(0.15, 0.15, 0.06, 8), '#6a6e78', 0, -0.32, 0);
    } else {
      add(el, box(0.21, 0.28, 0.22), lower, 0, -0.13, 0);
      add(hand, ico(0.11, 0), skin, 0, 0, 0);
    }
    if (job === 'brawler') add(hand, box(0.2, 0.17, 0.21), '#7a2a1a', 0, -0.02, 0);
    if (job === 'monk') add(el, box(0.23, 0.08, 0.24), '#c4201c', 0, -0.25, 0);
    P.arms.push({ sh, el, hand });
  });
  P.legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(P.hips, s * 0.17, 0, 0);
    add(hip, box(0.23, 0.38, 0.25), pants, 0, -0.19, 0);
    const kn = pivot(hip, 0, -0.38, 0);
    add(kn, box(0.21, 0.28, 0.23), pants, 0, -0.14, 0);
    add(kn, box(0.25, 0.14, 0.36), boots, 0, -0.34, 0.05);
    P.legs.push({ hip, kn });
  }
  if (look.weapon) addWeapon(P.arms[0].hand, look.weapon);
  root.userData = { P, kind: 'human', h: 2.2 };
  return root;
}
function addWeapon(hand, kind) {
  const w = pivot(hand, 0, 0, 0); w.rotation.x = Math.PI / 2;
  if (kind === 'katana') { add(w, box(0.05, 2.0, 0.1), '#e0e4ec', 0, 1.1, 0); add(w, box(0.16, 0.05, 0.16), '#c0a040', 0, 0.1, 0); add(w, box(0.06, 0.3, 0.06), '#202020', 0, -0.06, 0); }
  else if (kind === 'sword') { add(w, box(0.07, 1.25, 0.14), '#d8dce8', 0, 0.75, 0); add(w, box(0.36, 0.07, 0.1), '#c0a040', 0, 0.12, 0); }
}
// state: idle | walk | attack | cast | hurt | kneel | ko | victory
function poseCharacter(m, state, t) {
  const P = m.userData.P; if (!P) return;
  P.hips.position.y = 0.8; P.hips.rotation.set(0, 0, 0); P.torso.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);
  for (const a of P.arms) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
  for (const l of P.legs) { l.hip.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); }
  m.rotation.x = 0; m.rotation.z = 0;
  const [R, L] = P.arms, [LR, LL] = P.legs;
  switch (state) {
    case 'walk': {
      const s = Math.sin(t * 0.32);
      LR.hip.rotation.x = s * 0.7; LL.hip.rotation.x = -s * 0.7;
      LR.kn.rotation.x = Math.max(0, -s) * 0.9; LL.kn.rotation.x = Math.max(0, s) * 0.9;
      R.sh.rotation.x = -s * 0.6; L.sh.rotation.x = s * 0.6; R.el.rotation.x = -0.4; L.el.rotation.x = -0.4;
      P.hips.position.y = 0.8 + Math.abs(Math.cos(t * 0.32)) * 0.05; P.torso.rotation.x = 0.08;
      break;
    }
    case 'attack': R.sh.rotation.x = -2.6 + Math.min(1, (t % 30) / 10) * 2.2; R.el.rotation.x = -0.2; P.torso.rotation.y = -0.3; LR.hip.rotation.x = -0.5; LL.hip.rotation.x = 0.4; break;
    case 'cast': R.sh.rotation.x = -2.7; L.sh.rotation.x = -2.7; R.sh.rotation.z = 0.3; L.sh.rotation.z = -0.3; P.head.rotation.x = -0.3; break;
    case 'hurt': P.torso.rotation.x = -0.4; P.head.rotation.x = -0.3; R.sh.rotation.x = 0.4; L.sh.rotation.x = 0.4; break;
    case 'kneel': P.hips.position.y = 0.5; LR.hip.rotation.x = -1.4; LR.kn.rotation.x = 1.4; LL.hip.rotation.x = 0.3; LL.kn.rotation.x = 1.2; P.torso.rotation.x = 0.45; R.sh.rotation.x = 0.3; break;
    case 'ko': m.rotation.x = -Math.PI / 2; P.hips.position.y = 0.8; break;
    case 'victory': R.sh.rotation.x = -2.9; R.sh.rotation.z = 0.2; P.hips.position.y = 0.8 + Math.abs(Math.sin(t * 0.12)) * 0.1; break;
    case 'talk': P.head.rotation.x = Math.sin(t * 0.25) * 0.08; R.sh.rotation.x = -0.6 + Math.sin(t * 0.15) * 0.2; R.el.rotation.x = -0.8; P.hips.position.y = 0.8 + Math.sin(t * 0.08) * 0.015; break;
    default: { // idle: battle-ready breathing
      const b = Math.sin(t * 0.07);
      P.hips.position.y = 0.8 + b * 0.015; P.torso.rotation.x = 0.05 + b * 0.02;
      R.sh.rotation.x = -0.25; R.el.rotation.x = -0.5; L.sh.rotation.x = 0.1; L.sh.rotation.z = 0.1; R.sh.rotation.z = -0.1;
    }
  }
}

// ------------------------------------------------------------------ monsters
function buildMonster(kind, pal) {
  const root = new THREE.Group(), c1 = pal[0], c2 = pal[1] || shade(pal[0], -0.35), c3 = pal[2] || shade(pal[0], 0.35), A = pal[3] || '#e0c040', E = pal[4] || '#ff3030';
  const eyeOpt = { emissive: new THREE.Color(E).multiplyScalar(0.6).getHex() };
  const eyes = (p, y, z, sp = 0.14, r = 0.07) => { for (const s of [-1, 1]) add(p, ico(r, 0), E, s * sp, y, z, eyeOpt); };
  const parts = {}; let h = 1.4;
  switch (kind) {
    case 'slime': {
      parts.body = add(root, ico(0.65, 1), c1, 0, 0.5, 0, { s: [1, 0.75, 1] });
      add(root, ico(0.2, 0), c3, -0.2, 0.85, 0.3);
      for (const s of [-1, 1]) { add(root, ico(0.12, 0), '#ffffff', s * 0.2, 0.62, 0.52); add(root, ico(0.06, 0), '#101010', s * 0.2, 0.62, 0.62); }
      h = 1.0; break;
    }
    case 'bat': {
      parts.body = pivot(root, 0, 1.1, 0);
      add(parts.body, ico(0.3, 0), c1); eyes(parts.body, 0.05, 0.25, 0.1, 0.05);
      for (const s of [-1, 1]) add(parts.body, cone(0.08, 0.25, 4), c2, s * 0.15, 0.3, 0);
      parts.wings = [];
      for (const s of [-1, 1]) { const w = pivot(parts.body, s * 0.2, 0, 0); add(w, box(0.8, 0.04, 0.45), c2, s * 0.45, 0, 0); add(w, cone(0.12, 0.3, 3), c1, s * 0.85, -0.05, 0, { rz: s * 1.5 }); parts.wings.push([w, s]); }
      h = 1.5; break;
    }
    case 'wolf': {
      parts.body = pivot(root, 0, 0, 0);
      add(parts.body, box(0.5, 0.45, 1.0), c1, 0, 0.75, 0);
      const hd = pivot(parts.body, 0, 0.95, 0.55); parts.head = hd;
      add(hd, box(0.42, 0.38, 0.4), c1); add(hd, box(0.24, 0.2, 0.3), c2, 0, -0.07, 0.3); eyes(hd, 0.07, 0.21, 0.12, 0.05);
      for (const s of [-1, 1]) add(hd, cone(0.08, 0.22, 4), c2, s * 0.13, 0.27, -0.05);
      parts.legs = [];
      for (const [x, z] of [[-0.18, 0.35], [0.18, 0.35], [-0.18, -0.35], [0.18, -0.35]]) { const l = pivot(parts.body, x, 0.6, z); add(l, box(0.14, 0.55, 0.14), c2, 0, -0.28, 0); parts.legs.push(l); }
      add(parts.body, cone(0.09, 0.5, 4), c1, 0, 0.9, -0.65, { rx: -2.2 });
      h = 1.3; break;
    }
    case 'imp': {
      parts.body = pivot(root, 0, 0, 0);
      add(parts.body, box(0.5, 0.55, 0.36), c1, 0, 0.85, 0); add(parts.body, box(0.52, 0.1, 0.38), A, 0, 0.62, 0);
      add(parts.body, ico(0.32, 1), c1, 0, 1.38, 0); eyes(parts.body, 1.42, 0.27, 0.12, 0.06);
      for (const s of [-1, 1]) {
        add(parts.body, cone(0.07, 0.3, 4), c2, s * 0.2, 1.7, 0, { rz: -s * 0.4 });
        add(parts.body, box(0.14, 0.5, 0.14), c2, s * 0.36, 0.85, 0.05, { rz: s * 0.2 });
        add(parts.body, box(0.16, 0.5, 0.16), c2, s * 0.14, 0.33, 0);
      }
      h = 1.8; break;
    }
    case 'plant': {
      add(root, cyl(0.08, 0.12, 0.9), '#2a7a2a', 0, 0.45, 0);
      for (const s of [-1, 1]) add(root, box(0.5, 0.05, 0.22), c2, s * 0.25, 0.3, 0, { rz: s * 0.4 });
      parts.body = pivot(root, 0, 1.05, 0);
      add(parts.body, ico(0.3, 1), c1); eyes(parts.body, 0.05, 0.26, 0.11, 0.05);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(parts.body, cone(0.13, 0.35, 4), c3, Math.cos(a) * 0.38, Math.sin(a) * 0.38, -0.05, { rz: a - Math.PI / 2 }); }
      h = 1.5; break;
    }
    case 'golem': {
      parts.body = pivot(root, 0, 0, 0);
      add(parts.body, box(0.9, 0.8, 0.6), c1, 0, 1.15, 0); add(parts.body, box(0.5, 0.4, 0.45), c3, 0, 1.75, 0.05);
      eyes(parts.body, 1.78, 0.29, 0.12, 0.06); add(parts.body, box(0.92, 0.12, 0.62), A, 0, 0.8, 0);
      parts.arms = [];
      for (const s of [-1, 1]) {
        const a = pivot(parts.body, s * 0.6, 1.45, 0); add(a, box(0.36, 0.95, 0.4), c2, 0, -0.42, 0); add(a, box(0.42, 0.3, 0.46), c1, 0, -0.95, 0); parts.arms.push(a);
        add(parts.body, box(0.3, 0.7, 0.36), c2, s * 0.24, 0.35, 0);
      }
      h = 2.0; break;
    }
    case 'skeleton': {
      const bone = '#e8e4d0';
      parts.body = pivot(root, 0, 0, 0);
      add(parts.body, ico(0.28, 1), bone, 0, 1.6, 0); for (const s of [-1, 1]) add(parts.body, box(0.09, 0.09, 0.05), '#101010', s * 0.1, 1.62, 0.24);
      add(parts.body, box(0.18, 0.08, 0.1), c1, 0, 1.45, 0.18);
      for (let i = 0; i < 4; i++) add(parts.body, box(0.46 - i * 0.04, 0.05, 0.28), bone, 0, 1.28 - i * 0.1, 0);
      add(parts.body, box(0.06, 0.55, 0.06), bone, 0, 1.05, -0.1);
      for (const s of [-1, 1]) { add(parts.body, box(0.07, 0.6, 0.07), bone, s * 0.3, 1.05, 0, { rz: s * 0.15 }); add(parts.body, box(0.08, 0.75, 0.08), bone, s * 0.13, 0.38, 0); }
      add(parts.body, box(0.05, 0.9, 0.12), '#a0a8b8', -0.4, 1.0, 0.25, { rx: 0.5 });
      h = 1.9; break;
    }
    case 'eye': {
      parts.body = pivot(root, 0, 1.2, 0);
      add(parts.body, ico(0.55, 1), c1); add(parts.body, ico(0.38, 1), '#f0f0f0', 0, 0, 0.25);
      add(parts.body, ico(0.18, 0), E, 0, 0, 0.53, eyeOpt); add(parts.body, ico(0.08, 0), '#000000', 0, 0, 0.68);
      parts.tent = [];
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, tp = pivot(parts.body, Math.cos(a) * 0.3, -0.4, Math.sin(a) * 0.3); add(tp, cone(0.08, 0.6, 4), c2, 0, -0.3, 0, { rx: Math.PI }); parts.tent.push(tp); }
      h = 1.8; break;
    }
    case 'snake': {
      // coiled body rising from the ground to the head
      parts.seg = [];
      for (let i = 0; i < 9; i++) {
        const k = i / 8, r0 = 0.32 - k * 0.1;
        parts.seg.push(add(root, ico(r0, 0), i % 2 ? c1 : c2, Math.sin(k * 5) * 0.25, 0.25 + Math.pow(k, 1.3) * 1.25, -0.9 + k * 1.0));
      }
      parts.head = pivot(root, 0, 1.6, 0.25);
      add(parts.head, box(0.45, 0.32, 0.55), c1); add(parts.head, box(0.4, 0.1, 0.4), A, 0, -0.18, 0.08); eyes(parts.head, 0.12, 0.2, 0.15, 0.06);
      for (const s of [-1, 1]) add(parts.head, cone(0.04, 0.16, 3), '#ffffff', s * 0.12, -0.25, 0.22, { rx: Math.PI });
      h = 1.8; break;
    }
    case 'crab': {
      parts.body = pivot(root, 0, 0, 0);
      add(parts.body, ico(0.5, 1), c1, 0, 0.55, 0, { s: [1.3, 0.55, 1] }); eyes(parts.body, 0.85, 0.28, 0.15, 0.06);
      parts.claws = [];
      for (const s of [-1, 1]) {
        const cl = pivot(parts.body, s * 0.6, 0.7, 0.35); add(cl, ico(0.22, 0), c3, 0, 0, 0.1); add(cl, cone(0.1, 0.3, 4), c2, 0, 0.1, 0.32, { rx: 1.4 }); parts.claws.push(cl);
        for (let i = 0; i < 3; i++) add(parts.body, box(0.06, 0.5, 0.06), c2, s * (0.45 + i * 0.05), 0.3, -0.2 + i * 0.2, { rz: s * 0.6 });
      }
      h = 1.1; break;
    }
    case 'wraith': {
      parts.body = pivot(root, 0, 0.3, 0);
      add(parts.body, cone(0.55, 1.4, 7), c1, 0, 0.7, 0, { o: 1 });
      add(parts.body, ico(0.3, 1), c2, 0, 1.45, 0.02); add(parts.body, ico(0.24, 0), '#100010', 0, 1.42, 0.12);
      eyes(parts.body, 1.45, 0.3, 0.09, 0.05);
      for (const s of [-1, 1]) add(parts.body, box(0.1, 0.7, 0.1), c2, s * 0.42, 1.0, 0.15, { rz: s * 0.6, rx: -0.5 });
      h = 2.0; break;
    }
    case 'knight': {
      const k = buildCharacter({ skin: c2, hair: c3, hairStyle: 'short', outfit: c1, outfit2: c2, accent: A, pants: c2, eyes: E, weapon: 'sword' }, null, null);
      root.add(k); parts.human = k;
      add(k.userData.P.head, ico(0.42, 1), c3, 0, 0.35, 0, { s: [1, 1, 1.05] });
      add(k.userData.P.head, box(0.4, 0.06, 0.05), E, 0, 0.3, 0.42, eyeOpt);
      add(k.userData.P.arms[1].hand, box(0.08, 0.6, 0.5), c3, -0.06, -0.05, 0.1);
      h = 2.2; break;
    }
    case 'thug': {
      const k = buildCharacter({ skin: pal[2] || '#c89a70', hair: pal[3] || '#1a1410', hairStyle: 'short', outfit: c1, outfit2: shade(c1, -0.25), sleeve: c1,
        accent: '#2a2a2a', pants: pal[1] || '#3a4a6a', boots: '#2a2a2a', eyes: '#101010' }, null, null);
      root.add(k); parts.human = k; h = 2.2; break;
    }
    case 'jetski': {
      parts.body = pivot(root, 0, 0, 0);
      add(parts.body, box(0.7, 0.32, 1.6), c1, 0, 0.25, 0); add(parts.body, cone(0.35, 0.6, 4), c1, 0, 0.25, 1.05, { rx: Math.PI / 2, ry: Math.PI / 4 });
      add(parts.body, box(0.72, 0.08, 1.62), c2, 0, 0.1, 0); add(parts.body, box(0.36, 0.18, 0.7), '#141414', 0, 0.48, -0.2);
      add(parts.body, box(0.6, 0.06, 0.06), '#303030', 0, 0.85, 0.45); add(parts.body, box(0.06, 0.4, 0.06), '#303030', 0, 0.65, 0.42);
      const rider = buildCharacter({ skin: pal[2] || '#c89a70', hair: pal[3] || '#101010', hairStyle: 'short', outfit: c2, outfit2: shade(c2, -0.2), sleeve: c2,
        accent: c1, pants: '#2a2a3a', boots: '#1a1a1a', eyes: '#101010', glasses: true }, null, null);
      rider.position.set(0, 0.0, -0.15); parts.body.add(rider); parts.rider = rider;
      const P = rider.userData.P; P.hips.position.y = 0.62;
      for (const l of P.legs) { l.hip.rotation.x = -1.3; l.kn.rotation.x = 1.4; }
      for (const a of P.arms) { a.sh.rotation.x = -1.1; a.el.rotation.x = -0.3; }
      for (let i = 0; i < 3; i++) add(parts.body, ico(0.12, 0), '#e8f4ff', (i - 1) * 0.3, 0.1, -0.95, { opacity: 0.8 });
      h = 1.6; break;
    }
    case 'dragon': {
      parts.body = pivot(root, 0, 0, 0);
      add(parts.body, ico(0.6, 1), c1, 0, 1.0, 0, { s: [1, 0.9, 1.3] }); add(parts.body, ico(0.45, 0), A, 0, 0.85, 0.3, { s: [0.8, 0.8, 0.6] });
      const nk = pivot(parts.body, 0, 1.3, 0.55); parts.head = nk;
      add(nk, cyl(0.15, 0.22, 0.6), c1, 0, 0.25, 0, { rx: 0.5 });
      add(nk, box(0.4, 0.32, 0.6), c1, 0, 0.55, 0.3); add(nk, box(0.3, 0.12, 0.4), c2, 0, 0.42, 0.45);
      eyes(nk, 0.62, 0.55, 0.14, 0.06);
      for (const s of [-1, 1]) add(nk, cone(0.06, 0.35, 4), c3, s * 0.13, 0.85, 0.1, { rx: -0.6 });
      parts.wings = [];
      for (const s of [-1, 1]) { const w = pivot(parts.body, s * 0.4, 1.4, -0.1); add(w, box(1.3, 0.05, 0.8), c2, s * 0.7, 0.2, -0.1, { rz: s * 0.3 }); parts.wings.push([w, s]); }
      for (const [x, z] of [[-0.35, 0.35], [0.35, 0.35], [-0.35, -0.35], [0.35, -0.35]]) add(parts.body, box(0.2, 0.6, 0.22), c2, x, 0.3, z);
      for (let i = 0; i < 4; i++) add(parts.body, cone(0.18 - i * 0.04, 0.45, 5), c1, 0, 0.8 - i * 0.08, -0.75 - i * 0.35, { rx: -1.7 });
      h = 2.4; break;
    }
    default: add(root, ico(0.5), c1, 0, 0.6, 0);
  }
  root.userData = { parts, kind, h };
  return root;
}
function animateMonster(m, t, hit) {
  const { parts, kind } = m.userData; if (!parts) return;
  const s = Math.sin(t * 0.08);
  switch (kind) {
    case 'slime': parts.body.scale.set(1 + s * 0.06, 0.75 - s * 0.06, 1 + s * 0.06); break;
    case 'bat': case 'dragon': if (parts.wings) for (const [w, d] of parts.wings) w.rotation.z = d * Math.sin(t * (kind === 'bat' ? 0.4 : 0.12)) * 0.6; if (parts.body) parts.body.position.y = (kind === 'bat' ? 1.1 : 0) + Math.sin(t * 0.1) * 0.08; break;
    case 'wolf': if (parts.head) parts.head.rotation.x = s * 0.08; parts.body.position.y = Math.abs(s) * 0.03; break;
    case 'eye': parts.body.position.y = 1.2 + s * 0.12; parts.tent.forEach((tp, i) => { tp.rotation.x = Math.sin(t * 0.1 + i) * 0.4; }); break;
    case 'snake': parts.head.position.y = 1.6 + s * 0.08; parts.head.rotation.x = Math.sin(t * 0.05) * 0.15; parts.seg.forEach((sg, i) => { sg.position.x = Math.sin(i / 8 * 5 + t * 0.05) * 0.25; }); parts.head.position.x = parts.seg[8].position.x; break;
    case 'crab': parts.claws.forEach((c, i) => { c.rotation.x = Math.sin(t * 0.1 + i * 2) * 0.3; }); break;
    case 'wraith': parts.body.position.y = 0.3 + s * 0.15; parts.body.rotation.y = Math.sin(t * 0.03) * 0.2; break;
    case 'golem': parts.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 0.05 + i * Math.PI) * 0.15; }); break;
    case 'knight': case 'thug': poseCharacter(parts.human, hit ? 'attack' : 'idle', t); break;
    case 'jetski': parts.body.position.y = Math.sin(t * 0.12) * 0.08; parts.body.rotation.z = Math.sin(t * 0.07) * 0.08; parts.body.rotation.x = Math.sin(t * 0.09) * 0.05; break;
    default: if (parts.body) parts.body.position.y = Math.abs(s) * 0.04;
  }
}

// ------------------------------------------------------------------ stages (battle, cutscene, title)
const STAGES = {
  grass: { sky: ['#3a7ad8', '#c8e4f8'], ground: ['#6a9a3a', '#5a8a30', '#7aaa48'], fog: '#b8d8f0', props: 'pines' },
  night: { sky: ['#06061a', '#2a2a4a'], ground: ['#2a3a2a', '#1e2c1e', '#344434'], fog: '#1a1a30', props: 'pines', dark: true },
  woods: { sky: ['#020208', '#101820'], ground: ['#1a2a18', '#141f12', '#22301e'], fog: '#05080a', props: 'forest', dark: true, night: true },
  beach: { sky: ['#2a78d8', '#cfeaff'], ground: ['#e8d4a0', '#dcc490', '#f0e0b0'], fog: '#d0e8ff', props: 'palms', sea: true },
  scrub: { sky: ['#4a90e0', '#f0e2b8'], ground: ['#c8a65c', '#b8964c', '#d8b66c'], fog: '#e8dab4', props: 'olives' },
  canyon: { sky: ['#c87840', '#f8d8a0'], ground: ['#c07848', '#b06838', '#d08858'], fog: '#e8b080', props: 'mesas' },
  cave: { sky: ['#05080c', '#1a2836'], ground: ['#3a4652', '#2c3640', '#465260'], fog: '#101820', props: 'stalag', dark: true },
  island: { sky: ['#1a70e0', '#d0f0ff'], ground: ['#d8c088', '#c8b078', '#8ab04a'], fog: '#d0ecff', props: 'palms', sea: true },
  theater: { sky: ['#d06040', '#f8d0a0'], ground: ['#d8c49a', '#c8b48a', '#e8d4aa'], fog: '#f0c8a0', props: 'amphitheater' },
  sea: { sky: ['#2a78d8', '#cfeaff'], ground: ['#2a6ac8', '#3478d0', '#2060b8'], fog: '#c0e0ff', props: 'boat', water: true },
  graveyard: { sky: ['#04040e', '#24244a'], ground: ['#2a3424', '#20281c', '#343e2c'], fog: '#10101e', props: 'graves', dark: true },
  villa: { sky: ['#2a78d8', '#cfeaff'], ground: ['#d8d0bc', '#ccc4b0', '#e4dcc8'], fog: '#d0e8ff', props: 'villa' },
  shrine: { sky: ['#14141c', '#50506a'], ground: ['#8a8a94', '#74747e', '#9a9aa4'], fog: '#30303c', props: 'pillars', dark: true },
  day: { sky: ['#f0a060', '#a0d0ff'], ground: ['#e8d4a0', '#dcc490', '#f0e0b0'], fog: '#f0c8a0', props: 'palms', sea: true }
};
function skyDome(top, bottom) {
  const geo = new THREE.SphereGeometry(60, 12, 8), cols = [], ct = new THREE.Color(top), cb = new THREE.Color(bottom), tmp = new THREE.Color();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = clamp(pos.getY(i) / 60, 0, 1); tmp.copy(cb).lerp(ct, Math.pow(k, 0.6)); cols.push(tmp.r, tmp.g, tmp.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
}
function buildStage(key, seed = 1) {
  const st = STAGES[key] || STAGES.grass, scene = new THREE.Scene(), r = mulberry32(hashStr(key) + seed);
  scene.add(skyDome(st.sky[0], st.sky[1]));
  scene.fog = new THREE.Fog(st.fog, 14, 46);
  scene.add(new THREE.HemisphereLight(st.dark ? 0x9090b8 : 0xe8f0ff, st.dark ? 0x202030 : 0x504030, st.night ? 0.45 : st.dark ? 0.7 : 0.62));
  const sun = new THREE.DirectionalLight(st.dark ? 0xc0c0ff : 0xfff0d8, st.dark ? 0.5 : 0.6); sun.position.set(-4, 10, 6); scene.add(sun);
  // ground: low-poly disc with per-vertex colour noise and gentle hills toward the edge
  // ground: a low-poly grid, flat in the arena and rising into hills further out
  const geo = new THREE.PlaneGeometry(90, 90, 30, 30);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, gc = st.ground.map(c => new THREE.Color(c));
  for (let i = 0; i < pos.count; i++) { const d = Math.hypot(pos.getX(i), pos.getZ(i)); pos.setY(i, d > 11 ? (d - 11) * (0.15 + 0.3 * r()) : (r() - 0.5) * 0.1); }
  const ng = flat(geo), cols = [];
  for (let i = 0; i < ng.attributes.position.count / 3; i++) { const c = gc[Math.floor(r() * gc.length)]; for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b); }
  ng.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(ng, vmat()));
  // inner battle field: a lighter flat ring of tiles
  for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = r() * 8; add(scene, box(0.6 + r(), 0.02, 0.6 + r()), st.ground[2], Math.cos(a) * d, 0.01, Math.sin(a) * d, { ry: r() * 3 }); }
  // props in a ring around the arena
  // props stay out of the arena and out of the camera's side of the ring (+x/+z quadrant)
  const ring = (n, fn) => { for (let i = 0; i < n; i++) { const a = Math.PI * 0.62 + r() * Math.PI * 1.55, d = 12 + r() * 16; fn(Math.sin(a) * d, Math.cos(a) * d, 0.7 + r() * 0.8); } };
  const tree = (x, z, s, leaf = '#2e7a2e', snow) => { const g = pivot(scene, x, 0, z); g.scale.setScalar(s * 1.6); add(g, cyl(0.12, 0.16, 0.8), '#5a3a1a', 0, 0.4, 0); add(g, cone(0.7, 1.4, 6), leaf, 0, 1.4, 0); add(g, cone(0.5, 1.0, 6), snow ? '#ffffff' : shade(leaf, 0.15), 0, 2.0, 0); };
  const palm = (x, z, s) => { const g = pivot(scene, x, 0, z); g.scale.setScalar(s * 1.5); g.rotation.z = (r() - 0.5) * 0.3;
    for (let i = 0; i < 5; i++) add(g, cyl(0.1 - i * 0.008, 0.11 - i * 0.008, 0.6, 5), '#8a6a3a', 0, 0.3 + i * 0.55, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(g, box(0.25, 0.04, 1.3), '#3a8a2a', Math.cos(a) * 0.55, 2.8, Math.sin(a) * 0.55, { ry: -a + Math.PI / 2, rx: 0.35 }); } };
  const olive = (x, z, s) => { const g = pivot(scene, x, 0, z); g.scale.setScalar(s * 1.4); add(g, cyl(0.12, 0.18, 0.9), '#6a5a40', 0, 0.45, 0); add(g, ico(0.75, 0), '#7a8a52', 0, 1.3, 0, { s: [1.2, 0.8, 1.2] }); add(g, ico(0.5, 0), '#8a9a62', 0.3, 1.6, 0.2); };
  const seaPlane = () => { const w = add(scene, box(140, 0.1, 60), '#2a6ac8', 0, 0.02, -42); w.material = mat('#2a6ac8', { opacity: 0.92 }); };
  switch (st.props) {
    case 'pines': ring(12, (x, z, s) => { const g = pivot(scene, x, 0, z); g.scale.setScalar(s * 1.6); add(g, cyl(0.1, 0.15, 1.6), '#6a4a2a', 0, 0.8, 0); add(g, ico(0.9, 0), '#3a6a2a', 0, 1.9, 0, { s: [1.4, 0.45, 1.4] }); });
      ring(8, (x, z, s) => add(scene, ico(0.6 * s, 0), '#a8a090', x, 0.3, z)); break;
    case 'forest': ring(46, (x, z, s) => tree(x, z, s * 1.4, '#14301a')); break;
    case 'palms': ring(14, (x, z, s) => palm(x, z, s)); if (st.sea) seaPlane(); break;
    case 'olives': ring(16, (x, z, s) => olive(x, z, s)); ring(10, (x, z, s) => add(scene, ico(0.7 * s, 0), '#a89878', x, 0.3, z)); break;
    case 'mesas': ring(12, (x, z, s) => { const hh = 3 + r() * 6; add(scene, cyl(1.2 * s, 1.8 * s, hh, 6), '#a85a30', x, hh / 2, z); add(scene, cyl(1.25 * s, 1.25 * s, 0.4, 6), '#c07040', x, hh, z); }); break;
    case 'stalag': ring(30, (x, z, s) => { add(scene, cone(0.5 * s, 2.5 * s, 5), '#4a5866', x, 1.2 * s, z); add(scene, cone(0.4 * s, 2 * s, 5), '#3a4652', x * 1.1, 8, z * 1.1, { rx: Math.PI }); }); break;
    case 'amphitheater': {
      // stepped stone seating in a half ring behind the enemies, columns at the ends
      for (let tier = 0; tier < 6; tier++) for (let i = 0; i <= 18; i++) {
        const a = Math.PI + i / 18 * Math.PI, rr = 15 + tier * 1.6;
        add(scene, box(5.4, 0.8, 1.8), tier % 2 ? '#c8b48a' : '#d8c49a', Math.cos(a) * rr, 0.4 + tier * 0.8, Math.sin(a) * rr, { ry: -a + Math.PI / 2 });
      }
      for (const x of [-13, -9, 9, 13]) { add(scene, cyl(0.45, 0.5, 5, 8), '#e8dcc0', x, 2.5, -6); add(scene, box(1.3, 0.35, 1.3), '#d8c8a8', x, 5.1, -6); }
      break;
    }
    case 'boat': {
      for (let i = 0; i < 60; i++) { const w = add(scene, box(1.5 + r() * 2, 0.06, 0.25), '#e8f4ff', (r() - 0.5) * 50, 0.05, (r() - 0.5) * 50); w.material = mat('#e8f4ff', { opacity: 0.7 }); }
      add(scene, box(7.5, 0.5, 3.2), '#9a6a3a', 0.6, -0.05, 3.3); add(scene, box(7.7, 0.6, 0.2), '#7a4a2a', 0.6, 0.3, 4.9); add(scene, box(7.7, 0.6, 0.2), '#7a4a2a', 0.6, 0.3, 1.7);
      add(scene, box(1.2, 0.8, 1.6), '#e8e4d8', 4.6, 0.4, 3.3);
      add(scene, ico(4, 1), '#8ab04a', -30, -1.5, -40, { s: [2, 0.7, 1] }); break;
    }
    case 'graves': ring(26, (x, z, s) => { if (r() < 0.5) { add(scene, box(0.7 * s, 1.1 * s, 0.2), '#8a8a90', x, 0.55 * s, z); } else { add(scene, box(0.15, 1.4 * s, 0.15), '#9a9aa0', x, 0.7 * s, z); add(scene, box(0.7 * s, 0.15, 0.15), '#9a9aa0', x, 1.0 * s, z); } });
      ring(8, (x, z, s) => add(scene, cone(0.6 * s, 4 * s, 6), '#1a3020', x, 2 * s, z)); break;
    case 'villa': {
      add(scene, box(12, 3.5, 0.6), '#f4f2ec', 0, 1.75, -12); add(scene, box(3, 2.4, 0.2), '#2a6ab8', 0, 1.2, -11.6);
      const pool = add(scene, box(8, 0.06, 4), '#40a0e8', -4, 0.03, -6, { emissive: 0x103050 }); pool.material = mat('#40a0e8', { emissive: 0x103050 });
      add(scene, box(8.6, 0.12, 4.6), '#e8e4d8', -4, 0.0, -6);
      ring(8, (x, z, s) => palm(x, z, s)); break;
    }
    case 'pillars': ring(14, (x, z, s) => { const hgt = (1 + r() * 3) * s; add(scene, cyl(0.45, 0.5, hgt, 8), st.ground[0], x, hgt / 2, z); add(scene, box(1.2, 0.3, 1.2), st.ground[1], x, hgt, z); }); break;
  }
  return scene;
}
function stageCamera() { const c = new THREE.PerspectiveCamera(42, SW / SH, 0.1, 120); return c; }

// ------------------------------------------------------------------ 3D maps
// One merged, vertex-coloured mesh per map; dynamic things (water, crystals, chests, people) are separate.
class GeoBuilder {
  constructor() { this.p = []; this.c = []; }
  tri(a, b, c, col) { this.p.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) this.c.push(col.r, col.g, col.b); }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  box(x0, y0, z0, x1, y1, z1, top, side, bottom = false) {
    const T = new THREE.Color(top), S = new THREE.Color(side), S2 = S.clone().multiplyScalar(0.85);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], T);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], S);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], S2);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], S2);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], S2);
  }
  floor(x, z, y, col) { this.quad([x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z], new THREE.Color(col)); }
  cone(cx, cz, y0, r, h, col, n = 5, rot = 0) {
    const C = new THREE.Color(col);
    for (let i = 0; i < n; i++) {
      const a0 = rot + i / n * Math.PI * 2, a1 = rot + (i + 1) / n * Math.PI * 2;
      const sh = C.clone().multiplyScalar(0.8 + 0.2 * Math.cos(a0 - 0.8));
      this.tri([cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx, y0 + h, cz], sh);
    }
  }
  prism(x0, z0, x1, z1, y0, h, col) { // gable roof, ridge along x
    const C = new THREE.Color(col), zm = (z0 + z1) / 2, D = C.clone().multiplyScalar(0.75);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0 + h, zm], [x0, y0 + h, zm], C);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y0 + h, zm], [x1, y0 + h, zm], D);
    this.tri([x0, y0, z0], [x0, y0, z1], [x0, y0 + h, zm], D); this.tri([x1, y0, z1], [x1, y0, z0], [x1, y0 + h, zm], D);
  }
  mesh(m = vmat()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, m);
  }
}
const FLOOR_COL = {
  grass: '#4a9a3a', flowers: '#4a9a3a', forest: '#2e6e2a', tree: '#4a9a3a', mountain: '#4a9a3a', sand: '#e4cc8c', dune: '#dcc080', cactus: '#e4cc8c',
  dmountain: '#e4cc8c', snow: '#c8a65c', snowtree: '#c8a65c', smountain: '#c8a65c', waste: '#d8c088', wmountain: '#d8c088', road: '#c8a878',
  boulder: '#c8a878', riftwall: '#1a0a20', lightbridge: '#1a0a20', icewall: '#c8c8d8', tpath: '#c8b090', counter: '#c8b090', fountain: '#c8b090'
};
const MOUNTAIN = { mountain: ['#8a7a5a', '#a89a78'], smountain: ['#9a7a52', '#b89a70'], dmountain: ['#b0703a', '#c88a50'], wmountain: ['#8a7a60', '#a89878'] };
function buildMap3D(map) {
  const B = new GeoBuilder(), scene = new THREE.Scene(), th = map.theme, W = map.w, H = map.h;
  const r = mulberry32(hashStr(map.id + 'x'));
  const dyn = { water: [], crystals: [], portals: [], chests: [], lava: [] };
  const T = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 'void' : map.tiles[y * W + x];
  const jitter = (c, k = 0.06) => { const col = new THREE.Color(c); const f = 1 + (r() - 0.5) * k * 2; return col.multiplyScalar(f).getHex(); };
  const tree = (x, z, s, leaf, snow) => { B.box(x - 0.06, 0, z - 0.06, x + 0.06, 0.35 * s, z + 0.06, '#5a3a1a', '#5a3a1a'); B.cone(x, z, 0.25 * s, 0.38 * s, 0.75 * s, leaf, 6, r()); B.cone(x, z, 0.6 * s, 0.26 * s, 0.5 * s, snow ? '#ffffff' : shade(leaf, 0.15), 6, r()); };
  const waterTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = T(x, y), cx = x + 0.5, cz = y + 0.5;
    if (t === 'water' || t === 'dwater' || t === 'brokenbridge' || t === 'bridgeH' || t === 'bridgeV') {
      waterTiles.push([x, y]); B.floor(x, y, -0.25, '#20407a');
      if (t === 'bridgeH') B.box(x, -0.05, y + 0.2, x + 1, 0.06, y + 0.8, '#9a6a3a', '#6a4a2a');
      if (t === 'bridgeV') B.box(x + 0.2, -0.05, y, x + 0.8, 0.06, y + 1, '#9a6a3a', '#6a4a2a');
      if (t === 'brokenbridge') { B.box(x + 0.15, -0.3, y + 0.1, x + 0.3, 0.2, y + 0.25, '#5a3a1a', '#5a3a1a'); B.box(x + 0.6, -0.3, y + 0.7, x + 0.75, 0.15, y + 0.85, '#5a3a1a', '#5a3a1a'); }
      continue;
    }
    if (t === 'lava') { B.floor(x, y, -0.1, '#e04010'); dyn.lava.push([x, y]); continue; }
    if (map.type === 'dungeon' && (t === 'dwall' || t === 'dtop' || t === 'void')) {
      B.box(x, 0, y, x + 1, 0.75, y + 1, jitter(th.top, 0.1), jitter(th.wall, 0.08));
      const v = r(), px = x + 0.25 + r() * 0.5, pz = y + 0.25 + r() * 0.5;
      switch (th.id) {
        case 'woods': if (v < 0.7) tree(px, pz, 1.3 + r() * 0.6, v < 0.35 ? '#1e5a22' : '#2a6e2a'); break;
        case 'cave': if (v < 0.3) B.cone(px, pz, 0.75, 0.22, 0.5 + r() * 0.8, '#4a5866', 5, r()); break;
        case 'ice': if (v < 0.35) B.cone(px, pz, 0.75, 0.15, 0.6 + r() * 1.0, v < 0.15 ? '#c8f0ff' : '#80b8e8', 4, r()); break;
        case 'scrub': if (v < 0.35) { B.box(px - 0.05, 0.75, pz - 0.05, px + 0.05, 1.15, pz + 0.05, '#6a5a40', '#6a5a40'); B.cone(px, pz, 1.05, 0.38, 0.4, v < 0.18 ? '#7a8a52' : '#8a9a62', 6, r()); } break;
        case 'canyon': if (v < 0.3) B.cone(px, pz, 0.75, 0.3, 0.8 + r() * 1.6, v < 0.12 ? '#a85a30' : '#c07040', 5, r()); break;
        case 'theater': if (v < 0.5) { B.box(x, 0.75, y, x + 1, 1.05, y + 0.5, '#c8b48a', '#b8a47a'); B.box(x, 1.05, y, x + 1, 1.35, y + 0.25, '#d8c49a', '#c8b48a'); }
          if (v > 0.9) { B.box(px - 0.14, 0.75, pz - 0.14, px + 0.14, 2.3, pz + 0.14, '#ece0c4', '#d8ccb0'); B.box(px - 0.22, 2.3, pz - 0.22, px + 0.22, 2.42, pz + 0.22, '#e0d4b8', '#d0c4a8'); } break;
        case 'ruins': if (v < 0.15) { const hh = 0.5 + r() * 1.2; B.box(px - 0.15, 0.75, pz - 0.15, px + 0.15, 0.75 + hh, pz + 0.15, '#c09060', '#9a6a40'); } break;
        case 'rift': if (v < 0.3) B.cone(px, pz, 0.75, 0.14, 0.6 + r() * 1.4, v < 0.12 ? '#e060ff' : '#7020a0', 4, r()); break;
        case 'shrine': if (v < 0.12) B.box(px - 0.14, 0.75, pz - 0.14, px + 0.14, 2.0, pz + 0.14, '#b0b0bc', '#8a8a96'); break;
      }
      continue;
    }
    if (map.type === 'dungeon') {
      B.floor(x, y, 0, jitter(th.floor, 0.08));
      if (t === 'stairsdown') for (let i = 0; i < 4; i++) B.box(x + 0.1, -0.05 - i * 0.12, y + 0.1 + i * 0.2, x + 0.9, 0.0 - i * 0.12, y + 0.3 + i * 0.2, shade(th.floor, -0.2 - i * 0.15), '#000');
      if (t === 'stairsup') for (let i = 0; i < 4; i++) B.box(x + 0.1, 0, y + 0.1 + i * 0.2, x + 0.9, 0.5 - i * 0.12, y + 0.3 + i * 0.2, shade(th.floor, 0.15), shade(th.floor, -0.1));
      if (t === 'crystal') { B.box(cx - 0.3, 0, cz - 0.3, cx + 0.3, 0.15, cz + 0.3, '#707080', '#505060'); dyn.crystals.push([cx, cz]); }
      if (t === 'portal') dyn.portals.push([cx, cz]);
      continue;
    }
    if (map.type === 'town') {
      const tt = map.theme;
      if (t === 'ttree') { B.floor(x, y, 0, tt.ground); if (tt.med && (x + y) % 2) { B.cone(cx, cz, 0.2, 0.28, 2.2, '#2a5a2a', 6, r()); B.box(cx - 0.05, 0, cz - 0.05, cx + 0.05, 0.3, cz + 0.05, '#5a3a1a', '#5a3a1a'); } else tree(cx, cz, 1.6, tt.leaf, false); continue; }
      if (t === 'roof' || t === 'wall' || t === 'window' || t === 'door') { B.floor(x, y, 0, tt.ground); continue; } // buildings added below
      const col = t === 'tpath' ? '#c8b090' : t === 'tflower' ? tt.ground : t === 'counter' || t === 'fountain' ? '#c8b090' : jitter(tt.ground, 0.05);
      B.floor(x, y, 0, col);
      if (t === 'tflower') for (let i = 0; i < 4; i++) { const fx = x + 0.15 + r() * 0.7, fz = y + 0.15 + r() * 0.7; B.box(fx, 0, fz, fx + 0.08, 0.08, fz + 0.08, pick2(r, tt.flowers), '#2a6a2a'); }
      if (t === 'counter') { B.box(x, 0, y + 0.15, x + 1, 0.55, y + 0.85, '#b07a4a', '#7a4a2a'); }
      if (t === 'fountain') { B.box(x + 0.05, 0, y + 0.05, x + 0.95, 0.3, y + 0.95, '#a0a0a8', '#80808a'); B.box(x + 0.4, 0.3, y + 0.4, x + 0.6, 0.9, y + 0.6, '#b0b0b8', '#90909a'); waterTiles.push([x, y, 0.28, 0.12]); }
      if (t === 'sign') { B.box(cx - 0.04, 0, cz - 0.04, cx + 0.04, 0.6, cz + 0.04, '#5a3a1a', '#5a3a1a'); B.box(cx - 0.3, 0.45, cz - 0.05, cx + 0.3, 0.75, cz + 0.05, '#b07a4a', '#8a5a2a'); }
      if (t === 'well') { B.box(x + 0.2, 0, y + 0.2, x + 0.8, 0.4, y + 0.8, '#808088', '#606068'); B.box(x + 0.2, 0.4, y + 0.45, x + 0.25, 1.0, y + 0.55, '#5a3a1a', '#5a3a1a'); B.box(x + 0.75, 0.4, y + 0.45, x + 0.8, 1.0, y + 0.55, '#5a3a1a', '#5a3a1a'); B.prism(x + 0.1, y + 0.25, x + 0.9, y + 0.75, 1.0, 0.25, '#8a3a2a'); }
      continue;
    }
    // world map
    const base = FLOOR_COL[t] || '#4a9a3a';
    B.floor(x, y, 0, jitter(base, 0.05));
    if (MOUNTAIN[t]) { const [mc, cap] = MOUNTAIN[t], hgt = 1.1 + r() * 0.9; B.cone(cx + (r() - 0.5) * 0.2, cz + (r() - 0.5) * 0.2, 0, 0.75, hgt, mc, 5, r() * 3); B.cone(cx, cz, hgt * 0.62, 0.3, hgt * 0.38, cap, 5, r()); }
    else if (t === 'forest') { tree(x + 0.3, y + 0.35, 1, '#2e6a2a'); tree(x + 0.72, y + 0.7, 0.9, '#2a5e26'); }
    else if (t === 'snowtree') { B.box(cx - 0.05, 0, cz - 0.05, cx + 0.05, 0.3, cz + 0.05, '#6a5a40', '#6a5a40'); B.cone(cx, cz, 0.25, 0.32, 0.35, '#7a8a52', 6, r()); B.cone(cx, cz, 0.45, 0.24, 0.25, '#8a9a62', 6, r()); }
    else if (t === 'waste' && r() < 0.08) { B.box(cx - 0.04, 0, cz - 0.04, cx + 0.04, 0.9, cz + 0.04, '#8a6a3a', '#8a6a3a'); B.cone(cx, cz, 0.85, 0.45, 0.12, '#3a8a2a', 6, r()); }
    else if (t === 'grass' && r() < 0.04) { B.box(cx - 0.04, 0, cz - 0.04, cx + 0.04, 0.5, cz + 0.04, '#6a4a2a', '#6a4a2a'); B.cone(cx, cz, 0.45, 0.4, 0.2, '#3a6a2a', 7, r()); }
    else if (t === 'cactus') { B.box(cx - 0.08, 0, cz - 0.08, cx + 0.08, 0.6, cz + 0.08, '#3a8a3a', '#2a6a2a'); B.box(cx + 0.08, 0.25, cz - 0.05, cx + 0.22, 0.32, cz + 0.05, '#3a8a3a', '#2a6a2a'); }
    else if (t === 'dune') B.cone(cx, cz, 0, 0.5, 0.18, '#d0aa58', 6, r());
    else if (t === 'flowers') for (let i = 0; i < 3; i++) { const fx = x + 0.2 + r() * 0.6, fz = y + 0.2 + r() * 0.6; B.box(fx, 0, fz, fx + 0.07, 0.07, fz + 0.07, pick2(r, ['#f0e040', '#f06080', '#ffffff']), '#2a6a2a'); }
    else if (t === 'boulder') B.cone(cx, cz, 0, 0.42, 0.55, '#6a6a74', 6, r());
    else if (t === 'riftwall') for (let i = 0; i < 3; i++) B.cone(x + 0.2 + r() * 0.6, y + 0.2 + r() * 0.6, 0, 0.15, 0.8 + r() * 0.8, '#9030d0', 4, r());
    else if (t === 'lightbridge') B.box(x, 0.02, y + 0.25, x + 1, 0.08, y + 0.75, '#e0d0ff', '#a080ff');
    else if (t === 'road') { /* flat */ }
  }
  // town buildings: flood-fill roof/wall tiles into rectangles
  if (map.type === 'town') {
    const seen = new Set(), bld = t => t === 'roof' || t === 'wall' || t === 'window' || t === 'door';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!bld(T(x, y)) || seen.has(y * W + x)) continue;
      let x1 = x; while (bld(T(x1 + 1, y))) x1++;
      let y1 = y; while (bld(T(x, y1 + 1))) y1++;
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) seen.add(yy * W + xx);
      const th2 = map.theme, wall = th2.wall, roof = th2.roof, door = th2.door || '#6a3a1a';
      if (th2.med) {
        // whitewashed house: flat roof, parapet, a dome on some, blue door and shutters
        B.box(x + 0.05, 0, y + 0.2, x1 + 0.95, 1.8, y1 + 0.95, wall, shade(wall, -0.04));
        B.box(x + 0.0, 1.8, y + 0.15, x1 + 1.0, 1.98, y + 0.27, wall, wall); B.box(x + 0.0, 1.8, y1 + 0.88, x1 + 1.0, 1.98, y1 + 1.0, wall, wall);
        B.box(x + 0.0, 1.8, y + 0.15, x + 0.12, 1.98, y1 + 1.0, wall, wall); B.box(x1 + 0.88, 1.8, y + 0.15, x1 + 1.0, 1.98, y1 + 1.0, wall, wall);
        if ((x + y) % 3 !== 1) { const dx = (x + x1 + 1) / 2, dz = (y + y1 + 1) / 2; B.box(dx - 0.6, 1.8, dz - 0.6, dx + 0.6, 2.1, dz + 0.6, wall, wall); B.cone(dx, dz, 2.1, 0.62, 0.7, '#f8f8f4', 8, 0); }
        for (let xx = x; xx <= x1; xx++) {
          const ft = T(xx, y1);
          if (ft === 'door') { B.box(xx + 0.22, 0, y1 + 0.94, xx + 0.78, 1.05, y1 + 1.0, door, door); B.box(xx + 0.18, 1.05, y1 + 0.94, xx + 0.82, 1.15, y1 + 1.0, shade(door, -0.2), door); }
          if (ft === 'window') { B.box(xx + 0.2, 0.8, y1 + 0.94, xx + 0.8, 1.35, y1 + 1.0, door, door); B.box(xx + 0.45, 0.8, y1 + 0.95, xx + 0.55, 1.35, y1 + 1.01, shade(door, -0.3), door); }
          if (ft === 'roof' && (xx * 7 + y1) % 4 === 0) B.box(xx + 0.3, 1.2, y1 + 0.94, xx + 0.7, 1.5, y1 + 1.0, door, door);
        }
      } else {
        B.box(x + 0.05, 0, y + 0.3, x1 + 0.95, 1.5, y1 + 0.95, wall, wall);
        B.prism(x - 0.1, y + 0.1, x1 + 1.1, y1 + 1.15, 1.5, 1.0, roof);
        for (let xx = x; xx <= x1; xx++) {
          const ft = T(xx, y1);
          if (ft === 'door') B.box(xx + 0.25, 0, y1 + 0.94, xx + 0.75, 0.9, y1 + 1.0, '#6a3a1a', '#6a3a1a');
          if (ft === 'window') { B.box(xx + 0.25, 0.65, y1 + 0.94, xx + 0.75, 1.1, y1 + 1.0, '#f0d070', '#f0d070'); }
        }
      }
    }
  }
  // world locations: small models on top of their tiles
  if (map.type === 'world') for (const l of map.locs) {
    const cx = l.x + 0.5, cz = l.y + 0.5;
    if (l.id.startsWith('town')) {
      const roof = { town1: '#c04030', town2: '#3060c0', town3: '#4a6a8a', town4: '#c08030' }[l.id];
      for (const [dx, dz, s] of [[-0.2, -0.15, 0.32], [0.22, 0.05, 0.28], [-0.05, 0.28, 0.24]]) { B.box(cx + dx - s / 2, 0, cz + dz - s / 2, cx + dx + s / 2, s * 0.9, cz + dz + s / 2, '#e8d8b8', '#d0c0a0'); B.prism(cx + dx - s / 2 - 0.03, cz + dz - s / 2 - 0.03, cx + dx + s / 2 + 0.03, cz + dz + s / 2 + 0.03, s * 0.9, s * 0.5, roof); }
    } else if (l.id === 'dungeon5') { B.cone(cx, cz, 0, 0.45, 2.4, '#2a0a3a', 4, 0.8); B.cone(cx, cz, 1.6, 0.15, 1.4, '#c040ff', 4, 0.2); }
    else if (l.id === 'secret') { for (const dx of [-0.3, 0.3]) B.box(cx + dx - 0.07, 0, cz - 0.07, cx + dx + 0.07, 0.8, cz + 0.07, '#a0a0b0', '#80808a'); B.prism(cx - 0.45, cz - 0.25, cx + 0.45, cz + 0.25, 0.8, 0.3, '#606070'); }
    else if (l.id === 'dungeon3') { for (const [dx, h] of [[-0.25, 1.2], [0.25, 1.4], [0, 1.8]]) B.cone(cx + dx, cz - 0.1, 0, 0.18, h, '#90c8f0', 4, 0.3); }
    else if (l.id === 'dungeon4') { B.box(cx - 0.4, 0, cz - 0.3, cx + 0.4, 0.6, cz + 0.3, '#b07040', '#8a5030'); B.box(cx - 0.12, 0, cz + 0.29, cx + 0.12, 0.35, cz + 0.32, '#200a04', '#200a04'); }
    else { B.cone(cx, cz - 0.1, 0, 0.6, 0.9, l.id === 'dungeon1' ? '#1e5a22' : '#6a6a7a', 6, 0.5); B.box(cx - 0.15, 0, cz + 0.32, cx + 0.15, 0.35, cz + 0.36, '#050505', '#050505'); }
  }
  scene.add(B.mesh());
  if (waterTiles.length) {
    const WB = new GeoBuilder();
    for (const [x, y, h = 0, inset = 0] of waterTiles) WB.floor(x + inset, y + inset, h ? h : -0.08, '#3a6ad8');
    const wm = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }); wm.onBeforeCompile = SNAP;
    dyn.waterMesh = WB.mesh(wm); scene.add(dyn.waterMesh);
  }
  for (const [cx, cz] of dyn.crystals) { const c = add(scene, flat(new THREE.OctahedronGeometry(0.28, 0)), '#60e0ff', cx, 0.7, cz, { emissive: 0x2080a0 }); dyn.crystalMeshes = (dyn.crystalMeshes || []).concat(c); }
  for (const [cx, cz] of dyn.portals) { const p = add(scene, cyl(0.42, 0.42, 0.05, 10), '#a0f0ff', cx, 0.05, cz, { emissive: 0x4080c0 }); dyn.portalMeshes = (dyn.portalMeshes || []).concat(p); }
  if (map.objs) for (const o of map.objs) if (o.type === 'chest') {
    const g = pivot(scene, o.x + 0.5, 0, o.y + 0.5);
    add(g, box(0.6, 0.35, 0.4), '#a0602a', 0, 0.18, 0); add(g, box(0.62, 0.06, 0.42), '#e0c050', 0, 0.3, 0);
    const lid = pivot(g, 0, 0.36, -0.2); add(lid, box(0.6, 0.14, 0.4), '#c07a3a', 0, 0.07, 0.2);
    dyn.chests.push({ o, lid });
  }
  // lighting
  const dark = map.type === 'dungeon';
  scene.add(new THREE.HemisphereLight(dark ? 0x9090b0 : 0xe8f0ff, dark ? 0x202028 : 0x504030, dark ? 0.55 : 0.62));
  const sun = new THREE.DirectionalLight(0xfff0d8, dark ? 0.35 : 0.58); sun.position.set(-3, 10, 5); scene.add(sun);
  if (dark) { dyn.torch = new THREE.PointLight(0xffd8a0, 1.4, 8); scene.add(dyn.torch); }
  const skyc = map.type === 'world' ? '#9ac0e8' : dark ? th.top : '#9ac0e8';
  scene.background = new THREE.Color(skyc);
  scene.fog = map.type === 'world' ? new THREE.Fog(skyc, 16, 30) : dark ? new THREE.Fog(th.top, 9, 18) : null;
  return { scene, dyn };
}

// Field renderer: holds the 3D version of the current map and the people on it.
const Field3D = {
  map: null, scene: null, cam: null, people: new Map(),
  sync(field) {
    const m = field.map;
    if (this.map !== m || this.gateKey !== this.gates(m)) {
      this.map = m; this.gateKey = this.gates(m);
      const built = buildMap3D(m); this.scene = built.scene; this.dyn = built.dyn; this.people = new Map(); this.boss = null;
      this.cam = new THREE.PerspectiveCamera(m.type === 'world' ? 45 : 40, SW / SH, 0.1, 80);
      this.camPos = null;
    }
  },
  gates(m) { return m.type === 'world' ? m.gates.map(g => m.tiles[g.y * m.w + g.x]).join() : ''; },
  person(key, look, castId, job) {
    let p = this.people.get(key);
    if (!p) { p = buildCharacter(look, castId, job); p.scale.setScalar(0.5); this.scene.add(p); this.people.set(key, p); }
    p.userData.seen = true; return p;
  },
  draw(field) {
    if (!R3.ok) return;
    this.sync(field);
    const m = field.map, t = G.frame;
    for (const p of this.people.values()) p.userData.seen = false;
    const facing = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
    // player
    const lead = S.party[0], pl = this.person('player', CAST[lead].look, lead, CAST[lead].job);
    const px = field.px + field.mx / 16 + 0.5, pz = field.py + field.my / 16 + 0.5;
    pl.position.set(px, 0, pz); pl.rotation.y = facing[field.dir];
    poseCharacter(pl, field.moving ? 'walk' : 'idle', field.moving ? field.walkF * 4 + (8 - field.moving) : t);
    if (m.type === 'world') pl.scale.setScalar(0.42); else pl.scale.setScalar(0.5);
    for (const n of field.npcs) {
      const look = n.cast ? CAST[n.cast].look : n.look; if (!look) continue;
      const np = this.person(n, look, n.cast, null);
      np.position.set(n.x + n.ox / 16 + 0.5, 0, n.y + n.oy / 16 + 0.5); np.rotation.y = facing[n.dir] || 0;
      poseCharacter(np, n.mv ? 'walk' : 'idle', n.mv ? t * 1.5 : t + n.x * 7);
    }
    if (m.objs) for (const o of m.objs) if (o.type === 'boss') {
      const bl = DUNGEONS[m.dungeon].bossLook;
      if (!this.boss) {
        this.boss = bl.cast ? buildCharacter(CAST[bl.cast].look, bl.cast, null) : buildMonster(bl.kind, bl.pal);
        this.boss.scale.setScalar(bl.cast ? 0.6 : 0.8); this.scene.add(this.boss);
      }
      this.boss.position.set(o.x + 0.5, 0, o.y + 0.5); this.boss.userData.seen = true;
      if (bl.cast) poseCharacter(this.boss, 'idle', t); else animateMonster(this.boss, t);
    }
    if (this.boss && !this.boss.userData.seen) { this.scene.remove(this.boss); this.boss = null; }
    for (const [k, p] of this.people) if (!p.userData.seen && p !== this.boss) { this.scene.remove(p); this.people.delete(k); }
    // dynamic bits
    const d = this.dyn;
    if (d.crystalMeshes) for (const c of d.crystalMeshes) { c.rotation.y = t * 0.03; c.position.y = 0.75 + Math.sin(t * 0.05) * 0.1; }
    if (d.portalMeshes) for (const p of d.portalMeshes) p.scale.setScalar(1 + Math.sin(t * 0.1) * 0.08);
    if (d.waterMesh) d.waterMesh.position.y = Math.sin(t * 0.04) * 0.02;
    for (const c of d.chests) c.lid.rotation.x = S.flags[c.o.key] ? -1.9 : 0;
    if (d.torch) d.torch.position.set(px, 1.6, pz + 0.3);
    // camera: FF-style fixed angle that follows the player
    const off = m.type === 'world' ? [0, 10, 8] : m.type === 'town' ? [0, 7.5, 6.5] : [0, 8.5, 4.2];
    const want = new THREE.Vector3(px + off[0], off[1], pz + off[2]);
    if (m.type !== 'world') { want.x = clamp(want.x, 5.5, Math.max(5.5, m.w - 5.5)); want.z = clamp(want.z, off[2] + 3, Math.max(off[2] + 3, m.h + off[2] - 4.2)); }
    if (!this.camPos) this.camPos = want.clone(); else this.camPos.lerp(want, 0.15);
    this.cam.position.copy(this.camPos);
    this.cam.lookAt(this.camPos.x - off[0], 0.4, this.camPos.z - off[2] * 0.98);
    R3.render(this.scene, this.cam);
  },
  screenOf(x, y, h = 1.2) { return R3.project(new THREE.Vector3(x + 0.5, h, y + 0.5), this.cam); }
};

// A simple stage with characters for the title screen and cutscenes.
class StageView {
  constructor(key) { this.key = key; this.scene = buildStage(key); this.cam = stageCamera(); this.actors = []; this.t = 0; this.speaker = null; }
  addActor(id) {
    if (this.actors.some(a => a.id === id) || !CAST[id]) return;
    const villain = id.startsWith('villain');
    const m = buildCharacter(CAST[id].look, id, CAST[id].job);
    this.scene.add(m); this.actors.push({ id, m, villain });
    const heroes = this.actors.filter(a => !a.villain), vs = this.actors.filter(a => a.villain);
    heroes.forEach((a, i) => { a.m.position.set(0.9 + i * 1.25, 0, 0.2 - i * 0.35); a.m.rotation.y = -0.55; });
    vs.forEach((a, i) => { a.m.position.set(-1.6 - i * 1.4, 0, -0.2 - i * 0.3); a.m.rotation.y = 0.55; a.m.scale.setScalar(1.1); });
  }
  draw(orbit = true) {
    this.t++;
    for (const a of this.actors) poseCharacter(a.m, a.id === this.speaker ? 'talk' : 'idle', this.t + a.m.position.z * 20);
    const ang = orbit ? Math.sin(this.t * 0.003) * 0.5 : 0;
    const cx = this.focusX != null ? this.focusX : this.actors.length ? this.actors.reduce((a, b) => a + b.m.position.x, 0) / this.actors.length : 0;
    this.cam.position.set(cx + Math.sin(ang) * 8.5, 2.6, Math.cos(ang) * 8.5);
    this.cam.lookAt(cx, 1.2, 0);
    R3.render(this.scene, this.cam);
  }
}

// Headshot portraits rendered from the 3D model (used when no photo is supplied).
const Portraits = {
  cache: {},
  get(id) {
    if (this.cache[id]) return this.cache[id];
    if (!R3.ok || !CAST[id]) return null;
    if (!this.r) {
      this.cv = mkCanvas(128, 128);
      this.r = new THREE.WebGLRenderer({ canvas: this.cv, antialias: false, preserveDrawingBuffer: true });
      this.r.setPixelRatio(1); this.r.setSize(128, 128, false);
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 0.75));
      const l = new THREE.DirectionalLight(0xfff0e0, 0.6); l.position.set(2, 3, 4); this.scene.add(l);
      this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    }
    const c = CAST[id], m = buildCharacter(c.look, id, null);
    poseCharacter(m, 'idle', 0); m.rotation.y = -0.35;
    this.scene.add(m);
    const bg = mkCanvas(2, 128), g = bg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    const dark = id.startsWith('villain'); gr.addColorStop(0, dark ? '#401020' : '#3060c0'); gr.addColorStop(1, dark ? '#100008' : '#0a1440');
    g.fillStyle = gr; g.fillRect(0, 0, 2, 128);
    this.scene.background = new THREE.CanvasTexture(bg);
    this.cam.position.set(-0.25, 2.0, 2.0); this.cam.lookAt(0, 1.82, 0);
    this.r.render(this.scene, this.cam);
    this.scene.remove(m);
    const out = mkCanvas(128, 128); out.getContext('2d').drawImage(this.cv, 0, 0);
    return (this.cache[id] = out);
  }
};
