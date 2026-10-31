// 3D layer: characters and monsters, battle/cutscene stages and 3D maps, drawn under the 2D UI canvas.
// HD look: full-resolution antialiased rendering, sRGB/ACES colour, soft shadows, sky-lit materials,
// procedural textures (js/gfx.js) and smooth, detailed models.
'use strict';

const R3 = {
  W: 960, H: 720, used: false, ok: false, shadows: true,
  init() {
    this.canvas = document.getElementById('gl');
    if (window.CONFIG && CONFIG.graphics === 'off') return;
    try {
      const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.88;
      this.shadows = (window.CONFIG && CONFIG.graphics) !== 'low';
      r.shadowMap.enabled = this.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.ok = true; this.resize();
      addEventListener('resize', () => this.resize());
    } catch (e) { console.warn('WebGL unavailable', e); }
  },
  // render at the real display resolution (capped), so the 3D is crisp at any window size
  resize() {
    if (!this.ok) return;
    const el = document.getElementById('screen'), cssW = (el && el.clientWidth) || 960;
    const coarse = matchMedia('(pointer: coarse)').matches, low = (window.CONFIG && CONFIG.graphics) === 'low';
    const dpr = Math.min(window.devicePixelRatio || 1, coarse || low ? 1.5 : 2);
    const w = Math.round(clamp(cssW * dpr, 640, low ? 960 : coarse ? 1280 : 1920)), h = Math.round(w * SH / SW);
    if (w !== this.W || h !== this.H || !this.sized) { this.W = w; this.H = h; this.sized = true; this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); }
  },
  beginFrame() { this.used = false; },
  endFrame() { if (this.canvas) this.canvas.style.visibility = this.used ? 'visible' : 'hidden'; },
  render(scene, camera) {
    if (!this.ok) return;
    if (G.shake > 0) { camera.position.x += rand(-0.08, 0.08); camera.position.y += rand(-0.05, 0.05); }
    (this.seen || (this.seen = new Map())).set(scene, G.frame);
    const ud = scene.userData; if (ud.tick) ud.tick(G.frame);
    if (ud.sky) ud.sky.position.copy(camera.position);
    this.renderer.render(scene, camera); this.used = true;
  },
  // free GPU memory of scenes that have not been drawn for a while (they re-upload if shown again)
  sweep() {
    if (!this.seen) return;
    const keepG = new Set([...Object.values(GFX.geos), ...Object.values(GEO)]), keepM = new Set(Object.values(GFX.mats));
    for (const [sc, f] of this.seen) {
      if (G.frame - f < 240) continue;
      sc.traverse(o => {
        if (o.geometry && !keepG.has(o.geometry)) o.geometry.dispose();
        if (o.material && !keepM.has(o.material)) { if (o.material.map && o.material.map.isTexture && !Object.values(GFX.tex).includes(o.material.map) && !Object.values(HeadTex).includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); }
      });
      this.seen.delete(sc);
    }
  },
  // world position -> 320x240 screen coordinates of the 2D layer
  project(v, camera) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * SW, (1 - p.y) / 2 * SH, p.z]; }
};

// ------------------------------------------------------------------ materials & shared geometry
let MAT_TEX = null; // default texture for mat() while building monsters
const hexOf = c => typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c;
function mat(color, o = {}) {
  const tex = o.tex !== undefined ? o.tex : MAT_TEX;
  return GFX.mat(hexOf(color), { tex: tex || undefined, rough: o.rough, metal: o.metal, emissive: o.emissive != null ? hexOf(o.emissive) : undefined, opacity: o.opacity, side: o.side });
}
function vmat() { return GFX.mat('#ffffff', { vc: true }); }
function flat(geo) { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; }
const GEO = {};
// soft-edged boxes, round spheres and many-sided cones/cylinders: smooth shading everywhere
const box = (w, h, d) => GFX.rbox(w, h, d, Math.min(w, h, d) * 0.22, 2);
const sbox = (w, h, d) => GEO['s' + w + h + d] || (GEO['s' + w + h + d] = new THREE.BoxGeometry(w, h, d));
const ico = (r, det = 1) => GFX.sphere(r, det ? 22 : 14, det ? 16 : 10);
const cone = (r, h, n = 6) => GEO['c' + r + h + n] || (GEO['c' + r + h + n] = new THREE.ConeGeometry(r, h, Math.max(14, n)));
const cyl = (r1, r2, h, n = 6) => GEO['y' + r1 + r2 + h + n] || (GEO['y' + r1 + r2 + h + n] = new THREE.CylinderGeometry(r1, r2, h, Math.max(16, n)));
function add(parent, geo, color, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' || typeof color === 'number' ? mat(color, o) : color);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  if (o.s) m.scale.set(...(Array.isArray(o.s) ? o.s : [o.s, o.s, o.s]));
  m.castShadow = !o.opacity; m.receiveShadow = true;
  parent.add(m); return m;
}
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
function castShadows(obj) { obj.traverse(o => { if (o.isMesh && !(o.material && o.material.transparent && !o.material.alphaTest)) o.castShadow = true; }); return obj; }

// ------------------------------------------------------------------ heads & faces
// The head is a sphere; its texture is skin with the actor's photo blended onto the front
// (u = 0.25 faces +z on a SphereGeometry), or painted eyes when there is no photo.
const HeadTex = {};
function headTexture(look, castId) {
  const usePhoto = window.CONFIG && CONFIG.photoFaces;
  const photo = usePhoto && castId && CAST[castId] && Img.get(CAST[castId].portrait);
  const key = (photo ? castId : '') + JSON.stringify(look);
  if (HeadTex[key]) return HeadTex[key];
  const W = 512, H = 256, c = mkCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = look.skin; g.fillRect(0, 0, W, H);
  const fx = W * 0.25, fy = H * 0.52;
  if (photo) { // optional: blend a sharp, front-facing actor photo onto the face
    const t = mkCanvas(160, 160), tg = t.getContext('2d'), s = Math.min(photo.naturalWidth, photo.naturalHeight) * 0.9;
    tg.drawImage(photo, (photo.naturalWidth - s) / 2, (photo.naturalHeight - s) / 2, s, s, 0, 0, 160, 160);
    tg.globalCompositeOperation = 'destination-in';
    const m = tg.createRadialGradient(80, 84, 30, 80, 84, 80); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,0.9)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    tg.fillStyle = m; tg.fillRect(0, 0, 160, 160);
    g.drawImage(t, fx - 70, fy - 72, 140, 140);
  } else paintFace(g, look, fx, fy);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  return (HeadTex[key] = tex);
}
// A painted, FF-style face: shaded sockets, irises, lids, brows, nose and lips in the character's colours.
function paintFace(g, look, fx, fy) {
  const skin = look.skin, female = !!look.dress || look.female, eye = look.eyes && look.eyes !== '#000000' ? look.eyes : '#3a2a20';
  const rg = (x, y, r0, r1, c0, c1) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(x - r1, y - r1, r1 * 2, r1 * 2); };
  // jaw/chin shading and cheeks
  rg(fx, fy + 52, 4, 46, 'rgba(70,30,20,0.18)', 'rgba(70,30,20,0)');
  for (const s of [-1, 1]) { rg(fx + s * 23, fy - 3, 3, 19, 'rgba(70,35,30,0.28)', 'rgba(70,35,30,0)'); rg(fx + s * 28, fy + 18, 2, 16, female ? 'rgba(230,90,90,0.22)' : 'rgba(200,90,70,0.1)', 'rgba(200,90,70,0)'); }
  if (look.stubble) { // five o'clock shadow around the jaw and upper lip
    g.save(); g.beginPath(); g.ellipse(fx, fy + 30, 40, 30, 0, 0, Math.PI); g.rect(fx - 14, fy + 22, 28, 6); g.clip();
    rg(fx, fy + 34, 6, 42, 'rgba(40,30,25,0.28)', 'rgba(40,30,25,0.06)'); g.fillStyle = 'rgba(30,20,15,0.22)';
    for (let i = 0; i < 2500; i++) g.fillRect(fx - 42 + Math.random() * 84, fy + 18 + Math.random() * 44, 1, 1);
    g.restore(); }
  if (!female) { for (const s of [-1, 1]) { rg(fx + s * 34, fy + 12, 2, 14, 'rgba(60,30,20,0.2)', 'rgba(60,30,20,0)'); g.strokeStyle = 'rgba(80,40,30,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx + s * 9, fy + 16); g.quadraticCurveTo(fx + s * 15, fy + 26, fx + s * 13, fy + 34); g.stroke(); } }
  // eyes
  for (const s of [-1, 1]) {
    const x = fx + s * 22, y = fy - 3;
    const ew = female ? 10.5 : 9.5, eh = female ? 5.6 : 4.4;
    g.fillStyle = '#f2ece4'; g.beginPath(); g.ellipse(x, y, ew, eh, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(x, y, ew, eh, 0, 0, 7); g.clip();
    g.fillStyle = shade(eye, -0.35); g.beginPath(); g.arc(x - s * 0.5, y + 0.3, 5.4, 0, 7); g.fill();
    g.fillStyle = eye; g.beginPath(); g.arc(x - s * 0.5, y + 0.6, 4.3, 0, 7); g.fill();
    g.fillStyle = '#0a0808'; g.beginPath(); g.arc(x - s * 0.5, y + 0.4, 2.1, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 12, y - 6, 24, 2.5);
    g.restore();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - s * 0.5 + 1.6, y - 1.4, 1.3, 0, 7); g.fill();
    g.strokeStyle = '#1a1010'; g.lineWidth = female ? 2.6 : 2.4; g.beginPath(); g.ellipse(x, y + 0.5, ew + 0.5, eh + 0.8, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.strokeStyle = 'rgba(80,40,30,0.35)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - 0.5, 10.5, 6, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
    g.strokeStyle = shade(skin, -0.25); g.beginPath(); g.ellipse(x, y - 2.5, 11.5, 7, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    if (female) for (let k = 0; k < 4; k++) { const a = Math.PI * (1.6 + s * 0.08 + k * 0.08 * s); g.beginPath(); g.moveTo(x + Math.cos(a) * 11, y + 0.5 + Math.sin(a) * 6.2); g.lineTo(x + Math.cos(a) * 14, y - 1 + Math.sin(a) * 8); g.stroke(); }
    // brow
    g.strokeStyle = shade(look.hair === '#e8dce4' ? '#a09098' : look.hair, -0.15); g.lineWidth = female ? 2.4 : 4; g.lineCap = 'round';
    if (female) { g.beginPath(); g.moveTo(x - s * 11, y - 11); g.quadraticCurveTo(x, y - 16, x + s * 12, y - 10); g.stroke(); }
    else { g.lineWidth = 4.5; g.beginPath(); g.moveTo(x - s * 11, y - 6); g.quadraticCurveTo(x, y - 11, x + s * 13, y - 11); g.stroke(); }
  }
  // nose
  const ng = g.createLinearGradient(fx - 7, 0, fx + 7, 0); ng.addColorStop(0, 'rgba(90,45,35,0.28)'); ng.addColorStop(0.5, 'rgba(255,240,230,0.12)'); ng.addColorStop(1, 'rgba(90,45,35,0.18)');
  g.fillStyle = ng; g.beginPath(); g.moveTo(fx - 3, fy - 6); g.quadraticCurveTo(fx - 7, fy + 12, fx - 7, fy + 18); g.lineTo(fx + 7, fy + 18); g.quadraticCurveTo(fx + 7, fy + 12, fx + 3, fy - 6); g.fill();
  g.fillStyle = 'rgba(60,20,20,0.5)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(fx + s * 3.6, fy + 18.5, 2.2, 1.3, 0, 0, 7); g.fill(); }
  // lips
  const lip = female ? '#b0383c' : shade(mixHex(skin, '#a04a40', 0.45), -0.05), mY = fy + 31;
  g.fillStyle = shade(lip, -0.1); g.beginPath(); g.moveTo(fx - 11, mY); g.quadraticCurveTo(fx - 4, mY - 4.5, fx, mY - 2.5); g.quadraticCurveTo(fx + 4, mY - 4.5, fx + 11, mY); g.closePath(); g.fill();
  g.fillStyle = shade(lip, 0.12); g.beginPath(); g.moveTo(fx - 10, mY); g.quadraticCurveTo(fx, mY + 6, fx + 10, mY); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,10,10,0.6)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(fx - 11, mY); g.quadraticCurveTo(fx, mY + 1.2, fx + 11, mY); g.stroke();
}

// Hair shell: part of a sphere with lumpy volume and jagged locks along its lower edge.
function hairGeo(r, ps, pl, ts, tl, jag, v) {
  const key = ['hair', r, ps, pl, ts, tl, jag, v].join();
  if (GFX.geos[key]) return GFX.geos[key];
  const g = new THREE.SphereGeometry(r, 48, 14, Math.PI * ps, Math.PI * pl, Math.PI * ts, Math.PI * tl), p = g.attributes.position, V = new THREE.Vector3();
  const t0 = Math.PI * ts, t1 = Math.PI * (ts + tl);
  for (let i = 0; i < p.count; i++) {
    V.fromBufferAttribute(p, i);
    const th = Math.acos(clamp(V.y / r, -1, 1)), ph = Math.atan2(V.z, -V.x), edge = smooth(t0 + (t1 - t0) * 0.55, t1, th);
    const lump = 1 + noise3(V.x / r * 3, V.y / r * 3, V.z / r * 3, v) * 0.035 + edge * 0.03;
    const lock = jag * edge * Math.pow(0.5 + 0.5 * Math.sin(ph * 11 + v * 2), 2);
    p.setXYZ(i, V.x * lump * (1 + lock * 0.08), V.y * lump - lock * r * 0.32, V.z * lump * (1 + lock * 0.08));
  }
  g.computeVertexNormals();
  return (GFX.geos[key] = g);
}

// ------------------------------------------------------------------ characters
// Realistic-ish proportions (about 7 heads tall, like late-90s battle models). Faces +z, feet at y=0.
// Pivots in userData.P: hips > torso > head / arms[sh > el > hand], hips > legs[hip > kn].
// Body shells: a lathe-like surface where each row can have its own opening (V-necks, open vests),
// with a deformation hook for muscles, quilting and torn hems. prof: [[y, r], ...] with y increasing.
function shellGeo(key, prof, o = {}) {
  key = 'shell' + key;
  if (GFX.geos[key]) return GFX.geos[key];
  const rows = o.rows || 30, seg = o.seg || 40, k = o.k || 1;
  const y0 = o.y0 != null ? o.y0 : prof[0][0], y1 = o.y1 != null ? o.y1 : prof[prof.length - 1][0];
  const R = y => { // smooth interpolation through the profile
    if (y <= prof[0][0]) return prof[0][1];
    for (let i = 1; i < prof.length; i++) if (y <= prof[i][0]) { const [ya, ra] = prof[i - 1], [yb, rb] = prof[i], t = (y - ya) / (yb - ya), s = t * t * (3 - 2 * t); return ra + (rb - ra) * s; }
    return prof[prof.length - 1][1];
  };
  const pos = [], uv = [], idx = [], closedRow = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (y1 - y0) * i / rows, gap = o.gap ? o.gap(y) : 0, rng = o.range ? o.range(y) : null;
    const p0 = rng ? rng[0] : o.gap ? gap : Math.PI, p1 = rng ? rng[1] : o.gap ? Math.PI * 2 - gap : Math.PI * 3;
    closedRow.push(!rng && gap <= 0);
    for (let j = 0; j <= seg; j++) {
      const phi = p0 + (p1 - p0) * j / seg, r = R(y) * k + (o.def ? o.def(y, phi, j / seg, i / rows) : 0);
      let yy = y + (o.dy ? o.dy(y, phi, j / seg, i / rows) : 0);
      pos.push(r * Math.sin(phi), yy, r * Math.cos(phi)); uv.push(j / seg * (o.uRep || 1), (y - y0) / (y1 - y0) * (o.vRep || 1));
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal; // weld the seam normals of closed rows
  for (let i = 0; i <= rows; i++) if (closedRow[i]) { const a = i * (seg + 1), b = a + seg; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
  return (GFX.geos[key] = g);
}
const gauss = (x, w) => Math.exp(-(x / w) * (x / w));
// heroic torso profile (waist at y=0, neck at 0.71); female profile is slimmer with a narrower waist
const TORSO_M = [[-0.02, 0.16], [0.06, 0.166], [0.16, 0.172], [0.26, 0.188], [0.36, 0.214], [0.44, 0.24], [0.52, 0.255], [0.58, 0.252], [0.63, 0.215], [0.67, 0.15], [0.7, 0.075], [0.715, 0.0]];
const TORSO_F = [[-0.02, 0.16], [0.06, 0.145], [0.16, 0.14], [0.26, 0.155], [0.36, 0.185], [0.44, 0.2], [0.52, 0.2], [0.58, 0.195], [0.63, 0.17], [0.67, 0.12], [0.7, 0.06], [0.715, 0.0]];
function muscleDef(m, female) {
  return (y, phi) => {
    const front = Math.max(0, Math.cos(phi)), side = Math.abs(Math.sin(phi)), back = Math.max(0, -Math.cos(phi));
    if (female) return 0.03 * gauss(y - 0.47, 0.07) * Math.pow(front, 2) * (1 - 0.7 * gauss(Math.sin(phi), 0.14)) * m;
    const pec = 0.03 * gauss(y - 0.5, 0.075) * Math.pow(front, 1.2) * (1 - 0.65 * gauss(Math.sin(phi), 0.11));
    const abs = 0.007 * gauss(y - 0.24, 0.13) * Math.pow(front, 2) * (0.5 + 0.5 * Math.cos(y * 78)) * (1 - 0.6 * gauss(Math.sin(phi), 0.05));
    const lats = 0.02 * gauss(y - 0.42, 0.1) * side, blades = 0.012 * gauss(y - 0.52, 0.08) * back;
    return (pec + abs + lats + blades) * m;
  };
}
// limb profiles ([y, r], y increasing, top of the limb at y=0)
const LIMB = {
  upper: [[-0.335, 0.05], [-0.3, 0.06], [-0.2, 0.082], [-0.12, 0.09], [-0.05, 0.088], [0.0, 0.075], [0.035, 0.0]],
  fore: [[-0.31, 0.04], [-0.27, 0.045], [-0.18, 0.06], [-0.08, 0.072], [-0.02, 0.064], [0.025, 0.0]],
  thigh: [[-0.49, 0.068], [-0.43, 0.075], [-0.3, 0.095], [-0.15, 0.105], [-0.04, 0.104], [0.03, 0.0]],
  shin: [[-0.46, 0.045], [-0.4, 0.05], [-0.3, 0.068], [-0.17, 0.08], [-0.06, 0.07], [0.02, 0.0]],
  baggyThigh: [[-0.49, 0.118], [-0.3, 0.13], [-0.1, 0.135], [0.02, 0.12], [0.05, 0.0]],
  baggyShin: [[-0.43, 0.13], [-0.3, 0.125], [-0.12, 0.118], [0.02, 0.11], [0.04, 0.0]]
};
const limbG = (name, k = 1, def, zs) => shellGeo(name + k + (def ? 'd' : ''), LIMB[name].map(([y, r]) => [y, r * k]), { rows: 18, seg: 18, def });
// bicep/calf bulge toward the front or back of a limb
const bulge = (y0, w, amt, dir = 1) => (y, phi) => amt * gauss(y - y0, w) * Math.max(0, Math.cos(phi) * dir);
const tornHem = (yHem, depth) => (y, phi, u) => 0; // (kept for symmetry: torn edges are made with dy below)
const jagDy = (yEdge, band, depth, teeth, seed = 0) => (y, phi) => { const e = gauss(y - yEdge, band); return -e * depth * Math.pow(0.5 + 0.5 * Math.sin(phi * teeth + seed), 3); };

function buildCharacter(look, castId, job) {
  const root = new THREE.Group(), P = {};
  const female = !!(look.dress || look.female), bulk = look.bulk || (female ? 0.9 : 1.08), R = 0.2;
  const hood = look.hairStyle === 'hood';
  const hairC = hood ? look.outfit2 : look.hair, out = look.outfit, out2 = look.outfit2 || shade(out, -0.3);
  const acc = look.accent || '#e0c050', skin = look.skin, dress = look.dress;
  const pantsC = dress ? skin : (look.pants || '#333344'), bootsC = look.boots || out2, barefoot = bootsC === skin;
  const tee = !!look.sleeve && !look.sleeveless;
  const over = look.gi ? 'gi' : look.vest ? 'vest' : look.tank ? 'tank' : (look.jacket || look.coat) ? 'jacket' : null;
  const bareArms = !!look.sleeveless || tee || over === 'vest';
  const bodyC = over === 'gi' || over === 'tank' ? skin : over === 'vest' ? (look.shirt || '#f2f2ee') : over === 'jacket' ? (look.shirt || out2) : tee ? look.sleeve : out;
  const cloth = (c, o = {}) => GFX.mat(c, { tex: 'fabric', rough: 0.85, ...o });
  const bluish = h => { const k = new THREE.Color(h); return k.b > k.r + 0.05 && k.b > 0.25; };
  const skinM = GFX.mat(skin, { tex: 'skin', rough: 0.5 }), hairM = GFX.mat(hairC, { tex: 'hair', rough: 0.45 });
  const pantsM = dress ? skinM : bluish(pantsC) ? GFX.mat(pantsC, { tex: 'denim', rough: 0.9 }) : cloth(pantsC);
  const bootM = barefoot ? skinM : GFX.mat(bootsC, { tex: 'leather', rough: 0.45 });
  const bodyM = bodyC === skin ? skinM : cloth(bodyC);
  const part = (parent, geo, m, x = 0, y = 0, z = 0, s = 1, rot) => { const o = mesh(geo, m, x, y, z, s, parent); if (rot) o.rotation.set(rot[0], rot[1] || 0, rot[2] || 0); return o; };
  const TP = female ? TORSO_F : TORSO_M, tS = [bulk, 1, 0.66], mus = muscleDef(bodyC === skin ? 1 : 0.55, female);
  // a point on the torso surface (for pockets, buckles, straps)
  const surf = (y, phi, k = 1, lift = 0) => { let r = TP[0][1]; for (let i = 1; i < TP.length; i++) if (y <= TP[i][0]) { const [ya, ra] = TP[i - 1], [yb, rb] = TP[i]; r = ra + (rb - ra) * (y - ya) / (yb - ya); break; } r = r * k + mus(y, phi) + lift; return [r * Math.sin(phi) * tS[0], y, r * Math.cos(phi) * tS[2]]; };

  const hipY = 1.05; P.hipY = hipY;
  P.hips = pivot(root, 0, hipY, 0);
  part(P.hips, GFX.sphere(0.2, 20, 14), pantsM, 0, -0.03, 0, [(female ? 1.08 : 0.98) * bulk, 0.64, 0.74]);
  P.torso = pivot(P.hips, 0, 0, 0);
  part(P.torso, shellGeo((female ? 'F' : 'M') + (bodyC === skin ? 's' : 'c'), TP, { def: mus, rows: 36, seg: 44 }), bodyM, 0, 0, 0, tS);
  // traps and neck
  part(P.torso, GFX.sphere(0.12, 18, 12), bodyC === skin || over === 'vest' || over === 'tank' ? (over === 'vest' ? bodyM : skinM) : bodyM, 0, 0.64, -0.02, [1.25 * bulk, 0.5, 0.8]);
  part(P.torso, shellGeo('neck', [[0.6, 0.075], [0.72, 0.068], [0.84, 0.064], [0.86, 0]], { rows: 6, seg: 16 }), skinM, 0, 0, 0, [bulk * 0.95, 1, 0.95]);
  const dbl = { side: THREE.DoubleSide };
  if (over === 'vest') { // quilted, open puffer vest with a popped collar, white zip edges and chest pockets
    const vm = GFX.mat(out, { tex: 'quilt', rough: 0.55, side: THREE.DoubleSide }), white = cloth('#f0f0ec');
    const gap = y => 0.36 + Math.max(0, y - 0.5) * 1.6;
    part(P.torso, shellGeo('vest' + female, TP, { k: 1.1, y0: -0.04, y1: 0.66, gap, def: (y, p) => mus(y, p) * 0.6 + 0.007 * Math.abs(Math.sin(y * Math.PI * 11)), rows: 40, seg: 44 }), vm, 0, 0, 0, tS);
    for (const s of [-1, 1]) part(P.torso, shellGeo('zip' + s, TP, { k: 1.13, y0: -0.04, y1: 0.62, range: y => s > 0 ? [gap(y), gap(y) + 0.05] : [Math.PI * 2 - gap(y) - 0.05, Math.PI * 2 - gap(y)], rows: 20, seg: 2 }), white, 0, 0, 0, tS);
    part(P.torso, shellGeo('collar', [[0.6, 0.2], [0.68, 0.155], [0.76, 0.16], [0.8, 0.175]], { range: () => [0.55, Math.PI * 2 - 0.55], rows: 8, seg: 30 }), vm, 0, 0, -0.01, [bulk * 1.05, 1, 0.85]);
    for (const s of [-1, 1]) { const [x, y, z] = surf(0.42, s * 0.75, 1.1, 0.01); const pk = part(P.torso, GFX.rbox(0.11, 0.012, 0.012, 0.005), white, x, y, z, 1); pk.rotation.y = s * 0.75; }
    part(P.torso, shellGeo('vhem', TP, { k: 1.12, y0: -0.05, y1: -0.0, gap: () => 0.4, rows: 2, seg: 30 }), GFX.mat(shade(out, -0.3), { rough: 0.6, side: THREE.DoubleSide }), 0, 0, 0, tS);
  } else if (over === 'gi') { // crossover karate top: V opening, lapels, flared skirt below the belt
    const gm = cloth(out, dbl), lap = cloth(shade(out, -0.06), dbl);
    const gap = y => y > 0.24 ? 0.62 * (y - 0.24) / 0.46 : 0;
    part(P.torso, shellGeo('gi', TP, { k: 1.06, y0: -0.02, y1: 0.69, gap, def: (y, p) => mus(y, p) * 0.7, rows: 36, seg: 44 }), gm, 0, 0, 0, tS);
    for (const s of [-1, 1]) part(P.torso, shellGeo('lapel' + s, TP, { k: 1.09, y0: 0.2, y1: 0.69, range: y => s > 0 ? [gap(y), gap(y) + 0.13] : [Math.PI * 2 - gap(y) - 0.13, Math.PI * 2 - gap(y)], def: (y, p) => mus(y, p) * 0.7, rows: 20, seg: 3 }), lap, 0, 0, 0, tS);
    part(P.torso, shellGeo('giskirt', [[-0.24, 0.215], [-0.1, 0.19], [0.02, 0.172]], { rows: 6, seg: 36, dy: jagDy(-0.24, 0.02, 0.03, 9, 1) }), gm, 0, 0, 0, [bulk * 1.06, 1, 0.74]);
  } else if (over === 'tank') {
    const gap = y => y > 0.48 ? Math.min(0.75, (y - 0.48) * 4) : 0;
    part(P.torso, shellGeo('tank' + female, TP, { k: 1.03, y0: -0.03, y1: 0.66, gap, def: mus, rows: 36, seg: 44 }), cloth(out, dbl), 0, 0, 0, tS);
    part(P.torso, shellGeo('tankback', TP, { k: 1.035, y0: 0.5, y1: 0.66, range: () => [Math.PI - 0.6, Math.PI + 0.6], def: mus, rows: 6, seg: 12 }), cloth(out, dbl), 0, 0, 0, tS);
  } else if (over === 'jacket') {
    const jm = cloth(out, { ...dbl, tex: look.coat ? 'leather' : 'fabric', rough: look.coat ? 0.5 : 0.85 });
    const gap = y => 0.22 + Math.max(0, y - 0.4) * 1.0;
    part(P.torso, shellGeo('jacket' + female, TP, { k: 1.08, y0: -0.06, y1: 0.66, gap, def: (y, p) => mus(y, p) * 0.5, rows: 30, seg: 44 }), jm, 0, 0, 0, tS);
    part(P.torso, shellGeo('jcollar', [[0.6, 0.19], [0.68, 0.15], [0.74, 0.16]], { range: () => [0.5, Math.PI * 2 - 0.5], rows: 6, seg: 30 }), jm, 0, 0, -0.01, [bulk * 1.05, 1, 0.85]);
    if (look.coat) {
      part(P.torso, GFX.lathe('coat', [[0.21, 0.02], [0.23, -0.1], [0.27, -0.35], [0.31, -0.62], [0.35, -0.92]].map(([r, y]) => [r, y]).reverse().map(([r, y]) => [r, y]), 28, 0.42, Math.PI * 2 - 0.84), jm, 0, 0, 0, [bulk, 1, 0.8]);
      for (const s of [-1, 1]) part(P.torso, GFX.sphere(0.13, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), GFX.mat('#5a5c64', { metal: 0.85, rough: 0.3, tex: 'metal' }), s * 0.28 * bulk, 0.6, 0, [1.2, 0.8, 1.1], [0, 0, -s * 0.3]);
      part(P.torso, GFX.rbox(0.05, 0.62, 0.015, 0.006), GFX.mat('#2a2a2e', { tex: 'leather', rough: 0.5 }), 0, 0.33, 0.17, 1, [0, 0, 0.55]);
    }
  }
  // belt
  part(P.torso, shellGeo('belt' + female, TP, { k: 1.11, y0: -0.02, y1: 0.06, rows: 2, seg: 36 }), GFX.mat(acc, { tex: 'leather', rough: 0.45 }), 0, 0, 0, [bulk, 1, 0.67]);
  if (over === 'gi') { // knot and hanging tails
    const bm = cloth(acc); const [x, y, z] = surf(0.02, 0, 1.13);
    part(P.torso, GFX.sphere(0.04, 12, 8), bm, x, y + 0.02, z + 0.01, [1.2, 0.9, 0.7]);
    for (const s of [-1, 1]) part(P.torso, GFX.rbox(0.045, 0.32, 0.014, 0.006), bm, x + s * 0.035, y - 0.15, z + 0.02, 1, [0.05, 0, s * 0.12]);
  } else if (!dress) { const [x, y, z] = surf(0.02, 0, 1.13); part(P.torso, GFX.rbox(0.07, 0.055, 0.015, 0.006), GFX.mat('#c8a848', { metal: 0.9, rough: 0.3 }), x, y + 0.01, z + 0.005); }
  if (look.chain) part(P.torso, new THREE.TorusGeometry(0.15, 0.006, 6, 32), GFX.mat('#d0d4dc', { metal: 0.9, rough: 0.25 }), 0, 0.6, 0.07, [bulk * 0.9, 1, 1], [1.2]);
  if (dress) {
    part(P.torso, shellGeo('bodice', TP, { k: 1.04, y0: -0.02, y1: 0.6, gap: y => y > 0.52 ? (y - 0.52) * 5 : 0, def: mus }), cloth(dress, dbl), 0, 0, 0, tS);
    part(P.hips, GFX.lathe('dress', [[0.19, 0.08], [0.2, 0], [0.26, -0.22], [0.33, -0.45], [0.38, -0.58]].reverse().map(([r, y]) => [r, y]).reverse(), 28), cloth(dress, dbl), 0, 0, 0, [bulk, 1, 0.8]);
  }

  // ---- head
  P.head = pivot(P.torso, 0, 0.74, 0);
  const HY = 0.2, hs = [0.88, 1.08, 0.98];
  const headM = new THREE.MeshStandardMaterial({ map: headTexture(look, castId), roughness: 0.5 });
  part(P.head, GFX.sphere(R, 36, 24), headM, 0, HY, 0, hs);
  part(P.head, GFX.sphere(R * 0.62, 20, 14), skinM, 0, HY - R * 0.6, R * 0.32, [female ? 0.8 : 1.0, 0.62, 0.95]); // jaw
  for (const s of [-1, 1]) part(P.head, GFX.sphere(0.042, 10, 8), skinM, s * R * 0.86, HY - 0.01, -0.01, [0.45, 1, 0.75]);
  part(P.head, GFX.sphere(0.028, 12, 10), skinM, 0, HY - 0.035, R * 0.94, [0.75, 1.3, 1.1]);
  const style = look.hairStyle || 'short', jag = style === 'buzz' || style === 'flattop' ? 0 : style === 'spiky' ? 1 : style === 'long' ? 0.25 : 0.6;
  const capG = (k, tl) => hairGeo(R * k, 0, 2, 0, tl, jag, 1);
  const backG = k => hairGeo(R * k, 0.95, 1.1, 0.25, 0.42, jag, 2);
  if (style === 'buzz' || style === 'flattop') {
    part(P.head, capG(1.035, 0.5), hairM, 0, HY, 0, hs, [-0.22]); part(P.head, backG(1.03), hairM, 0, HY, 0, hs);
    if (style === 'flattop') { part(P.head, GFX.rbox(0.33, 0.12, 0.32, 0.04), hairM, 0, HY + R * 0.9, -0.01, [hs[0] * 1.02, 1, hs[2]]); }
  } else if (style !== 'hood') {
    part(P.head, capG(1.07, 0.5), hairM, 0, HY + 0.005, -0.01, hs, [-0.17]);
    part(P.head, backG(1.05), hairM, 0, HY, 0, hs);
  }
  if (style === 'spiky') {
    [[0, 0.2, -0.02, -0.4, 0], [0.11, 0.17, -0.05, -0.6, -0.6], [-0.11, 0.17, -0.05, -0.6, 0.6], [0.16, 0.08, -0.08, -1.1, -1.1],
      [-0.16, 0.08, -0.08, -1.1, 1.1], [0, 0.1, -0.17, -1.6, 0], [0.07, 0.2, 0.08, 0.5, -0.4], [-0.07, 0.2, 0.08, 0.55, 0.45], [0.03, 0.22, 0.03, 0.2, -0.1]]
      .forEach(([x, y, z, rx, rz]) => part(P.head, cone(0.055, 0.2, 10), hairM, x, HY + y, z, 1, [rx, 0, rz]));
  } else if (style === 'long') {
    const len = look.hairLen || (dress ? 0.62 : 0.9), lm = GFX.mat(hairC, { tex: 'hair', rough: 0.45, side: THREE.DoubleSide });
    part(P.head, shellGeo('longhair' + len, [[-len, 0.27], [-len * 0.5, 0.25], [0, 0.205], [0.06, 0.2]], { range: () => [Math.PI * 0.5, Math.PI * 1.5], rows: 14, seg: 24, dy: jagDy(-len, 0.04, 0.05, 13) }), lm, 0, HY, -0.02, [1, 1, 0.9]);
    for (const s of [-1, 1]) part(P.head, GFX.rbox(0.05, len * 0.55, 0.05, 0.02), lm, s * R * 0.82, HY - len * 0.22, R * 0.38, 1, [0.05, 0, s * 0.08]);
  } else if (hood) {
    const hm = cloth(hairC, dbl);
    part(P.head, GFX.sphere(R * 1.3, 28, 18, Math.PI * 0.82, Math.PI * 1.36), hm, 0, HY + 0.02, -0.02, [1, 1.08, 1.05]);
    part(P.head, cone(0.12, 0.3, 14), hm, 0, HY + 0.08, -0.27, 1, [-2.1]);
  }
  if (look.cap) { // baseball cap: crown, light front panel with an emblem, curved brim, button
    const cm = cloth(look.cap), brimC = look.capBrim || look.cap;
    part(P.head, GFX.sphere(R * 1.1, 36, 12, 0, Math.PI * 2, 0, Math.PI * 0.43), cm, 0, HY + 0.02, 0, hs, [-0.12]);
    if (look.capPanel) part(P.head, GFX.sphere(R * 1.115, 16, 8, Math.PI * 0.32, Math.PI * 0.36, Math.PI * 0.12, Math.PI * 0.28), new THREE.MeshStandardMaterial({ map: capPanelTex(look.capPanel, look.capLogo || '#c02020'), roughness: 0.8 }), 0, HY + 0.02, 0, hs, [-0.12]);
    const brim = new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.016, 32, 1, false, -Math.PI / 2, Math.PI);
    part(P.head, brim, cloth(brimC), 0, HY + R * 0.4, R * 0.55, [1, 1, 1.35], [0.14]);
    part(P.head, GFX.sphere(0.02, 8, 6), cm, 0, HY + R * 1.13, -0.02);
  }
  if (look.headband) {
    const bm = cloth(look.headband, dbl);
    part(P.head, new THREE.CylinderGeometry(R * 1.0, R * 1.0, 0.055, 36, 1, true), bm, 0, HY + 0.075, -0.005, [hs[0] * 1.07, 1, hs[2] * 1.07], [-0.15]);
    part(P.head, GFX.sphere(0.035, 10, 8), bm, 0, HY + 0.06, -R * 1.02, [1.2, 0.8, 0.6]);
    for (const s of [-1, 1]) part(P.head, GFX.rbox(0.05, look.bandTails || 0.3, 0.012, 0.005), bm, s * 0.04, HY - (look.bandTails || 0.3) * 0.45, -R * 1.04, 1, [0.25, 0, s * 0.25]);
  }
  if (look.glasses) {
    const gm = GFX.mat('#0a0a10', { rough: 0.08, metal: 0.6 });
    for (const s of [-1, 1]) { part(P.head, GFX.sphere(0.056, 14, 10), gm, s * 0.072, HY + 0.01, R * 0.9, [1, 0.72, 0.32]); part(P.head, GFX.rbox(0.012, 0.012, 0.2, 0.005), gm, s * R * 0.86, HY + 0.02, R * 0.4); }
    part(P.head, GFX.rbox(0.05, 0.012, 0.012, 0.005), gm, 0, HY + 0.025, R * 0.96);
  }
  if (look.beard) part(P.head, GFX.sphere(R * 0.66, 20, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), GFX.mat(look.beard, { tex: 'hair' }), 0, HY - R * 0.55, R * 0.36, [1.0, 0.7, 0.95]);

  // ---- arms: muscle-shaped upper arm and forearm, deltoid, fists
  P.arms = [];
  const ak = bulk * (female ? 0.82 : 1), upperM = bareArms ? skinM : cloth(over === 'jacket' ? out : bodyC, look.coat ? { tex: 'leather', rough: 0.5 } : {});
  const gloveC = look.gloves || (job === 'brawler' ? '#1a1a1a' : null);
  [-1, 1].forEach((s, i) => {
    const sh = pivot(P.torso, s * (0.255 * bulk + 0.035), 0.565, 0);
    part(sh, GFX.sphere(0.1 * ak, 18, 12), upperM, s * -0.012, 0.0, 0, [1, 1.0, 1.0]);
    part(sh, limbG('upper', ak, female ? null : bulge(-0.13, 0.07, 0.018)), upperM, 0, 0, 0, [1, 1, 1.05]);
    if (tee || (over === 'vest' && look.sleeve)) part(sh, shellGeo('sleeve' + ak + !!look.tornSleeve, [[-0.13, 0.098 * ak], [0, 0.11 * ak], [0.05, 0.1 * ak], [0.08, 0]], { rows: 6, seg: 20, dy: look.tornSleeve ? jagDy(-0.13, 0.02, 0.025, 8, 2) : null }), cloth(look.sleeve, dbl), 0, 0, 0);
    if (look.shoulderPad && i === 1) {
      const pm = GFX.mat(look.shoulderPad, { tex: 'leather', rough: 0.45 });
      part(sh, GFX.sphere(0.14 * ak, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), pm, 0.01, 0.0, 0, [1.05, 0.9, 1.1], [0, 0, -0.35]);
      for (let k = 0; k < 6; k++) part(sh, cone(0.025, 0.09, 10), GFX.mat('#b8bcc4', { metal: 0.9, rough: 0.3 }), 0.06 + Math.cos(k * 0.5 - 1.2) * 0.04, 0.09 + Math.sin(k * 0.5) * 0.02, -0.12 + k * 0.05, 1, [0, 0, -0.9]);
    }
    const el = pivot(sh, 0, -0.32, 0);
    const hand = pivot(el, 0, -0.3, 0);
    if (i === 0 && look.gunArm) { // Gatling arm: housing, rings and a cluster of barrels
      const met = GFX.mat('#a8aeb8', { metal: 0.85, rough: 0.28, tex: 'metal' }), dark = GFX.mat('#3c3e44', { metal: 0.85, rough: 0.35 });
      part(el, new THREE.CylinderGeometry(0.13 * ak, 0.115 * ak, 0.34, 24), met, 0, -0.15, 0);
      for (const y of [-0.02, -0.15, -0.3]) part(el, new THREE.CylinderGeometry(0.14 * ak, 0.14 * ak, 0.035, 24), dark, 0, y, 0);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; part(el, GFX.sphere(0.012, 6, 4), met, Math.cos(a) * 0.14 * ak, -0.15, Math.sin(a) * 0.14 * ak); }
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; part(el, new THREE.CylinderGeometry(0.022, 0.022, 0.32, 12), met, Math.cos(a) * 0.065 * ak, -0.46, Math.sin(a) * 0.065 * ak); }
      part(el, new THREE.CylinderGeometry(0.11 * ak, 0.11 * ak, 0.03, 24), dark, 0, -0.6, 0);
      part(el, new THREE.CylinderGeometry(0.03, 0.03, 0.34, 12), dark, 0, -0.45, 0);
      part(sh, shellGeo('strap' + ak, [[-0.26, 0.098 * ak], [-0.2, 0.1 * ak]], { rows: 1, seg: 20 }), GFX.mat('#3a2a1a', { tex: 'leather' }), 0, 0, 0);
    } else {
      part(el, limbG('fore', ak, female ? null : bulge(-0.08, 0.06, 0.012)), bareArms || over === 'gi' || over === 'tank' ? skinM : upperM, 0, 0, 0);
      buildFist(hand, s, skinM, gloveC ? GFX.mat(gloveC, { tex: 'leather', rough: 0.4 }) : null, ak);
    }
    if (look.wraps) part(el, shellGeo('wrap' + ak, [[-0.3, 0.05 * ak], [-0.2, 0.06 * ak], [-0.16, 0.062 * ak]], { rows: 4, seg: 18, def: (y) => 0.004 * Math.abs(Math.sin(y * 120)) }), cloth(look.wraps), 0, 0, 0);
    if (look.wristband && i === 1) part(el, shellGeo('wband' + ak, [[-0.29, 0.052 * ak], [-0.2, 0.06 * ak]], { rows: 2, seg: 18 }), GFX.mat('#1a1a1a', { tex: 'leather' }), 0, 0, 0);
    if (gloveC && !(i === 0 && look.gunArm)) part(el, shellGeo('cuff' + ak, [[-0.3, 0.05 * ak], [-0.25, 0.054 * ak]], { rows: 2, seg: 18 }), GFX.mat(gloveC, { tex: 'leather', rough: 0.4 }), 0, 0, 0);
    P.arms.push({ sh, el, hand });
  });
  // ---- legs
  P.legs = [];
  const baggy = look.baggy, lk = bulk * (female ? 0.85 : 1);
  for (const s of [-1, 1]) {
    const hip = pivot(P.hips, s * 0.105 * Math.sqrt(bulk), -0.05, 0);
    part(hip, baggy ? limbG('baggyThigh', lk) : limbG('thigh', lk, bulge(-0.2, 0.12, 0.01)), pantsM, 0, 0, 0);
    if (look.cargo) part(hip, GFX.rbox(0.03, 0.14, 0.13, 0.01), pantsM, s * 0.1 * lk, -0.26, 0.0);
    const kn = pivot(hip, 0, -0.48, 0);
    if (baggy) part(kn, shellGeo('bshin' + lk + !!look.tornHem, LIMB.baggyShin.map(([y, r]) => [y, r * lk]), { rows: 14, seg: 20, dy: look.tornHem ? jagDy(-0.43, 0.02, 0.04, 9, s) : null }), cloth(pantsC, dbl), 0, 0, 0);
    part(kn, limbG('shin', lk, (y, p) => 0.012 * gauss(y + 0.17, 0.08) * Math.max(0, -Math.cos(p))), barefoot || dress ? skinM : pantsM, 0, 0, 0);
    if (barefoot) { // bare foot with toes
      part(kn, GFX.sphere(0.06, 14, 10), skinM, 0, -0.46, 0.05, [1.0, 0.62, 1.9]);
      for (let t = 0; t < 5; t++) part(kn, GFX.sphere(0.016 - t * 0.0015, 8, 6), skinM, -s * (0.03 - t * 0.016), -0.485, 0.155 - t * 0.008);
    } else {
      part(kn, GFX.sphere(0.07, 16, 10), bootM, 0, -0.45, 0.05, [1.1, 0.75, 1.95]);
      part(kn, GFX.rbox(0.15, 0.035, 0.29, 0.014), GFX.mat(shade(bootsC, -0.45), { rough: 0.7 }), 0, -0.49, 0.05);
      if (!dress) part(kn, shellGeo('bootcuff' + lk, [[-0.47, 0.06], [-0.38, 0.058]], { rows: 2, seg: 18 }), bootM, 0, 0, 0);
    }
    P.legs.push({ hip, kn });
  }
  if (look.weapon) addWeapon(P.arms[0].hand, look.weapon);
  root.userData = { P, kind: 'human', h: 2.2 };
  return root;
}
// a clenched fist: palm block, four curled fingers, thumb; fingerless gloves cover the palm only
function buildFist(hand, s, skinM, gloveM, k) {
  const pm = gloveM || skinM;
  mesh(GFX.rbox(0.085 * k, 0.09, 0.05, 0.02), pm, 0, -0.04, 0.005, 1, hand);
  for (let f = 0; f < 4; f++) { const x = (-0.03 + f * 0.02) * k; const fg = mesh(GFX.rbox(0.019 * k, 0.05, 0.034, 0.009), skinM, x, -0.088, 0.022, 1, hand); fg.rotation.x = 1.1; }
  if (gloveM) mesh(GFX.rbox(0.088 * k, 0.025, 0.055, 0.01), gloveM, 0, -0.078, 0.008, 1, hand);
  mesh(GFX.capsule(0.014, 0.045), skinM, -s * 0.045 * k, -0.04, 0.03, 1, hand).rotation.set(0.6, 0, -s * 0.7);
}
// the cap's light front panel with a generic flame emblem (no real logos)
function capPanelTex(bg, ink) {
  const key = 'cap' + bg + ink; if (GFX.tex[key]) return GFX.tex[key];
  const c = mkCanvas(128, 96), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 96);
  g.fillStyle = ink; g.strokeStyle = '#e8b030'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(30, 70); g.quadraticCurveTo(40, 30, 64, 18); g.quadraticCurveTo(56, 40, 70, 46); g.quadraticCurveTo(80, 30, 98, 26); g.quadraticCurveTo(84, 54, 92, 72); g.closePath(); g.fill(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (GFX.tex[key] = t);
}

function addWeapon(hand, kind) {
  const w = pivot(hand, 0, -0.03, 0); w.rotation.x = Math.PI / 2;
  const steel = GFX.mat('#e4e8f0', { metal: 0.95, rough: 0.18 }), gold = GFX.mat('#c8a040', { metal: 0.9, rough: 0.3 }), wrap = GFX.mat('#18181c', { tex: 'fabric' });
  if (kind === 'katana') { mesh(GFX.rbox(0.022, 2.0, 0.055, 0.008), steel, 0, 1.12, 0, 1, w); mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 18), gold, 0, 0.1, 0, 1, w); mesh(GFX.capsule(0.022, 0.28), wrap, 0, 0.08, 0, 1, w); }
  else if (kind === 'sword') { mesh(GFX.rbox(0.03, 1.2, 0.12, 0.01), steel, 0, 0.72, 0, 1, w); mesh(GFX.rbox(0.34, 0.06, 0.08, 0.02), gold, 0, 0.12, 0, 1, w); mesh(GFX.capsule(0.025, 0.2), wrap, 0, 0.1, 0, 1, w); }
}
// state: idle | walk | attack | cast | hurt | kneel | ko | victory | talk
function poseCharacter(m, state, t) {
  const P = m.userData.P; if (!P) return;
  const HY = P.hipY || 0.8;
  P.hips.position.y = HY; P.hips.rotation.set(0, 0, 0); P.torso.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);
  P.arms.forEach((a, i) => { a.sh.rotation.set(0, 0, i ? 0.07 : -0.07); a.el.rotation.set(0, 0, 0); });
  for (const l of P.legs) { l.hip.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); }
  m.rotation.x = 0; m.rotation.z = 0;
  const [R, L] = P.arms, [LR, LL] = P.legs;
  switch (state) {
    case 'walk': {
      const s = Math.sin(t * 0.32);
      LR.hip.rotation.x = s * 0.6; LL.hip.rotation.x = -s * 0.6;
      LR.kn.rotation.x = Math.max(0, -s) * 0.9; LL.kn.rotation.x = Math.max(0, s) * 0.9;
      R.sh.rotation.x = -s * 0.5; L.sh.rotation.x = s * 0.5; R.el.rotation.x = -0.35; L.el.rotation.x = -0.35;
      P.hips.position.y = HY + Math.abs(Math.cos(t * 0.32)) * 0.04 - 0.02; P.torso.rotation.x = 0.06; P.torso.rotation.y = s * 0.08;
      break;
    }
    case 'attack': R.sh.rotation.x = -2.6 + Math.min(1, (t % 30) / 10) * 2.2; R.el.rotation.x = -0.2; P.torso.rotation.y = -0.3; LR.hip.rotation.x = -0.5; LL.hip.rotation.x = 0.4; LR.kn.rotation.x = 0.3; P.hips.position.y = HY - 0.05; break;
    case 'cast': R.sh.rotation.x = -2.7; L.sh.rotation.x = -2.7; R.sh.rotation.z = 0.3; L.sh.rotation.z = -0.3; P.head.rotation.x = -0.3; break;
    case 'hurt': P.torso.rotation.x = -0.35; P.head.rotation.x = -0.3; R.sh.rotation.x = 0.4; L.sh.rotation.x = 0.4; R.sh.rotation.z = -0.3; L.sh.rotation.z = 0.3; break;
    case 'kneel': P.hips.position.y = HY * 0.56; LR.hip.rotation.x = -1.4; LR.kn.rotation.x = 1.4; LL.hip.rotation.x = 0.3; LL.kn.rotation.x = 1.25; P.torso.rotation.x = 0.4; R.sh.rotation.x = 0.3; P.head.rotation.x = 0.2; break;
    case 'ko': m.rotation.x = -Math.PI / 2; break;
    case 'victory': R.sh.rotation.x = -2.9; R.sh.rotation.z = -0.2; R.el.rotation.x = -0.3; L.sh.rotation.z = 0.25; P.hips.position.y = HY + Math.abs(Math.sin(t * 0.12)) * 0.08; break;
    case 'stand': { const b = Math.sin(t * 0.05); P.hips.position.y = HY + b * 0.006; P.torso.rotation.x = b * 0.01; R.el.rotation.x = -0.15; L.el.rotation.x = -0.15; break; }
    case 'talk': P.head.rotation.x = Math.sin(t * 0.25) * 0.06; P.head.rotation.y = Math.sin(t * 0.05) * 0.1; R.sh.rotation.x = -0.6 + Math.sin(t * 0.15) * 0.2; R.el.rotation.x = -0.9; P.hips.position.y = HY + Math.sin(t * 0.08) * 0.012; break;
    default: { // idle: battle-ready breathing, fists up
      const b = Math.sin(t * 0.07);
      P.hips.position.y = HY + b * 0.012 - 0.03; P.torso.rotation.x = 0.06 + b * 0.02;
      LR.hip.rotation.x = -0.12; LR.kn.rotation.x = 0.18; LL.hip.rotation.x = 0.1; LL.kn.rotation.x = 0.12;
      R.sh.rotation.x = -0.35; R.el.rotation.x = -1.1; L.sh.rotation.x = -0.15; L.el.rotation.x = -0.9; L.sh.rotation.z = 0.12; R.sh.rotation.z = -0.12;
    }
  }
}

// ------------------------------------------------------------------ monsters
function buildMonster(kind, pal) {
  MAT_TEX = 'hide';
  try { return buildMonsterParts(kind, pal); } finally { MAT_TEX = null; }
}
function buildMonsterParts(kind, pal) {
  const root = new THREE.Group(), c1 = pal[0], c2 = pal[1] || shade(pal[0], -0.35), c3 = pal[2] || shade(pal[0], 0.35), A = pal[3] || '#e0c040', E = pal[4] || '#ff3030';
  const eyeOpt = { emissive: new THREE.Color(E).multiplyScalar(0.6).getHex(), tex: null, rough: 0.2 };
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
      add(k.userData.P.head, ico(0.235, 1), c3, 0, 0.22, 0, { s: [1, 1.05, 1.05], tex: 'metal', metal: 0.7, rough: 0.35 });
      add(k.userData.P.head, box(0.26, 0.04, 0.04), E, 0, 0.22, 0.235, eyeOpt);
      add(k.userData.P.arms[1].hand, box(0.05, 0.5, 0.4), c3, 0.06, -0.05, 0.1, { tex: 'metal', metal: 0.7, rough: 0.35 });
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
  return castShadows(root);
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
// sky: [zenith, horizon]  haze: horizon/fog colour  ground: tint colours  tex: ground texture
// layers: painted skyline  sun: [u, elevation, colour, size]  li/hemi/env: light levels
const STAGES = {
  grass: { sky: ['#2a62c4', '#cfe2f2'], haze: '#cbdbe6', ground: ['#5a8a36', '#6e9a40', '#84a850'], tex: 'grass', tuft: '#7aa048', props: 'pines', clouds: 0.6,
    layers: [['mountains', '#5a6a8a', 0.2], ['hills', '#55783e', 0.06, '#2a5aa8']], sun: [0.15, 0.95, '#fff6d8', 12] },
  night: { sky: ['#03040f', '#1a2344'], haze: '#141a30', ground: ['#2a3a2c', '#34463a', '#2a3428'], tex: 'grass', tuft: '#34503a', props: 'pines', stars: true, moon: true, clouds: 0.25, cloudCol: [70, 80, 110],
    layers: [['mountains', '#1a2238', 0.18], ['hills', '#121a24', 0.06]], sun: [0.18, 0.75, '#e8ecff', 9], light: '#a8b8ff', li: 0.9, hemi: 0.35, env: 0.5, dark: true },
  woods: { sky: ['#01030a', '#0e1824'], haze: '#0c1520', ground: ['#1e2a18', '#2a3420', '#18200f'], tex: 'dirt', tuft: '#2a3a20', props: 'forest', stars: true, fog: [6, 34],
    layers: [['treeline', '#030605']], sun: [0.2, 0.9, '#c0c8e0', 4], light: '#9aaee0', li: 1.1, hemi: 0.5, env: 0.5, dark: true, night: true, lamp: '#ffe0b0', lampI: 2.2 },
  beach: { sky: ['#1f6ad0', '#d4ecfb'], haze: '#d6e8f4', ground: ['#e6d2a0', '#dcc490', '#efe0b6'], tex: 'sand', props: 'palms', sea: true, clouds: 0.45,
    layers: [['sea', '#2d6fb8'], ['islands', '#5a7a5a'], ['hills', '#6a8a4a', 0.04, '#2a5aa8']], sun: [0.15, 1.0, '#fff8e0', 12] },
  scrub: { sky: ['#3c86dc', '#f2e6c4'], haze: '#eadfc2', ground: ['#c2a05a', '#b0904c', '#d2b46e'], tex: 'dirt', tuft: '#b8a060', props: 'olives', clouds: 0.3,
    layers: [['mountains', '#8a7a6a', 0.16], ['hills', '#9a8858', 0.06, '#2a6ab0']], sun: [0.15, 1.05, '#fff4d0', 12], li: 2.5 },
  canyon: { sky: ['#c06a38', '#f8d8a0'], haze: '#f0c690', ground: ['#c07848', '#b06838', '#cf8a5a'], tex: 'dirt', props: 'mesas', clouds: 0.3, cloudCol: [255, 220, 190], rim: 9,
    layers: [['mesas', '#a85a34']], sun: [0.3, 0.45, '#ffe0a0', 14], light: '#ffd8a8', li: 2.3 },
  cave: { sky: ['#05080c', '#1a2836'], haze: '#0e161e', ground: ['#3a4652', '#2c3640', '#465260'], tex: 'rock', props: 'stalag', fog: [8, 40],
    layers: [['cave']], light: '#a8c8ff', li: 0.7, hemi: 0.3, env: 0.4, dark: true, lamp: '#a0e0ff' },
  island: { sky: ['#1668dc', '#d4f0ff'], haze: '#d4ecfa', ground: ['#d8c088', '#8ab04a', '#c8b078'], tex: 'sand', tuft: '#8ab04a', props: 'palms', sea: true, clouds: 0.55,
    layers: [['sea', '#2378c8'], ['islands', '#4a7a4a']], sun: [0.15, 1.0, '#fff8e0', 12] },
  theater: { sky: ['#5a3a7a', '#f6b07a'], haze: '#f0bc90', ground: ['#d8c49a', '#c8b48a', '#e2d0a6'], tex: 'dirt', floor: 'stone', props: 'amphitheater', clouds: 0.5, cloudCol: [255, 200, 170],
    layers: [['hills', '#7a5a4a', 0.07], ['ruins', '#8a6a5a']], sun: [0.32, 0.3, '#ffd090', 16], light: '#ffc890', li: 2.2 },
  sea: { sky: ['#1f6ad0', '#d4ecfb'], haze: '#d6e8f4', ground: ['#2a6ac8'], props: 'boat', water: true, clouds: 0.5,
    layers: [['sea', '#2d6fb8'], ['islands', '#5a8a5a']], sun: [0.15, 1.0, '#fff8e0', 12] },
  graveyard: { sky: ['#02030a', '#1c2240'], haze: '#121628', ground: ['#28321f', '#323c28', '#202818'], tex: 'grass', tuft: '#2e3e26', props: 'graves', stars: true, moon: true, clouds: 0.3, cloudCol: [60, 66, 90], fog: [10, 50],
    layers: [['hills', '#0c1018', 0.06], ['graves', '#080a10']], sun: [0.2, 0.7, '#e8ecff', 10], light: '#a8b4f0', li: 1.4, hemi: 0.55, env: 0.5, dark: true, lamp: '#ffd8a0', lampI: 1.6 },
  villa: { sky: ['#2268d0', '#d4ecfb'], haze: '#d6e8f4', ground: ['#d8d0bc', '#ccc4b0', '#e4dcc8'], tex: 'cobble', props: 'villa', clouds: 0.4,
    layers: [['sea', '#2d6fb8'], ['hills', '#6a8a4a', 0.05, '#2a5aa8']], sun: [0.15, 1.0, '#fff8e0', 12] },
  shrine: { sky: ['#101018', '#4a4a64'], haze: '#2a2a38', ground: ['#8a8a94', '#74747e', '#9a9aa4'], tex: 'stone', props: 'pillars', fog: [10, 50],
    layers: [['mountains', '#202030', 0.25]], sun: [0.2, 0.8, '#d0d0ff', 6], light: '#c0c0ff', li: 0.9, hemi: 0.35, env: 0.5, dark: true, lamp: '#ffd080' },
  rift: { sky: ['#0a0418', '#4a2060'], haze: '#2a1838', ground: ['#3a2a4a', '#4a3a5a', '#2a1a3a'], tex: 'rock', props: 'pillars', stars: true, clouds: 0.4, cloudCol: [150, 90, 170],
    layers: [['mountains', '#1a0a28', 0.22]], sun: [0.2, 0.8, '#e0b0ff', 8], light: '#d0a8ff', li: 1.0, hemi: 0.35, env: 0.5, dark: true },
  day: { sky: ['#4a5ab0', '#ffc890'], haze: '#ffd0a0', ground: ['#e6d2a0', '#dcc490', '#efe0b6'], tex: 'sand', props: 'palms', sea: true, clouds: 0.5, cloudCol: [255, 210, 180],
    layers: [['sea', '#4a6ab0'], ['islands', '#6a5a7a']], sun: [0.3, 0.2, '#ffd890', 18], light: '#ffd0a0', li: 2.2 }
};
function waterMaterial(color, rep, opacity = 0.9) {
  const t = GFX.texture('water').clone(); t.needsUpdate = true; t.repeat.set(rep, rep);
  return new THREE.MeshStandardMaterial({ color: lin(color), map: t, roughness: 0.08, metalness: 0.15, transparent: opacity < 1, opacity, envMapIntensity: 1.2 });
}
// sun + sky light + image-based light for a scene
function lightScene(scene, st, key, span = 16) {
  const pano = GFX.panorama(key, st);
  scene.environment = GFX.envFor(key, pano);
  scene.add(new THREE.HemisphereLight(lin(st.dark ? '#8890c0' : '#dfe8ff'), lin(st.dark ? '#202028' : '#7a6448'), st.hemi != null ? st.hemi : 0.5));
  const s = st.sun || [0.15, 0.95], sun = new THREE.DirectionalLight(lin(st.light || '#fff2dc'), st.li != null ? st.li : 2.2);
  sun.position.copy(GFX.dirFrom(s[0], Math.max(0.35, s[1])).multiplyScalar(40));
  if (R3.shadows) {
    sun.castShadow = true; const sc = sun.shadow.camera; sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.near = 1; sc.far = 100;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  }
  scene.add(sun); scene.add(sun.target);
  const rimL = new THREE.DirectionalLight(lin(st.dark ? '#8aa0ff' : '#cfe0ff'), st.dark ? 0.9 : 0.8); // back light that outlines the characters
  rimL.position.copy(GFX.dirFrom(s[0] + 0.5, 0.5).multiplyScalar(30)); scene.add(rimL);
  for (const o of [scene]) o.userData.envI = st.env != null ? st.env : 1;
  return { pano, sun };
}
function buildStage(key, seed = 1) {
  R3.sweep();
  const st = STAGES[key] || STAGES.grass, scene = new THREE.Scene(), r = mulberry32(hashStr(key) + seed);
  key = STAGES[key] ? key : 'grass';
  const { pano } = lightScene(scene, st, key);
  const sky = GFX.skySphere(pano); scene.add(sky); scene.children.unshift(scene.children.pop()); scene.userData.sky = sky; // sky stays child 0
  const fog = st.fog || [24, 75]; scene.fog = new THREE.Fog(lin(st.haze), fog[0], fog[1]);
  const ticks = [];
  // ground: smooth terrain, flat arena, rolling further out, rising to a rim; dips under the sea
  const rim = st.rim != null ? st.rim : 5;
  const hgt = (x, z) => {
    const d = Math.hypot(x, z);
    let h = (fbm(x * 0.06 + 100, z * 0.06 + 100, 4096, 3, 7) - 0.5) * 1.8 * smooth(8, 20, d) + smooth(30, 68, d) * rim * (0.35 + fbm(x * 0.03 + 7, z * 0.03 + 7, 4096, 2, 9));
    if (st.sea) h -= smooth(-12, -26, z) * (3 + rim * 1.5);
    return h;
  };
  if (!st.water) {
    const size = 150, seg = 110, geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv, gc = st.ground.map(lin), cols = [], tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, hgt(x, z));
      const a = fbm(x * 0.07 + 30, z * 0.07 + 30, 4096, 3, 1), b = fbm(x * 0.15 + 60, z * 0.15 + 60, 4096, 2, 2);
      tmp.copy(gc[0]).lerp(gc[1 % gc.length], smooth(0.35, 0.65, a)).lerp(gc[2 % gc.length], smooth(0.55, 0.8, b) * 0.7);
      cols.push(tmp.r, tmp.g, tmp.b); uv.setXY(i, x / 4, z / 4);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const gm = new THREE.Mesh(geo, GFX.mat('#ffffff', { vc: true, tex: st.tex || 'grass' })); gm.receiveShadow = true; scene.add(gm);
  }
  if (st.floor) { // paved arena
    const f = new THREE.Mesh(new THREE.CircleGeometry(10.5, 64), GFX.mat('#d8c8a8', { tex: st.floor, repeat: [5, 5] })); f.rotation.x = -Math.PI / 2; f.position.y = 0.03; f.receiveShadow = true; scene.add(f);
    const edge = new THREE.Mesh(new THREE.RingGeometry(10.5, 11.2, 64), GFX.mat('#b8a888', { tex: 'stone' })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.05; edge.receiveShadow = true; scene.add(edge);
  }
  if (st.sea || st.water) {
    const wm = waterMaterial(st.water ? '#1d5aa0' : '#2468b0', st.water ? 60 : 50, st.water ? 1 : 0.92);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), wm); w.rotation.x = -Math.PI / 2; w.position.y = st.water ? 0 : -0.35; w.receiveShadow = true; scene.add(w);
    ticks.push(t => { wm.map.offset.set(t * 0.0006, t * 0.0003); });
  }
  const place = (n, dMin, dMax, fn, all) => { // props away from the arena, out of the camera's side of the ring
    for (let i = 0; i < n; i++) {
      const a = all ? r() * Math.PI * 2 : Math.PI * 0.62 + r() * Math.PI * 1.55, d = dMin + r() * (dMax - dMin), x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (st.sea && z < -13) continue;
      const o = fn(x, z, 0.75 + r() * 0.6); if (!o) continue; o.position.set(x, hgt(x, z), z); o.rotation.y = r() * 6.28; scene.add(o);
    }
  };
  const scale = (o, s) => { o.scale.setScalar(s); return o; };
  if (st.tuft) scene.add(GFX.grass(st.tuftN || 1600, st.tuft, () => { const a = r() * Math.PI * 2, d = 3 + Math.pow(r(), 0.7) * 34, x = Math.sin(a) * d, z = Math.cos(a) * d; return st.sea && z < -11 ? null : [x, hgt(x, z), z]; }, 0.55));
  switch (st.props) {
    case 'pines':
      place(9, 15, 34, (x, z, s) => scale(PROPS.umbrellaPine(r), s * 1.1)); place(6, 14, 30, (x, z, s) => scale(PROPS.cypress(r), s));
      place(14, 10, 32, (x, z, s) => PROPS.rock(r, '#9a9488', s * 0.9), true); place(12, 11, 30, (x, z, s) => scale(PROPS.bush(r, '#4a6a34'), s * 1.3));
      if (!st.dark) scene.add(GFX.flowers(260, ['#f0e040', '#ffffff', '#e05080', '#a060e0'], () => { const a = r() * 6.28, d = 6 + r() * 26, x = Math.sin(a) * d, z = Math.cos(a) * d; return [x, hgt(x, z), z]; }));
      break;
    case 'forest':
      place(70, 14, 42, (x, z, s) => scale(PROPS.forestTree(r), s * 1.05)); place(8, 14, 26, (x, z, s) => scale(PROPS.deadTree(r), s));
      place(18, 9, 30, (x, z, s) => scale(PROPS.bush(r, '#1e3018'), s * 1.4)); place(10, 8, 30, (x, z, s) => PROPS.rock(r, '#4a4a44', s * 0.7), true);
      break;
    case 'palms':
      place(13, 14, 30, (x, z, s) => scale(PROPS.palm(r), s)); place(10, 9, 28, (x, z, s) => PROPS.rock(r, '#a09a8a', s * 0.9), true);
      place(8, 11, 26, (x, z, s) => scale(PROPS.bush(r, '#4a7a34'), s * 1.2));
      break;
    case 'olives':
      place(16, 14, 36, (x, z, s) => scale(PROPS.olive(r), s * 1.2)); place(5, 16, 34, (x, z, s) => scale(PROPS.cypress(r), s));
      place(16, 9, 34, (x, z, s) => PROPS.rock(r, '#a8987a', s * 1.0), true); place(14, 10, 30, (x, z, s) => scale(PROPS.bush(r, '#7a7a4a'), s * 1.2));
      break;
    case 'mesas':
      place(12, 18, 42, (x, z, s) => { const g = new THREE.Group(), h = 4 + r() * 7; mesh(GFX.blob(Math.floor(r() * 4) + 20, 0.25, 2), M.rock('#b0643a'), 0, h / 2 - 0.5, 0, [2.5 * s, h / 2, 2.2 * s], g); mesh(GFX.blob(3, 0.15, 1), M.rock('#c47a4a'), 0, h - 0.5, 0, [2.6 * s, 0.4, 2.3 * s], g); return g; });
      place(22, 9, 34, (x, z, s) => PROPS.rock(r, '#b87048', s * 1.2), true); place(8, 10, 30, (x, z, s) => scale(PROPS.bush(r, '#8a7a3a'), s));
      break;
    case 'stalag':
      place(40, 14, 36, (x, z, s) => { const g = new THREE.Group(); mesh(cone(0.6 * s, 3 * s, 14), M.rock('#56626e'), 0, 1.5 * s, 0, 1, g); mesh(cone(0.5 * s, 2.4 * s, 14), M.rock('#46525c'), 0.4, 8.5, 0.2, 1, g).rotation.x = Math.PI; return g; }, true);
      for (let i = 0; i < 6; i++) { const a = Math.PI + r() * Math.PI, d = 9 + r() * 6, x = Math.cos(a) * d, z = Math.sin(a) * d; const c = add(scene, new THREE.OctahedronGeometry(0.5, 0), '#60d0ff', x, 0.8, z, { emissive: 0x2a90c0, rough: 0.2 }); c.scale.set(0.8, 2, 0.8); const pl = new THREE.PointLight(lin('#60d0ff'), 1.2, 9); pl.position.set(x, 1.5, z); scene.add(pl); }
      place(14, 8, 30, (x, z, s) => PROPS.rock(r, '#5a6470', s), true);
      break;
    case 'amphitheater': {
      const sm = M.stone('#d8c49a'), sm2 = M.stone('#c8b48a');
      for (let tier = 0; tier < 7; tier++) for (let i = 0; i <= 22; i++) {
        const a = Math.PI + i / 22 * Math.PI, rr = 15 + tier * 1.5;
        const b = mesh(GFX.rbox(4.4, 0.75, 1.6, 0.06), tier % 2 ? sm2 : sm, Math.cos(a) * rr, 0.37 + tier * 0.75, Math.sin(a) * rr, 1, scene); b.rotation.y = -a + Math.PI / 2;
        if (r() < 0.05) b.visible = false; // crumbled seats
      }
      for (const [x, z, br] of [[-13, -6, 0], [-9.5, -8.5, 1], [9.5, -8.5, 0], [13, -6, 1], [-16, 2, 1], [16, 2, 0]]) { const c = PROPS.column(r, 5.5, !!br, '#ece0c4'); c.position.set(x, 0, z); scene.add(c); }
      place(8, 18, 34, (x, z, s) => scale(PROPS.cypress(r), s * 1.2)); place(12, 11, 26, (x, z, s) => PROPS.rock(r, '#c8b48a', s * 0.7), true);
      for (let i = 0; i < 8; i++) { const b = mesh(GFX.rbox(1.2, 0.5, 0.7, 0.05), sm2, (r() - 0.5) * 20, 0.25, 5 + r() * 6, 1, scene); b.rotation.y = r() * 3; } // fallen blocks
      break;
    }
    case 'boat': {
      const wood = M.wood('#a07040'), white = M.plaster('#f0eee8'), blue = GFX.mat('#1e4a8a', { rough: 0.5 });
      mesh(GFX.rbox(8.6, 0.25, 4.0, 0.08), wood, 0.6, -0.12, 3.3, 1, scene);
      mesh(GFX.rbox(8.9, 1.3, 4.3, 0.3), white, 0.6, -0.8, 3.3, 1, scene); mesh(GFX.rbox(8.95, 0.18, 4.35, 0.08), blue, 0.6, -0.42, 3.3, 1, scene);
      const bow = mesh(new THREE.CylinderGeometry(0.01, 2.15, 3.2, 4, 1), white, -5.4, -0.8, 3.3, [1, 1, 1], scene); bow.rotation.set(0, Math.PI / 4, Math.PI / 2); bow.scale.set(1, 1, 0.6);
      for (const z of [1.25, 5.35]) { mesh(GFX.rbox(8.6, 0.06, 0.08, 0.02), GFX.mat('#d8dce4', { metal: 0.8, rough: 0.3 }), 0.6, 0.75, z, 1, scene); for (let i = 0; i < 9; i++) mesh(cyl(0.025, 0.025, 0.75, 8), GFX.mat('#d8dce4', { metal: 0.8, rough: 0.3 }), -3.6 + i * 1.05, 0.38, z, 1, scene); }
      mesh(GFX.rbox(1.6, 1.3, 2.4, 0.12), white, -3.2, 0.65, 3.3, 1, scene); mesh(GFX.rbox(1.65, 0.4, 2.0, 0.05), GFX.mat('#1a2030', { rough: 0.1, metal: 0.5 }), -3.2, 0.95, 3.3, 1, scene);
      const foam = new THREE.Mesh(new THREE.RingGeometry(4.7, 5.4, 48), GFX.mat('#ffffff', { opacity: 0.18 })); foam.rotation.x = -Math.PI / 2; foam.scale.set(1.25, 0.6, 1); foam.position.set(0.6, 0.02, 3.3); scene.add(foam);
      const isl = new THREE.Group(); mesh(GFX.blob(4, 0.3, 2), M.leaf('#4a7a3a'), 0, 0, 0, [14, 5, 8], isl); mesh(GFX.blob(5, 0.2, 2), GFX.mat('#d8c088', { tex: 'sand' }), 0, -1, 0, [17, 2.5, 10], isl); isl.position.set(-40, 0, -70); scene.add(isl);
      break;
    }
    case 'graves':
      place(34, 9, 30, (x, z, s) => scale(PROPS.tomb(r), s * 1.1), true); place(10, 14, 32, (x, z, s) => scale(PROPS.cypress(r), s * 1.1));
      place(6, 14, 28, (x, z, s) => scale(PROPS.deadTree(r), s)); place(10, 9, 28, (x, z, s) => PROPS.rock(r, '#5a5a58', s * 0.6), true);
      break;
    case 'villa': {
      const wall = M.plaster('#f6f4ee'), blue = M.wood('#2a6ab8');
      mesh(sbox(16, 4, 0.7), wall, 0, 2, -12, 1, scene); mesh(sbox(16.4, 0.3, 1.0), wall, 0, 4.1, -12, 1, scene);
      mesh(GFX.rbox(2.2, 2.8, 0.15, 0.04), blue, 0, 1.4, -11.6, 1, scene);
      for (const x of [-5, 5]) { mesh(GFX.rbox(1.4, 1.4, 0.1, 0.03), GFX.mat('#1a2028', { rough: 0.1, metal: 0.4 }), x, 2.3, -11.62, 1, scene); for (const s of [-1, 1]) mesh(GFX.rbox(0.7, 1.5, 0.08, 0.02), blue, x + s * 1.05, 2.3, -11.55, 1, scene); }
      for (let i = 0; i < 9; i++) mesh(GFX.blob(i % 4, 0.35), M.leaf(i % 2 ? '#c02a7a' : '#d8448a'), -7 + i * 1.7 + r(), 3.6 + r() * 0.6, -11.4, [0.9, 0.6, 0.5], scene);
      mesh(GFX.rbox(9, 0.2, 5, 0.05), GFX.mat('#e8e4dc', { tex: 'stone' }), -4, 0.06, -6, 1, scene);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), waterMaterial('#3aa8e8', 3, 0.95)); pool.rotation.x = -Math.PI / 2; pool.position.set(-4, 0.17, -6); scene.add(pool);
      ticks.push(t => pool.material.map.offset.set(t * 0.001, t * 0.0005));
      place(8, 14, 26, (x, z, s) => scale(PROPS.palm(r), s));
      for (let i = 0; i < 6; i++) { const p = PROPS.pot(r); p.position.set(-7 + i * 2.8, 0, -10.8); scene.add(p); }
      break;
    }
    case 'pillars':
      place(14, 14, 30, (x, z, s) => PROPS.column(r, 3 + r() * 3, r() < 0.4, st.ground[0]), true); place(12, 9, 30, (x, z, s) => PROPS.rock(r, st.ground[1], s * 0.8), true);
      break;
  }
  // ---- extra detail: pebbles, set dressing and ambient particles per stage
  const ringPt = (d0, d1, all) => () => { const a = all ? r() * 6.28 : Math.PI * 0.62 + r() * Math.PI * 1.55, d = d0 + r() * (d1 - d0), x = Math.sin(a) * d, z = Math.cos(a) * d; return st.sea && z < -12 ? null : [x, hgt(x, z), z]; };
  if (!st.water) scene.add(GFX.pebbles(st.floor ? 90 : 170, st.pebble || mixHex(st.ground[0], '#a09a90', 0.3), ringPt(st.floor ? 11.5 : 3, 30, true), 0.08));
  const put = (o, x, z, ry = r() * 6.28) => { o.position.set(x, hgt(x, z), z); o.rotation.y = ry; scene.add(o); return o; };
  const parts = [];
  switch (st.props) {
    case 'pines': place(5, 12, 24, () => PROPS.stoneWall(r, 3 + Math.floor(r() * 3))); place(4, 10, 20, () => PROPS.log(r)); place(6, 10, 26, () => PROPS.agave(r)); break;
    case 'forest': place(14, 8, 24, () => PROPS.mushroom(r), true); place(8, 9, 22, () => PROPS.log(r)); parts.push(GFX.particles(90, '#e0ff60', [-14, 14, 0.4, 3.5, -14, 10], 0.35, 0.012, true)); break;
    case 'palms': place(6, 10, 22, () => PROPS.log(r)); place(5, 10, 20, () => PROPS.agave(r)); put(PROPS.parasol(r, '#e85a40'), -9, 4, 0); put(PROPS.lounger(r, '#3a7ad8'), -9.8, 5.2, 0.4); put(PROPS.lounger(r, '#f0f0f0'), -8, 5.6, 0.2); break;
    case 'olives': place(7, 12, 26, () => PROPS.stoneWall(r, 4 + Math.floor(r() * 3))); place(10, 9, 26, () => PROPS.agave(r)); parts.push(GFX.particles(60, '#fff0c0', [-16, 16, 0.3, 4, -16, 12], 0.08, 0.006)); break;
    case 'mesas': place(10, 9, 26, () => PROPS.agave(r)); parts.push(GFX.particles(80, '#ffd8a0', [-18, 18, 0.2, 4, -18, 12], 0.09, 0.008)); break;
    case 'stalag': parts.push(GFX.particles(50, '#80e0ff', [-14, 14, 0.5, 5, -14, 10], 0.12, 0.006, true)); break;
    case 'amphitheater':
      for (const [x, z] of [[-8, -4], [8, -4], [-11, 3], [11, 3]]) put(PROPS.brazier(r), x, z, 0);
      put(PROPS.statue(r), -15, -11, 0.5); put(PROPS.statue(r), 15, -11, -0.5);
      parts.push(GFX.particles(60, '#ffb060', [-12, 12, 0.5, 5, -8, 6], 0.1, 0.01));
      break;
    case 'graves': for (const [x, z] of [[-9, -5], [9, -6], [-12, 4]]) put(PROPS.lantern(r), x, z); place(8, 9, 22, () => PROPS.mushroom(r), true); parts.push(GFX.particles(40, '#c8ffa0', [-16, 16, 0.4, 3, -16, 12], 0.18, 0.012, true)); break;
    case 'villa': put(PROPS.lounger(r, '#2a6ab8'), -1.5, -8.5, 0); put(PROPS.lounger(r, '#f0f0f0'), 0.2, -8.5, 0); put(PROPS.parasol(r, '#f4f0e8'), -0.6, -9.6, 0); put(PROPS.lantern(r), 6.5, -10.5, 0); put(PROPS.lantern(r), -9, -10.5, 0); break;
    case 'boat': for (let i = 0; i < 3; i++) put(PROPS.barrel(r), -1.8 + i * 0.75, 2.1, 0).position.y = 0.02; put(PROPS.crate(r), 3.3, 2.2).position.y = 0.02; break;
    case 'pillars': for (const [x, z] of [[-7, -5], [7, -5]]) put(PROPS.brazier(r), x, z, 0); parts.push(GFX.particles(50, '#ffd080', [-14, 14, 0.5, 5, -12, 8], 0.1, 0.008)); break;
  }
  for (const pt of parts) { scene.add(pt); ticks.push(pt.userData.tick); }
  const flames = []; scene.traverse(o => { if (o.userData.flame) flames.push(o); });
  if (flames.length) ticks.push(t => flames.forEach((f, i) => { const k = 1 + Math.sin(t * 0.3 + i * 1.7) * 0.12 + Math.sin(t * 0.73 + i) * 0.06; f.scale.set(k, 1.1 + (k - 1) * 2, k); }));
  if (st.lamp) { const l = new THREE.PointLight(lin(st.lamp), st.lampI || 1.1, 18, 1.4); l.position.set(0.6, 4, 4); scene.add(l); }
  if (st.env != null) scene.traverse(o => { if (o.material && o.material.isMeshStandardMaterial && !o.userData.sky) o.material.envMapIntensity = st.env; });
  scene.userData.tick = t => { for (const f of ticks) f(t); };
  return scene;
}
function stageCamera() { return new THREE.PerspectiveCamera(42, SW / SH, 0.1, 400); }

// ------------------------------------------------------------------ 3D maps
// Merged geometry per texture bucket (vertex-coloured, planar UVs); dynamic things are separate meshes.
const BUCKET = {
  plain: {}, grass: { tex: 'grass', s: 0.5 }, sand: { tex: 'sand', s: 0.5 }, dirt: { tex: 'dirt', s: 0.5 }, rock: { tex: 'rock', s: 0.45, rough: 0.95 },
  cobble: { tex: 'cobble', s: 1.15 }, plaster: { tex: 'plaster', s: 0.6, rough: 0.95 }, stone: { tex: 'stone', s: 0.7 }, wood: { tex: 'wood', s: 1.2, rough: 0.8 },
  leaves: { tex: 'leaves', s: 1, rough: 0.8 }, bark: { tex: 'bark', s: 1 }, roof: { tex: 'roof', s: 1 }, frond: { tex: 'frond', s: 1, alpha: true, side: THREE.DoubleSide },
  glass: { rough: 0.1, metal: 0.4 }
};
class GeoBuilder {
  constructor() { this.b = {}; this.use('plain'); }
  use(k) { this.cur = this.b[k] || (this.b[k] = { p: [], n: [], c: [], uv: [], s: (BUCKET[k] || {}).s || 1 }); return this; }
  tri(a, b, c, col) {
    const B = this.cur, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const v of [a, b, c]) {
      B.p.push(v[0], v[1], v[2]); B.n.push(nx, ny, nz); B.c.push(col.r, col.g, col.b);
      if (Math.abs(ny) > 0.6) B.uv.push(v[0] * B.s, v[2] * B.s); else if (Math.abs(nx) > Math.abs(nz)) B.uv.push(v[2] * B.s, v[1] * B.s); else B.uv.push(v[0] * B.s, v[1] * B.s);
    }
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  box(x0, y0, z0, x1, y1, z1, top, side, bottom = false) {
    const T = lin(top), S = lin(side), S2 = S.clone().multiplyScalar(0.92);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], T);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], S);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], S2);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], S2);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], S2);
  }
  floor(x, z, y, col) { this.quad([x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z], lin(col)); }
  prism(x0, z0, x1, z1, y0, h, col) { // gable roof, ridge along x
    const C = lin(col), zm = (z0 + z1) / 2, D = C.clone().multiplyScalar(0.8);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0 + h, zm], [x0, y0 + h, zm], C);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y0 + h, zm], [x1, y0 + h, zm], D);
    this.tri([x0, y0, z0], [x0, y0, z1], [x0, y0 + h, zm], D); this.tri([x1, y0, z1], [x1, y0, z0], [x1, y0 + h, zm], D);
  }
  // merge any geometry (with its own normals and UVs), placed at x,y,z with scale s and y-rotation ry
  geo(g, x, y, z, s, ry, col, k) {
    const B = k ? this.use(k).cur : this.cur, C = lin(col), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, idx = g.index;
    const sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s, sz = Array.isArray(s) ? s[2] : s, cs = Math.cos(ry || 0), sn = Math.sin(ry || 0);
    const cnt = idx ? idx.count : p.count;
    for (let k2 = 0; k2 < cnt; k2++) {
      const i = idx ? idx.getX(k2) : k2;
      const px = p.getX(i) * sx, py = p.getY(i) * sy, pz = p.getZ(i) * sz;
      B.p.push(x + px * cs + pz * sn, y + py, z - px * sn + pz * cs);
      let nx = n.getX(i) / sx, ny = n.getY(i) / sy, nz = n.getZ(i) / sz; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      B.n.push(nx * cs + nz * sn, ny, -nx * sn + nz * cs);
      B.c.push(C.r, C.g, C.b); if (uv) B.uv.push(uv.getX(i), uv.getY(i)); else B.uv.push(0, 0);
    }
    if (k) this.use('plain');
  }
  meshes(scene) {
    for (const [k, B] of Object.entries(this.b)) {
      if (!B.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      const o = BUCKET[k] || {}, m = new THREE.Mesh(g, GFX.mat('#ffffff', { vc: true, tex: o.tex, rough: o.rough, metal: o.metal, alpha: o.alpha, side: o.side }));
      m.castShadow = k !== 'plain' || true; m.receiveShadow = true; scene.add(m);
    }
  }
}
// a lumpy mountain cone
GFX.peak = function (v) {
  const key = 'peak' + v; if (this.geos[key]) return this.geos[key];
  const g = new THREE.ConeGeometry(1, 1, 14, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + noise3(x * 3, y * 3, z * 3, v * 2.7) * 0.28; p.setXYZ(i, x * k, y + 0.5 + noise3(x * 5, 1, z * 5, v) * 0.05, z * k); }
  g.computeVertexNormals(); return (this.geos[key] = g);
};
const FLOOR_COL = {
  grass: '#5a9a3a', flowers: '#5a9a3a', forest: '#3a7a2e', tree: '#5a9a3a', mountain: '#5a9a3a', sand: '#e4cc8c', dune: '#dcc080', cactus: '#e4cc8c',
  dmountain: '#e4cc8c', snow: '#c8a65c', snowtree: '#c8a65c', smountain: '#c8a65c', waste: '#d8c088', wmountain: '#d8c088', road: '#c8a878',
  boulder: '#c8a878', riftwall: '#1a0a20', lightbridge: '#1a0a20', icewall: '#c8c8d8', tpath: '#c8b090', counter: '#c8b090', fountain: '#c8b090'
};
const FLOOR_TEX = { sand: 'sand', dune: 'sand', cactus: 'sand', dmountain: 'sand', waste: 'sand', wmountain: 'sand', road: 'dirt', boulder: 'dirt', riftwall: 'rock', lightbridge: 'rock', icewall: 'rock' };
const MOUNTAIN = { mountain: ['#8a7a5a', '#a89a78'], smountain: ['#9a7a52', '#b89a70'], dmountain: ['#b0703a', '#c88a50'], wmountain: ['#8a7a60', '#a89878'] };
const DUNGEON_TEX = { woods: ['grass', 'leaves', 'woods'], cave: ['rock', 'rock', 'cave'], scrub: ['dirt', 'rock', 'scrub'], canyon: ['dirt', 'rock', 'canyon'], theater: ['cobble', 'stone', 'theater'],
  shrine: ['stone', 'stone', 'shrine'], ruins: ['dirt', 'stone', 'canyon'], rift: ['rock', 'rock', 'rift'], ice: ['plain', 'plain', 'shrine'] };
const TOWN_TEX = { town_old: 'grass', town_harbor: 'cobble', town_olive: 'dirt', town_port: 'sand' };
function buildMap3D(map) {
  R3.sweep();
  const B = new GeoBuilder(), scene = new THREE.Scene(), th = map.theme, W = map.w, H = map.h;
  const r = mulberry32(hashStr(map.id + 'x'));
  const dyn = { water: [], crystals: [], portals: [], chests: [], lava: [] };
  const T = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 'void' : map.tiles[y * W + x];
  const jitter = (c, k = 0.06) => { const col = new THREE.Color(c); const f = 1 + (r() - 0.5) * k * 2; return col.multiplyScalar(f).getHex(); };
  const tufts = [];
  // trees merged into the map mesh
  const tree = (x, z, s, leaf) => { B.geo(GFX.trunk(0.06, 0.035, 0.45 * s, (r() - 0.5) * 0.1), x, 0, z, 1, 0, '#6a5038', 'bark'); for (let i = 0; i < 3; i++) B.geo(GFX.blob(i, 0.28), x + (r() - 0.5) * 0.15 * s, (0.5 + i * 0.18) * s, z + (r() - 0.5) * 0.15 * s, [0.3 * s * (1 - i * 0.2), 0.26 * s, 0.3 * s * (1 - i * 0.2)], r() * 6, jitter(leaf, 0.1), 'leaves'); };
  const umbrella = (x, z, s) => { const b = (r() - 0.5) * 0.3; B.geo(GFX.trunk(0.05, 0.03, 0.8 * s, b), x, 0, z, 1, 0, '#7a6048', 'bark'); for (let i = 0; i < 3; i++) B.geo(GFX.blob(i, 0.25), x + b + (r() - 0.5) * 0.3 * s, 0.85 * s, z + (r() - 0.5) * 0.3 * s, [0.32 * s, 0.13 * s, 0.32 * s], r() * 6, jitter('#4a7832', 0.1), 'leaves'); };
  const cypress = (x, z, s) => { B.geo(GFX.blob(Math.floor(r() * 4), 0.12), x, 0.55 * s, z, [0.13 * s, 0.55 * s, 0.13 * s], 0, jitter('#24462a', 0.1), 'leaves'); };
  const olive = (x, z, s) => { B.geo(GFX.trunk(0.06, 0.04, 0.35 * s, 0.05), x, 0, z, 1, 0, '#7a6a50', 'bark'); for (let i = 0; i < 2; i++) B.geo(GFX.blob(i + 2, 0.3), x + (i - 0.5) * 0.15 * s, 0.45 * s, z + (r() - 0.5) * 0.1, [0.24 * s, 0.18 * s, 0.24 * s], r() * 6, jitter('#7a8a56', 0.1), 'leaves'); };
  const palm = (x, z, s) => { const b = 0.15 + r() * 0.2, h = 0.9 * s; B.geo(GFX.trunk(0.045, 0.03, h, b, 7), x, 0, z, 1, 0, '#9a7a52', 'bark'); for (let i = 0; i < 7; i++) B.geo(GFX.frondGeo(), x + b, h, z, 0.22 * s, i / 7 * 6.28 + r(), jitter('#4c8a34', 0.1), 'frond'); };
  const rockAt = (x, z, s, col) => B.geo(GFX.blob(Math.floor(r() * 4) + 10, 0.35, 1), x, 0.05 * s, z, [s * (0.8 + r() * 0.5), s * (0.5 + r() * 0.3), s * (0.8 + r() * 0.5)], r() * 6, jitter(col, 0.1), 'rock');
  const waterTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = T(x, y), cx = x + 0.5, cz = y + 0.5;
    if (t === 'water' || t === 'dwater' || t === 'brokenbridge' || t === 'bridgeH' || t === 'bridgeV') {
      waterTiles.push([x, y]); B.use('sand').floor(x, y, -0.3, '#7a8a70'); B.use('plain');
      if (t === 'bridgeH') { B.use('wood').box(x, -0.05, y + 0.2, x + 1, 0.06, y + 0.8, '#9a6a3a', '#6a4a2a'); for (const z of [y + 0.22, y + 0.78]) B.box(x + 0.45, -0.3, z - 0.04, x + 0.55, 0.3, z + 0.04, '#6a4a2a', '#5a3a1a'); B.use('plain'); }
      if (t === 'bridgeV') { B.use('wood').box(x + 0.2, -0.05, y, x + 0.8, 0.06, y + 1, '#9a6a3a', '#6a4a2a'); B.use('plain'); }
      if (t === 'brokenbridge') { B.use('wood'); B.box(x + 0.15, -0.3, y + 0.1, x + 0.3, 0.2, y + 0.25, '#5a3a1a', '#5a3a1a'); B.box(x + 0.6, -0.3, y + 0.7, x + 0.75, 0.15, y + 0.85, '#5a3a1a', '#5a3a1a'); B.use('plain'); }
      continue;
    }
    if (t === 'lava') { B.floor(x, y, -0.1, '#e04010'); dyn.lava.push([x, y]); continue; }
    if (map.type === 'dungeon') {
      const [ft, wt] = DUNGEON_TEX[th.id] || ['dirt', 'rock'];
      if (t === 'dwall' || t === 'dtop' || t === 'void') {
        B.use(wt).box(x, 0, y, x + 1, 0.75, y + 1, jitter(th.top, 0.1), jitter(th.wall, 0.08)); B.use('plain');
        const v = r(), px = x + 0.25 + r() * 0.5, pz = y + 0.25 + r() * 0.5;
        switch (th.id) {
          case 'woods': if (v < 0.55) { const s = 0.9 + r() * 0.4; B.geo(GFX.trunk(0.07, 0.04, 0.9 * s), px, 0.75, pz, 1, 0, '#3a2c20', 'bark'); for (let i = 0; i < 3; i++) B.geo(GFX.blob(i, 0.3), px, 0.75 + (0.55 + i * 0.25) * s, pz, [0.35 * s * (1 - i * 0.22), 0.3 * s, 0.35 * s * (1 - i * 0.22)], r() * 6, jitter(v < 0.35 ? '#1e4a22' : '#2a5a2a', 0.15), 'leaves'); } break;
          case 'cave': if (v < 0.3) B.geo(GFX.peak(Math.floor(r() * 4)), px, 0.75, pz, [0.2, 0.5 + r() * 0.8, 0.2], 0, '#56626e', 'rock'); break;
          case 'ice': if (v < 0.35) B.geo(GFX.peak(1), px, 0.75, pz, [0.15, 0.6 + r(), 0.15], 0, v < 0.15 ? '#c8f0ff' : '#80b8e8'); break;
          case 'scrub': if (v < 0.35) { B.geo(GFX.trunk(0.05, 0.035, 0.35), px, 0.75, pz, 1, 0, '#6a5a40', 'bark'); B.geo(GFX.blob(Math.floor(v * 10) % 4, 0.3), px, 1.25, pz, [0.36, 0.24, 0.36], r() * 6, v < 0.18 ? '#7a8a52' : '#8a9a62', 'leaves'); } else if (v < 0.5) rockAt(px, pz, 0.3, '#a89070'); break;
          case 'canyon': if (v < 0.3) B.geo(GFX.peak(Math.floor(r() * 4)), px, 0.75, pz, [0.35, 0.8 + r() * 1.6, 0.35], 0, v < 0.12 ? '#a85a30' : '#c07040', 'rock'); break;
          case 'theater': B.use('stone'); if (v < 0.5) { B.box(x, 0.75, y, x + 1, 1.05, y + 0.5, '#d0bc92', '#c0aa80'); B.box(x, 1.05, y, x + 1, 1.35, y + 0.25, '#dcc8a0', '#ccb890'); }
            if (v > 0.9) { B.geo(new THREE.CylinderGeometry(0.13, 0.15, 1.5, 14), px, 1.5, pz, 1, 0, '#ece0c4', 'stone'); B.box(px - 0.22, 2.25, pz - 0.22, px + 0.22, 2.4, pz + 0.22, '#e0d4b8', '#d0c4a8'); } B.use('plain'); break;
          case 'ruins': if (v < 0.15) { const hh = 0.5 + r() * 1.2; B.use('stone').box(px - 0.15, 0.75, pz - 0.15, px + 0.15, 0.75 + hh, pz + 0.15, '#c09060', '#9a6a40'); B.use('plain'); } break;
          case 'rift': if (v < 0.3) B.geo(new THREE.OctahedronGeometry(0.2, 0), px, 1.1, pz, [0.6, 1.5 + r() * 2, 0.6], r() * 3, v < 0.12 ? '#e060ff' : '#7020a0'); break;
          case 'shrine': if (v < 0.12) B.geo(new THREE.CylinderGeometry(0.13, 0.15, 1.3, 14), px, 1.4, pz, 1, 0, '#b0b0bc', 'stone'); break;
        }
        continue;
      }
      B.use(ft).floor(x, y, 0, jitter(th.floor, 0.08)); B.use('plain');
      if (th.id === 'woods' || th.id === 'scrub') tufts.push([cx, cz, th.id === 'woods' ? '#3a5a2a' : '#b8a060']);
      if (t === 'stairsdown') for (let i = 0; i < 4; i++) B.box(x + 0.1, -0.05 - i * 0.12, y + 0.1 + i * 0.2, x + 0.9, 0.0 - i * 0.12, y + 0.3 + i * 0.2, shade(th.floor, -0.2 - i * 0.15), '#000');
      if (t === 'stairsup') for (let i = 0; i < 4; i++) B.box(x + 0.1, 0, y + 0.1 + i * 0.2, x + 0.9, 0.5 - i * 0.12, y + 0.3 + i * 0.2, shade(th.floor, 0.15), shade(th.floor, -0.1));
      if (t === 'crystal') { B.box(cx - 0.3, 0, cz - 0.3, cx + 0.3, 0.15, cz + 0.3, '#707080', '#505060'); dyn.crystals.push([cx, cz]); }
      if (t === 'portal') dyn.portals.push([cx, cz]);
      continue;
    }
    if (map.type === 'town') {
      const tt = map.theme, gt = TOWN_TEX[tt.id] || 'cobble';
      if (t === 'ttree') { B.use(gt).floor(x, y, 0, tt.ground); B.use('plain'); if (tt.med && (x + y) % 2) cypress(cx, cz, 1.5); else if (tt.med) olive(cx, cz, 1.5); else tree(cx, cz, 1.6, tt.leaf); continue; }
      if (t === 'roof' || t === 'wall' || t === 'window' || t === 'door') { B.use(gt).floor(x, y, 0, tt.ground); B.use('plain'); continue; } // buildings added below
      if (t === 'tpath') { B.use('cobble').floor(x, y, 0.005, '#d0c0a0'); B.use('plain'); }
      else { B.use(gt).floor(x, y, 0, t === 'counter' || t === 'fountain' ? '#c8b090' : jitter(tt.ground, 0.05)); B.use('plain'); if (gt === 'grass' && t !== 'counter' && t !== 'fountain') tufts.push([cx, cz, shade(tt.ground, 0.1)]); }
      if (t === 'tflower') { B.geo(GFX.blob(Math.floor(r() * 4), 0.3), cx, 0.12, cz, [0.32, 0.16, 0.32], 0, '#3a7a30', 'leaves'); for (let i = 0; i < 6; i++) B.geo(GFX.sphere(0.05, 6, 4), x + 0.2 + r() * 0.6, 0.25, y + 0.2 + r() * 0.6, 1, 0, pick2(r, tt.flowers)); }
      if (t === 'counter') { B.use('wood').box(x, 0, y + 0.15, x + 1, 0.55, y + 0.85, '#b07a4a', '#7a4a2a'); B.box(x - 0.02, 0.55, y + 0.1, x + 1.02, 0.6, y + 0.9, '#c08a5a', '#8a5a3a'); B.use('plain'); }
      if (t === 'fountain') { B.use('stone'); B.box(x + 0.05, 0, y + 0.05, x + 0.95, 0.3, y + 0.95, '#c0c0c8', '#a0a0aa'); B.geo(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 12), cx, 0.6, cz, 1, 0, '#d0d0d8', 'stone'); B.geo(new THREE.CylinderGeometry(0.25, 0.15, 0.08, 16), cx, 0.85, cz, 1, 0, '#d0d0d8', 'stone'); B.use('plain'); waterTiles.push([x, y, 0.28, 0.12]); }
      if (t === 'tpath' && (x * 7 + y * 13) % 17 === 0 && T(x + 1, y) !== 'tpath') { const lx = x + 0.92, lz = y + 0.5; B.geo(new THREE.CylinderGeometry(0.025, 0.035, 1.5, 8), lx, 0.75, lz, 1, 0, '#2a2a2e'); B.geo(GFX.rbox(0.14, 0.18, 0.14, 0.02), lx, 1.55, lz, 1, 0, '#ffe0a0'); B.geo(new THREE.ConeGeometry(0.12, 0.1, 4), lx, 1.69, lz, 1, Math.PI / 4, '#2a2a2e'); }
      if (t === 'counter' && r() < 0.5) { B.geo(GFX.lathe('barrel', [[0, 0], [0.28, 0], [0.33, 0.4], [0.28, 0.8], [0, 0.8]], 14), x + 0.5, 0, y - 0.35, 0.5, 0, '#8a5a32', 'wood'); B.use('wood').box(x + 0.6, 0, y + 0.95, x + 0.95, 0.35, y + 1.3, '#a07a4a', '#8a6a3a'); B.use('plain'); }
      if (gt !== 'grass' && t !== 'tpath' && t !== 'counter' && t !== 'fountain' && t !== 'sign' && t !== 'well' && r() < 0.03) B.geo(GFX.blob(12, 0.35, 1), x + 0.5, 0.02, y + 0.5, [0.1, 0.06, 0.08], r() * 6, '#a09a90', 'rock');
      if (t === 'sign') { B.use('wood'); B.box(cx - 0.04, 0, cz - 0.04, cx + 0.04, 0.6, cz + 0.04, '#5a3a1a', '#5a3a1a'); B.box(cx - 0.3, 0.45, cz - 0.05, cx + 0.3, 0.75, cz + 0.05, '#b07a4a', '#8a5a2a'); B.use('plain'); }
      if (t === 'well') { B.use('stone'); B.geo(new THREE.CylinderGeometry(0.32, 0.34, 0.4, 16), cx, 0.2, cz, 1, 0, '#a0a0a8', 'stone'); B.use('wood'); B.box(x + 0.2, 0.4, y + 0.45, x + 0.25, 1.0, y + 0.55, '#5a3a1a', '#5a3a1a'); B.box(x + 0.75, 0.4, y + 0.45, x + 0.8, 1.0, y + 0.55, '#5a3a1a', '#5a3a1a'); B.use('roof'); B.prism(x + 0.1, y + 0.25, x + 0.9, y + 0.75, 1.0, 0.25, '#b05a3a'); B.use('plain'); }
      continue;
    }
    // world map
    const base = FLOOR_COL[t] || '#5a9a3a', ft = FLOOR_TEX[t] || 'grass';
    B.use(ft).floor(x, y, 0, jitter(base, 0.05)); B.use('plain');
    if (ft === 'grass' && !MOUNTAIN[t]) tufts.push([cx, cz, shade(base, 0.12)]);
    if (MOUNTAIN[t]) { const [mc, cap] = MOUNTAIN[t], hgt = 1.1 + r() * 0.9; B.geo(GFX.peak(Math.floor(r() * 4)), cx + (r() - 0.5) * 0.2, 0, cz + (r() - 0.5) * 0.2, [0.75, hgt, 0.75], r() * 6, mc, 'rock'); B.geo(GFX.peak(Math.floor(r() * 4) + 4), cx + (r() - 0.5) * 0.3, 0, cz + (r() - 0.5) * 0.3, [0.45, hgt * 0.65, 0.45], r() * 6, cap, 'rock'); }
    else if (t === 'forest') { umbrella(x + 0.3, y + 0.35, 1); tree(x + 0.72, y + 0.7, 0.9, '#2a5e26'); }
    else if (t === 'tree') tree(cx, cz, 1, '#3a6e2a');
    else if (t === 'snowtree') olive(cx, cz, 1);
    else if (t === 'waste' && r() < 0.08) palm(cx, cz, 1);
    else if (t === 'grass' && r() < 0.05) (r() < 0.5 ? umbrella : cypress)(cx, cz, 0.9);
    else if (t === 'cactus') { B.box(cx - 0.08, 0, cz - 0.08, cx + 0.08, 0.6, cz + 0.08, '#3a8a3a', '#2a6a2a'); B.box(cx + 0.08, 0.25, cz - 0.05, cx + 0.22, 0.32, cz + 0.05, '#3a8a3a', '#2a6a2a'); }
    else if (t === 'dune') B.geo(GFX.blob(3, 0.1), cx, -0.05, cz, [0.55, 0.2, 0.55], 0, '#d8b868', 'sand');
    else if (t === 'flowers') for (let i = 0; i < 5; i++) B.geo(GFX.sphere(0.045, 6, 4), x + 0.15 + r() * 0.7, 0.06, y + 0.15 + r() * 0.7, 1, 0, pick2(r, ['#f0e040', '#f06080', '#ffffff']));
    else if (t === 'boulder') rockAt(cx, cz, 0.45, '#7a7a7e');
    else if (t === 'riftwall') for (let i = 0; i < 3; i++) B.geo(new THREE.OctahedronGeometry(0.15, 0), x + 0.2 + r() * 0.6, 0.5, y + 0.2 + r() * 0.6, [1, 3 + r() * 3, 1], r() * 3, '#9030d0');
    else if (t === 'lightbridge') B.box(x, 0.02, y + 0.25, x + 1, 0.08, y + 0.75, '#e0d0ff', '#a080ff');
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
      const fz = y1 + 0.95; // front face z
      if (th2.med) {
        // whitewashed house: flat roof, parapet, a dome on some, blue door and shutters, flowers
        const hh = 1.8 + ((x * 3 + y) % 3) * 0.35;
        B.use('plaster');
        B.box(x + 0.05, 0, y + 0.2, x1 + 0.95, hh, fz, wall, shade(wall, -0.03));
        B.box(x + 0.02, 0, y + 0.17, x1 + 0.98, 0.14, fz + 0.03, '#c8ccd4', '#b8bcc8'); // painted base
        B.box(x + 0.0, hh, y + 0.15, x1 + 1.0, hh + 0.18, y + 0.27, wall, wall); B.box(x + 0.0, hh, y1 + 0.88, x1 + 1.0, hh + 0.18, y1 + 1.0, wall, wall);
        B.box(x + 0.0, hh, y + 0.15, x + 0.12, hh + 0.18, y1 + 1.0, wall, wall); B.box(x1 + 0.88, hh, y + 0.15, x1 + 1.0, hh + 0.18, y1 + 1.0, wall, wall);
        const dx = (x + x1 + 1) / 2, dz = (y + y1 + 1) / 2;
        if ((x + y) % 3 !== 1) { B.box(dx - 0.6, hh, dz - 0.6, dx + 0.6, hh + 0.3, dz + 0.6, wall, wall); B.use('plain'); B.geo(GFX.sphere(0.62, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), dx, hh + 0.3, dz, [1, 0.9, 1], 0, (x + y) % 2 ? door : '#f8f8f4'); B.geo(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), dx, hh + 0.95, dz, 1, 0, '#e0e0e0'); }
        else if (x1 > x) { // roof terrace with a little stair
          for (let i = 0; i < 5; i++) B.box(x1 + 0.95, i * hh / 5, y1 - 0.2 + i * 0.12, x1 + 1.3, (i + 1) * hh / 5, y1 + 0.1 + i * 0.12, wall, shade(wall, -0.05));
        }
        B.use('plain');
        for (let xx = x; xx <= x1; xx++) {
          const ft = T(xx, y1);
          if (ft === 'door') {
            B.use('wood').box(xx + 0.24, 0, fz, xx + 0.76, 1.05, fz + 0.05, door, door); B.use('plaster');
            B.box(xx + 0.18, 1.05, fz, xx + 0.82, 1.14, fz + 0.07, shade(wall, -0.05), wall); B.use('plain');
            for (const s of [-1, 1]) { B.geo(GFX.lathe('pot', [[0, 0], [0.09, 0], [0.12, 0.1], [0.13, 0.2], [0.1, 0.24]], 12), xx + 0.5 + s * 0.42, 0, fz + 0.15, 1, 0, '#b8603a', 'plaster'); B.geo(GFX.blob(Math.floor(r() * 4), 0.35), xx + 0.5 + s * 0.42, 0.32, fz + 0.15, 0.14, 0, '#3a7a30', 'leaves'); }
          }
          if (ft === 'window') {
            B.use('glass').box(xx + 0.32, 0.75, fz, xx + 0.68, 1.3, fz + 0.03, '#1a2230', '#1a2230');
            B.use('wood'); for (const s of [0, 1]) B.box(xx + 0.12 + s * 0.56, 0.72, fz, xx + 0.32 + s * 0.56, 1.33, fz + 0.06, door, door);
            B.use('plaster').box(xx + 0.26, 0.68, fz, xx + 0.74, 0.72, fz + 0.12, wall, wall); B.use('plain');
            if (r() < 0.5) B.geo(GFX.blob(Math.floor(r() * 4), 0.4), xx + 0.5, 0.78, fz + 0.12, [0.2, 0.08, 0.08], 0, r() < 0.5 ? '#d8448a' : '#e05a30', 'leaves');
          }
          if (ft === 'roof' && (xx * 7 + y1) % 4 === 0) { B.use('wood').box(xx + 0.32, 1.15, fz, xx + 0.68, 1.5, fz + 0.04, door, door); B.use('plain'); }
        }
        for (let xx = x; xx <= x1; xx++) { // street life along the front wall
          const ft = T(xx, y1), below = T(xx, y1 + 1); if (ft === 'door' || !['tground', 'tflower', 'tpath'].includes(below)) continue;
          const v = r(), px = xx + 0.5, pz = fz + 0.2;
          if (v < 0.25) { B.geo(GFX.lathe('pot', [[0, 0], [0.09, 0], [0.12, 0.1], [0.13, 0.2], [0.1, 0.24]], 12), px - 0.25, 0, pz, 1.3, 0, '#b8603a', 'plaster'); B.geo(GFX.blob(Math.floor(r() * 4), 0.35), px - 0.25, 0.4, pz, 0.18, 0, r() < 0.5 ? '#3a7a30' : '#c02a7a', 'leaves'); }
          else if (v < 0.4) { B.use('wood'); B.box(px - 0.4, 0.22, pz - 0.05, px + 0.4, 0.27, pz + 0.12, '#8a5a32', '#6a4a2a'); B.box(px - 0.4, 0.27, pz - 0.08, px + 0.4, 0.5, pz - 0.04, '#8a5a32', '#6a4a2a'); for (const d of [-0.35, 0.35]) B.box(px + d - 0.03, 0, pz - 0.02, px + d + 0.03, 0.22, pz + 0.1, '#3a3a3a', '#2a2a2a'); B.use('plain'); }
          else if (v < 0.5) { B.geo(GFX.lathe('barrel', [[0, 0], [0.28, 0], [0.33, 0.4], [0.28, 0.8], [0, 0.8]], 14), px + 0.2, 0, pz, 0.45, 0, '#8a5a32', 'wood'); B.geo(GFX.lathe('barrel', [[0, 0], [0.28, 0], [0.33, 0.4], [0.28, 0.8], [0, 0.8]], 14), px - 0.1, 0, pz + 0.05, 0.45, 0, '#7a4a2a', 'wood'); }
        }
        if ((x * 5 + y) % 3 === 0) { // bougainvillea spilling over a corner
          const cxb = (x * 7 + y) % 2 ? x + 0.1 : x1 + 0.9;
          for (let i = 0; i < 5; i++) B.geo(GFX.blob(i % 4, 0.4), cxb + (r() - 0.5) * 0.3, hh - 0.1 - i * 0.28, fz + 0.02, [0.28, 0.22, 0.12], r() * 6, i % 2 ? '#c02a7a' : '#d8448a', 'leaves');
        }
      } else {
        B.use('plaster').box(x + 0.05, 0, y + 0.3, x1 + 0.95, 1.5, y1 + 0.95, wall, wall);
        B.use('roof').prism(x - 0.1, y + 0.1, x1 + 1.1, y1 + 1.15, 1.5, 1.0, roof); B.use('plain');
        for (let xx = x; xx <= x1; xx++) {
          const ft = T(xx, y1);
          if (ft === 'door') { B.use('wood').box(xx + 0.25, 0, y1 + 0.94, xx + 0.75, 0.9, y1 + 1.0, '#6a3a1a', '#6a3a1a'); B.use('plain'); }
          if (ft === 'window') { B.box(xx + 0.25, 0.65, y1 + 0.94, xx + 0.75, 1.1, y1 + 1.0, '#f0d070', '#f0d070'); }
        }
      }
    }
  }
  // world locations: small models on top of their tiles
  if (map.type === 'world') for (const l of map.locs) {
    const cx = l.x + 0.5, cz = l.y + 0.5;
    if (l.id.startsWith('town')) {
      const dome = { town1: '#2a6ab8', town2: '#1e5aa8', town3: '#2a7ab0', town4: '#2a5ac8' }[l.id] || '#2a6ab8';
      for (const [dx, dz, s] of [[-0.2, -0.15, 0.32], [0.22, 0.05, 0.28], [-0.05, 0.28, 0.24], [0.25, -0.25, 0.2]]) {
        B.use('plaster').box(cx + dx - s / 2, 0, cz + dz - s / 2, cx + dx + s / 2, s * 0.9, cz + dz + s / 2, '#f4f2ec', '#e8e6e0'); B.use('plain');
        if (s > 0.25) B.geo(GFX.sphere(s * 0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), cx + dx, s * 0.9, cz + dz, 1, 0, dome);
        B.box(cx + dx - 0.04, 0, cz + dz + s / 2, cx + dx + 0.04, s * 0.45, cz + dz + s / 2 + 0.01, dome, dome);
      }
    } else if (l.id === 'dungeon5') { // the Roman theater: a half ring of tiers
      B.use('stone'); for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; for (let k = 0; k < 3; k++) { const rr = 0.25 + k * 0.12, x0 = cx + Math.cos(a) * rr, z0 = cz + Math.sin(a) * rr; B.box(x0 - 0.06, 0, z0 - 0.06, x0 + 0.06, 0.1 + k * 0.1, z0 + 0.06, '#e0d0a8', '#c8b890'); } } B.use('plain');
    }
    else if (l.id === 'secret') { for (const dx of [-0.3, 0.3]) B.geo(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 10), cx + dx, 0.4, cz, 1, 0, '#a0a0b0', 'stone'); B.use('stone').prism(cx - 0.45, cz - 0.25, cx + 0.45, cz + 0.25, 0.8, 0.3, '#808090'); B.use('plain'); }
    else if (l.id === 'dungeon3') { for (const [dx, h] of [[-0.25, 1.2], [0.25, 1.4], [0, 1.8]]) B.geo(GFX.peak(dx > 0 ? 1 : 2), cx + dx, 0, cz - 0.1, [0.22, h, 0.22], 0, '#b0643a', 'rock'); }
    else if (l.id === 'dungeon4') { B.geo(GFX.blob(11, 0.3, 1), cx, 0.1, cz, [0.5, 0.45, 0.4], 0, '#9a8a70', 'rock'); B.box(cx - 0.12, 0, cz + 0.33, cx + 0.12, 0.3, cz + 0.36, '#100804', '#100804'); }
    else if (l.id === 'dungeon1') { for (let i = 0; i < 5; i++) tree(cx + (r() - 0.5) * 0.7, cz + (r() - 0.5) * 0.5, 1.3, '#1e4a22'); B.box(cx - 0.12, 0, cz + 0.32, cx + 0.12, 0.3, cz + 0.36, '#050505', '#050505'); }
    else { B.geo(GFX.peak(3), cx, 0, cz - 0.1, [0.6, 0.9, 0.6], 0, '#8a8478', 'rock'); B.box(cx - 0.15, 0, cz + 0.32, cx + 0.15, 0.35, cz + 0.36, '#050505', '#050505'); }
  }
  B.meshes(scene);
  // grass tufts on grassy tiles
  if (tufts.length) {
    const byCol = {}; for (const t of tufts) (byCol[t[2]] = byCol[t[2]] || []).push(t);
    for (const [col, list] of Object.entries(byCol)) {
      let i = 0; const n = Math.min(9000, list.length * 3);
      scene.add(GFX.grass(n, col, () => { const t = list[i++ % list.length]; return [t[0] + (r() - 0.5) * 0.9, 0, t[1] + (r() - 0.5) * 0.9]; }, map.type === 'world' ? 0.16 : 0.22));
    }
  }
  if (waterTiles.length) {
    const WB = new GeoBuilder();
    for (const [x, y, h = 0, inset = 0] of waterTiles) WB.floor(x + inset, y + inset, h ? h : -0.08, '#ffffff');
    const g = WB.b.plain, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.p.filter((_, i) => i % 3 !== 1).map(v => v * 0.35), 2));
    dyn.waterMat = waterMaterial(map.type === 'dungeon' ? '#2a4a6a' : '#2a70b8', 1, 0.85);
    dyn.waterMesh = new THREE.Mesh(geo, dyn.waterMat); dyn.waterMesh.receiveShadow = true; scene.add(dyn.waterMesh);
  }
  for (const [cx, cz] of dyn.crystals) { const c = add(scene, new THREE.OctahedronGeometry(0.28, 0), '#60e0ff', cx, 0.7, cz, { emissive: 0x2080a0, rough: 0.15 }); dyn.crystalMeshes = (dyn.crystalMeshes || []).concat(c); const pl = new THREE.PointLight(lin('#60e0ff'), 0.8, 4); pl.position.set(cx, 1.2, cz); scene.add(pl); }
  for (const [cx, cz] of dyn.portals) { const p = add(scene, cyl(0.42, 0.42, 0.05, 20), '#a0f0ff', cx, 0.05, cz, { emissive: 0x4080c0 }); dyn.portalMeshes = (dyn.portalMeshes || []).concat(p); }
  if (map.objs) for (const o of map.objs) if (o.type === 'chest') {
    const g = pivot(scene, o.x + 0.5, 0, o.y + 0.5), wd = M.wood('#a0602a'), gold = GFX.mat('#e0c050', { metal: 0.8, rough: 0.35 });
    mesh(GFX.rbox(0.6, 0.35, 0.4, 0.03), wd, 0, 0.18, 0, 1, g); mesh(GFX.rbox(0.62, 0.05, 0.42, 0.01), gold, 0, 0.3, 0, 1, g);
    const lid = pivot(g, 0, 0.36, -0.2); mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 14, 1, false, 0, Math.PI), wd, 0, 0.0, 0.2, [1, 1, 1], lid).rotation.z = Math.PI / 2;
    mesh(GFX.rbox(0.08, 0.1, 0.03, 0.01), gold, 0, -0.02, 0.41, 1, lid);
    dyn.chests.push({ o, lid });
  }
  // lighting: the sun follows the player so shadows stay sharp near the camera
  const dark = map.type === 'dungeon', stKey = dark ? (DUNGEON_TEX[th.id] || [])[2] || 'cave' : 'grass';
  const st = STAGES[stKey], L = lightScene(scene, dark ? { ...st, li: Math.max(1.2, st.li || 1), hemi: Math.max(0.6, st.hemi || 0.5) } : { ...st, li: 2.3, hemi: 0.55 }, stKey, 10);
  dyn.sun = L.sun; dyn.sunOff = L.sun.position.clone().normalize().multiplyScalar(20);
  if (dark) { dyn.torch = new THREE.PointLight(lin('#ffd8a0'), 2.4, 12, 1.2); scene.add(dyn.torch); }
  const skyc = map.type === 'world' ? '#a8c8e8' : dark ? th.top : '#a8c8e8';
  scene.background = new THREE.Color(skyc);
  scene.fog = map.type === 'world' ? new THREE.Fog(lin(skyc), 16, 32) : dark ? new THREE.Fog(lin(th.top), 9, 18) : null;
  if (st.env != null) scene.traverse(o => { if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = st.env; });
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
    poseCharacter(pl, field.moving ? 'walk' : 'stand', field.moving ? field.walkF * 4 + (8 - field.moving) : t);
    if (m.type === 'world') pl.scale.setScalar(0.42); else pl.scale.setScalar(0.5);
    for (const n of field.npcs) {
      const look = n.cast ? CAST[n.cast].look : n.look; if (!look) continue;
      const np = this.person(n, look, n.cast, null);
      np.position.set(n.x + n.ox / 16 + 0.5, 0, n.y + n.oy / 16 + 0.5); np.rotation.y = facing[n.dir] || 0;
      poseCharacter(np, n.mv ? 'walk' : 'stand', n.mv ? t * 1.5 : t + n.x * 37);
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
    if (d.waterMat) d.waterMat.map.offset.set(t * 0.0008, t * 0.0004);
    for (const c of d.chests) c.lid.rotation.x = S.flags[c.o.key] ? -1.9 : 0;
    if (d.torch) d.torch.position.set(px, 1.6, pz + 0.3);
    if (d.sun) { d.sun.position.set(px + d.sunOff.x, d.sunOff.y, pz + d.sunOff.z); d.sun.target.position.set(px, 0, pz); d.sun.target.updateMatrixWorld(); }
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
    heroes.forEach((a, i) => { a.m.position.set(0.9 + i * 1.1, 0, 0.2 - i * 0.35); a.m.rotation.y = -0.55; });
    vs.forEach((a, i) => { a.m.position.set(-1.6 - i * 1.3, 0, -0.2 - i * 0.3); a.m.rotation.y = 0.55; a.m.scale.setScalar(1.05); });
  }
  draw(orbit = true) {
    this.t++;
    for (const a of this.actors) poseCharacter(a.m, a.id === this.speaker ? 'talk' : 'idle', this.t + a.m.position.z * 20);
    const ang = orbit ? Math.sin(this.t * 0.003) * 0.5 : 0;
    const cx = this.focusX != null ? this.focusX : this.actors.length ? this.actors.reduce((a, b) => a + b.m.position.x, 0) / this.actors.length : 0;
    this.cam.position.set(cx + Math.sin(ang) * 7.5, 2.3, Math.cos(ang) * 7.5);
    this.cam.lookAt(cx, 1.25, 0);
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
      this.cv = mkCanvas(160, 160);
      this.r = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true, preserveDrawingBuffer: true });
      this.r.outputEncoding = THREE.sRGBEncoding; this.r.toneMapping = THREE.ACESFilmicToneMapping;
      this.r.setPixelRatio(1); this.r.setSize(160, 160, false);
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.1));
      const l = new THREE.DirectionalLight(0xfff0e0, 2.2); l.position.set(2, 3, 4); this.scene.add(l);
      const rim = new THREE.DirectionalLight(0x8090ff, 1.2); rim.position.set(-3, 2, -3); this.scene.add(rim);
      this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    }
    const c = CAST[id], m = buildCharacter(c.look, id, null);
    poseCharacter(m, 'stand', 0); m.rotation.y = -0.3;
    this.scene.add(m);
    const bg = mkCanvas(2, 128), g = bg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    const dark = id.startsWith('villain'); gr.addColorStop(0, dark ? '#401020' : '#3060c0'); gr.addColorStop(1, dark ? '#100008' : '#0a1440');
    g.fillStyle = gr; g.fillRect(0, 0, 2, 128);
    const bt = new THREE.CanvasTexture(bg); bt.encoding = THREE.sRGBEncoding; this.scene.background = bt;
    this.cam.position.set(-0.2, 1.98, 1.25); this.cam.lookAt(0, 1.9, 0);
    this.r.render(this.scene, this.cam);
    this.scene.remove(m);
    const out = mkCanvas(160, 160); out.getContext('2d').drawImage(this.cv, 0, 0);
    return (this.cache[id] = out);
  }
};
