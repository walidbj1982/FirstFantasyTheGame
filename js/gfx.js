// HD graphics toolkit: procedural textures, painted sky panoramas, smooth geometry and foliage.
// Everything is generated at runtime (no image files), so the single-file bundle stays small.
'use strict';

const GFX = { tex: {}, mats: {}, geos: {}, panos: {} };

// ------------------------------------------------------------------ colour helpers
// Colours are written as sRGB hex; the renderer works in linear space with sRGB output.
function lin(c) { return new THREE.Color(c).convertSRGBToLinear(); }
function mixHex(a, b, k) { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, k).getHexString(); }

// ------------------------------------------------------------------ noise
function hash2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// tileable value noise with integer period P
function vnoise(x, y, P, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), m = a => ((a % P) + P) % P;
  const a = hash2(m(xi), m(yi), s), b = hash2(m(xi + 1), m(yi), s), c = hash2(m(xi), m(yi + 1), s), d = hash2(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, P, oct = 4, s = 0) {
  let f = 0, amp = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { f += amp * vnoise(x, y, P, s + i * 31); n += amp; x *= 2; y *= 2; P *= 2; amp *= 0.5; }
  return f / n;
}
// smooth 3D-ish noise for displacing meshes (not tileable, cheap)
function noise3(x, y, z, s = 0) {
  return (Math.sin(x * 1.7 + s) * Math.cos(y * 2.3 + s * 0.7) + Math.sin(y * 1.3 + z * 1.9 + s * 1.3) * 0.6 + Math.cos(z * 2.9 + x * 0.8 + s * 2.1) * 0.4) / 2;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ procedural textures
// Textures are mostly neutral (near-white with detail) and tinted by vertex/material colour.
function paintPixels(N, fn) {
  const c = mkCanvas(N, N), g = c.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = fn(x, y), i = (y * N + x) * 4;
    if (typeof v === 'number') { const k = clamp(v, 0, 1) * 255; d[i] = d[i + 1] = d[i + 2] = k; d[i + 3] = 255; }
    else { d[i] = clamp(v[0], 0, 1) * 255; d[i + 1] = clamp(v[1], 0, 1) * 255; d[i + 2] = clamp(v[2], 0, 1) * 255; d[i + 3] = v[3] == null ? 255 : clamp(v[3], 0, 1) * 255; }
  }
  g.putImageData(im, 0, 0); return c;
}
// draw a shape at x,y and at its wrapped copies so the texture tiles
function wrapDraw(N, x, y, m, fn) { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) if (x + dx > -m && x + dx < N + m && y + dy > -m && y + dy < N + m) fn(x + dx, y + dy); }
function voronoi(N, n, seed) {
  const r = mulberry32(seed), pts = [];
  for (let i = 0; i < n; i++) pts.push([r() * N, r() * N, r()]);
  return (x, y) => {
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (const p of pts) {
      let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]); if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = p[2]; } else if (d < d2) d2 = d;
    }
    return [d1, d2, id];
  };
}
const TEXTURES = {
  grass(N = 256) {
    const c = paintPixels(N, (x, y) => 0.62 + fbm(x / N * 6, y / N * 6, 6, 4, 3) * 0.32 + (hash2(x, y, 9) - 0.5) * 0.08);
    const g = c.getContext('2d'), r = mulberry32(11);
    for (let i = 0; i < 2600; i++) {
      const x = r() * N, y = r() * N, l = 3 + r() * 6, a = -Math.PI / 2 + (r() - 0.5) * 1.1, k = r();
      g.strokeStyle = k < 0.5 ? `rgba(255,255,235,${0.25 + r() * 0.3})` : `rgba(20,30,10,${0.18 + r() * 0.25})`; g.lineWidth = 1;
      wrapDraw(N, x, y, 10, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); });
    }
    return c;
  },
  sand(N = 256) {
    return paintPixels(N, (x, y) => {
      const n = fbm(x / N * 4, y / N * 4, 4, 4, 5), rip = Math.sin((y / N * 18 + n * 3) * Math.PI * 2) * 0.03;
      return 0.8 + n * 0.16 + rip + (hash2(x, y, 2) - 0.5) * 0.12;
    });
  },
  dirt(N = 256) {
    const c = paintPixels(N, (x, y) => 0.6 + fbm(x / N * 5, y / N * 5, 5, 5, 8) * 0.38 + (hash2(x, y, 4) - 0.5) * 0.1);
    const g = c.getContext('2d'), r = mulberry32(21);
    for (let i = 0; i < 260; i++) {
      const x = r() * N, y = r() * N, s = 1 + r() * 3.5, l = r() < 0.5 ? 255 : 40;
      g.fillStyle = `rgba(${l},${l},${l * 0.9},${0.15 + r() * 0.25})`;
      wrapDraw(N, x, y, 6, (px, py) => { g.beginPath(); g.ellipse(px, py, s, s * 0.7, r() * 3, 0, 7); g.fill(); });
    }
    return c;
  },
  rock(N = 256) {
    const c = paintPixels(N, (x, y) => {
      const n = fbm(x / N * 4, y / N * 4, 4, 5, 13), rd = 1 - Math.abs(fbm(x / N * 3, y / N * 3, 3, 4, 17) - 0.5) * 2;
      return 0.5 + n * 0.4 + Math.pow(rd, 8) * -0.25 + (hash2(x, y, 6) - 0.5) * 0.08;
    });
    const g = c.getContext('2d'), r = mulberry32(31);
    for (let i = 0; i < 22; i++) {
      let x = r() * N, y = r() * N; g.strokeStyle = `rgba(0,0,0,${0.25 + r() * 0.3})`; g.lineWidth = 1 + r();
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 22; y += (r() - 0.3) * 16; g.lineTo(x, y); }
      g.stroke();
    }
    return c;
  },
  cobble(N = 256) {
    const V = voronoi(N, 46, 77);
    return paintPixels(N, (x, y) => {
      const [d1, d2, id] = V(x, y), e = d2 - d1, n = fbm(x / N * 8, y / N * 8, 8, 3, 3);
      if (e < 1.6) return 0.6 + n * 0.12;
      const bevel = smooth(1.6, 6, e);
      return (0.8 + id * 0.16 + n * 0.1) * (0.9 + bevel * 0.1);
    });
  },
  plaster(N = 256) {
    return paintPixels(N, (x, y) => 0.9 + fbm(x / N * 5, y / N * 5, 5, 5, 41) * 0.12 - Math.pow(fbm(x / N * 2, y / N * 2, 2, 3, 43), 3) * 0.12 + (hash2(x, y, 7) - 0.5) * 0.05);
  },
  stone(N = 256) { // ashlar blocks, used for the theater and shrines
    const r = mulberry32(55), rows = 4, rh = N / rows, joints = [];
    for (let j = 0; j < rows; j++) { const xs = [0]; let x = 0; while (x < N - 40) { x += 50 + r() * 50; if (x > N - 30) break; xs.push(x); } joints.push({ xs, off: r() * N, tone: [] }); for (let k = 0; k < 12; k++) joints[j].tone.push(r()); }
    return paintPixels(N, (x, y) => {
      const j = Math.floor(y / rh), row = joints[j], xx = (x + row.off) % N, yy = y - j * rh;
      let k = 0; for (let i = 0; i < row.xs.length; i++) if (xx >= row.xs[i]) k = i;
      const dx = Math.min(Math.abs(xx - row.xs[k]), Math.abs(xx - (row.xs[k + 1] || N))), dy = Math.min(yy, rh - yy);
      const n = fbm(x / N * 6, y / N * 6, 6, 4, 61);
      if (dx < 1.6 || dy < 1.6) return 0.42 + n * 0.12;
      return (0.72 + row.tone[k] * 0.2 + n * 0.16) * (0.88 + smooth(1.6, 6, Math.min(dx, dy)) * 0.12) - (hash2(x, y, 3) < 0.004 ? 0.25 : 0);
    });
  },
  wood(N = 256) {
    return paintPixels(N, (x, y) => {
      const plank = Math.floor(y / (N / 6)), yy = y % (N / 6), n = fbm(x / N * 2, y / N * 24, 2, 4, 70 + plank);
      const grain = Math.sin((y / N * 60 + n * 6 + plank * 3) * 1.0) * 0.06;
      if (yy < 1.5) return 0.3;
      return 0.62 + hash2(plank, 0, 3) * 0.15 + n * 0.22 + grain;
    });
  },
  bark(N = 128) {
    return paintPixels(N, (x, y) => {
      const n = fbm(x / N * 16, y / N * 2, 16, 4, 81), f = Math.pow(Math.abs(Math.sin((x / N * 10 + n * 2) * Math.PI)), 0.5);
      return 0.35 + f * 0.45 + n * 0.2;
    });
  },
  leaves(N = 256) {
    const c = paintPixels(N, (x, y) => 0.22 + fbm(x / N * 6, y / N * 6, 6, 3, 91) * 0.25);
    const g = c.getContext('2d'), r = mulberry32(93);
    for (let i = 0; i < 1800; i++) {
      const x = r() * N, y = r() * N, s = 2 + r() * 4, l = Math.floor(120 + r() * 135), a = r() * Math.PI;
      g.fillStyle = `rgb(${l},${l},${Math.floor(l * 0.92)})`;
      wrapDraw(N, x, y, 8, (px, py) => { g.beginPath(); g.ellipse(px, py, s, s * 0.45, a, 0, 7); g.fill(); });
    }
    return c;
  },
  frond(N = 128) { // palm leaf with alpha, the rib runs down the middle (v = along the leaf)
    const c = mkCanvas(64, 256), g = c.getContext('2d');
    g.strokeStyle = '#d8d8c0'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
    for (let y = 8; y < 250; y += 5) {
      const w = 30 * Math.sin(Math.PI * Math.min(1, y / 230)) + 2, l = 150 + (y * 7 % 60);
      g.strokeStyle = `rgb(${l},${l},${l - 20})`; g.lineWidth = 3;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(32, y); g.quadraticCurveTo(32 + s * w * 0.5, y + 4, 32 + s * w, y + 12); g.stroke(); }
    }
    return c;
  },
  tuft(N = 128) { // a clump of grass blades with alpha
    const c = mkCanvas(N, N), g = c.getContext('2d'), r = mulberry32(101);
    for (let i = 0; i < 40; i++) {
      const x0 = N / 2 + (r() - 0.5) * N * 0.5, h = N * (0.45 + r() * 0.5), lean = (r() - 0.5) * N * 0.5, l = Math.floor(190 + r() * 65);
      const gr = g.createLinearGradient(0, N, 0, N - h); gr.addColorStop(0, `rgb(${l * 0.75},${l * 0.75},${l * 0.7})`); gr.addColorStop(1, `rgb(${l},${l},${l * 0.85})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 2.5, N); g.quadraticCurveTo(x0 + lean * 0.3, N - h * 0.6, x0 + lean, N - h); g.quadraticCurveTo(x0 + lean * 0.3 + 1, N - h * 0.6, x0 + 2.5, N); g.fill();
    }
    return c;
  },
  water(N = 256) {
    return paintPixels(N, (x, y) => {
      const a = fbm(x / N * 4, y / N * 4, 4, 4, 111), b = fbm(x / N * 4 + 3.3, y / N * 4 + 1.7, 4, 4, 113);
      const caus = Math.pow(1 - Math.abs(a - b) * 2.2, 10);
      return 0.72 + caus * 0.35 + a * 0.12;
    });
  },
  fabric(N = 128) {
    return paintPixels(N, (x, y) => 0.88 + ((x + y) % 4 < 2 ? 0.04 : -0.02) + ((x - y + 256) % 4 < 2 ? 0.02 : 0) + fbm(x / N * 4, y / N * 4, 4, 3, 121) * 0.1);
  },
  denim(N = 128) {
    return paintPixels(N, (x, y) => {
      const tw = ((x + y * 2) % 6 < 3) ? 0.06 : -0.04, n = fbm(x / N * 3, y / N * 12, 3, 4, 131);
      const w = 0.78 + tw + n * 0.2 + (hash2(x, y, 5) - 0.5) * 0.1;
      return [w * 0.98, w * 0.99, w];
    });
  },
  hide(N = 256) { // creature skin: mottled with faint scales
    const V = voronoi(N, 160, 141);
    return paintPixels(N, (x, y) => { const [d1, d2] = V(x, y), e = d2 - d1; return 0.66 + fbm(x / N * 5, y / N * 5, 5, 4, 143) * 0.3 + smooth(0, 3, e) * 0.08 - 0.04; });
  },
  hair(N = 128) { // strands running from the crown down (v)
    return paintPixels(N, (x, y) => 0.7 + fbm(x / N * 32, y / N * 1.5, 32, 3, 171) * 0.3 + Math.sin(x / N * Math.PI * 64) * 0.03);
  },
  skin(N = 128) { return paintPixels(N, (x, y) => 0.93 + fbm(x / N * 8, y / N * 8, 8, 3, 181) * 0.07 + (hash2(x, y, 4) - 0.5) * 0.03); },
  quilt(N = 128) { // puffer-vest bands: soft horizontal pillows with stitched seams
    return paintPixels(N, (x, y) => {
      const v = (y / N * 8) % 1, puff = Math.sin(v * Math.PI), wr = fbm(x / N * 6, y / N * 6, 6, 3, 191);
      return (0.55 + puff * 0.42 + (wr - 0.5) * 0.12) * (v < 0.04 || v > 0.96 ? 0.7 : 1) + Math.pow(puff, 8) * 0.08;
    });
  },
  leather(N = 128) { return paintPixels(N, (x, y) => 0.78 + fbm(x / N * 10, y / N * 10, 10, 4, 201) * 0.22 - Math.pow(Math.abs(fbm(x / N * 4, y / N * 4, 4, 3, 203) - 0.5) * 2, 6) * 0.2); },
  leafcard(N = 128) { // a clump of leaves with alpha, for fluffy tree silhouettes
    const c = mkCanvas(N, N), g = c.getContext('2d'), r = mulberry32(211);
    for (let i = 0; i < 140; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * N * 0.42, x = N / 2 + Math.cos(a) * d, y = N / 2 + Math.sin(a) * d, l = Math.floor(120 + r() * 135);
      g.fillStyle = `rgb(${l},${l},${Math.floor(l * 0.9)})`; g.beginPath(); g.ellipse(x, y, 3 + r() * 4, 1.5 + r() * 2, r() * 3, 0, 7); g.fill();
    }
    return c;
  },
  spark(N = 64) { const c = mkCanvas(N, N), g = c.getContext('2d'), gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); return c; },
  metal(N = 128) {
    return paintPixels(N, (x, y) => 0.82 + fbm(x / N * 32, y / N * 2, 32, 3, 151) * 0.18);
  },
  roof(N = 256) { // terracotta tile rows
    return paintPixels(N, (x, y) => {
      const row = Math.floor(y / 32), yy = y % 32, xx = (x + (row % 2) * 16) % 32;
      const curve = Math.cos((xx / 32 - 0.5) * Math.PI), n = fbm(x / N * 6, y / N * 6, 6, 3, 161);
      return (0.55 + curve * 0.35 + n * 0.12) * (yy < 3 ? 0.6 : 1);
    });
  }
};
// get (and cache) a tiling texture
GFX.texture = function (name) {
  if (this.tex[name]) return this.tex[name];
  const t = new THREE.CanvasTexture(TEXTURES[name]());
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
  t.anisotropy = R3.renderer ? Math.min(8, R3.renderer.capabilities.getMaxAnisotropy()) : 1;
  return (this.tex[name] = t);
};

// ------------------------------------------------------------------ materials
// key-cached MeshStandardMaterials. o: tex, rough, metal, vc (vertex colours), alpha, side, emissive, opacity, repeat
GFX.mat = function (color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  if (this.mats[key]) return this.mats[key];
  const m = new THREE.MeshStandardMaterial({
    color: o.vc ? 0xffffff : lin(color), roughness: o.rough != null ? o.rough : 0.88, metalness: o.metal || 0,
    vertexColors: !!o.vc, side: o.side || THREE.FrontSide, transparent: !!o.opacity, opacity: o.opacity || 1,
    emissive: o.emissive != null ? lin(o.emissive) : new THREE.Color(0), alphaTest: o.alpha ? 0.5 : 0
  });
  if (o.tex) { m.map = o.repeat ? this.texture(o.tex).clone() : this.texture(o.tex); if (o.repeat) { m.map.needsUpdate = true; m.map.repeat.set(o.repeat[0], o.repeat[1]); } }
  m.envMapIntensity = o.envI != null ? o.envI : 0.65;
  return (this.mats[key] = m);
};

// ------------------------------------------------------------------ smooth geometry
// rounded box: a subdivided box whose corners are pushed onto spheres
GFX.rbox = function (w, h, d, rad, seg = 3) {
  const key = ['rb', w, h, d, rad, seg].join();
  if (this.geos[key]) return this.geos[key];
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hx = Math.max(0, w / 2 - rad), hy = Math.max(0, h / 2 - rad), hz = Math.max(0, d / 2 - rad);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    const dl = v.clone().sub(c); if (dl.lengthSq() < 1e-9) dl.fromBufferAttribute(n, i);
    dl.normalize(); p.setXYZ(i, c.x + dl.x * rad, c.y + dl.y * rad, c.z + dl.z * rad); n.setXYZ(i, dl.x, dl.y, dl.z);
  }
  return (this.geos[key] = g);
};
// capsule along y, from y=0 down to y=-len (top cap centred at 0)
GFX.capsule = function (r, len, r2 = r, seg = 14) {
  const key = ['cap', r, len, r2, seg].join();
  if (this.geos[key]) return this.geos[key];
  const pts = [], n = 6;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r2 + 1e-4, -len + Math.sin(a) * r2)); }
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r + 1e-4, Math.sin(a) * r)); }
  return (this.geos[key] = new THREE.LatheGeometry(pts, seg));
};
GFX.lathe = function (key, pts, seg = 20, phiStart = 0, phiLen = Math.PI * 2) {
  key = 'la' + key + seg + phiStart + phiLen;
  return this.geos[key] || (this.geos[key] = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x + 1e-4, y)), seg, phiStart, phiLen));
};
GFX.sphere = function (r, ws = 20, hs = 14, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) {
  const key = ['sp', r, ws, hs, ps, pl, ts, tl].join();
  return this.geos[key] || (this.geos[key] = new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl));
};
// lumpy sphere for bushes, canopies and rocks
GFX.blob = function (variant = 0, rough = 0.22, det = 2) {
  const key = ['blob', variant, rough, det].join();
  if (this.geos[key]) return this.geos[key];
  const g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const k = 1 + noise3(v.x * 2.2, v.y * 2.2, v.z * 2.2, variant * 3.1) * rough + noise3(v.x * 5, v.y * 5, v.z * 5, variant + 7) * rough * 0.35;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  // IcosahedronGeometry is non-indexed: merge by position so normals come out smooth
  const merged = mergeVerts(g); merged.computeVertexNormals();
  // spherical UVs
  const mp = merged.attributes.position, uv = [];
  for (let i = 0; i < mp.count; i++) { v.fromBufferAttribute(mp, i).normalize(); uv.push(Math.atan2(v.z, v.x) / Math.PI + 1, v.y * 0.5 + 0.5); }
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return (this.geos[key] = merged);
};
function mergeVerts(g) {
  const p = g.attributes.position, map = new Map(), idx = [], pos = [];
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    let j = map.get(k); if (j == null) { j = pos.length / 3; map.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
    idx.push(j);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out;
}
// tapered, gently curved trunk
GFX.trunk = function (r0, r1, h, bend = 0, seg = 8) {
  const key = ['tr', r0, r1, h, bend, seg].join();
  if (this.geos[key]) return this.geos[key];
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 8, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = p.getY(i) / h + 0.5; p.setX(i, p.getX(i) + bend * k * k); p.setY(i, p.getY(i) + h / 2); }
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * h);
  return (this.geos[key] = g);
};
// a palm frond: a strip drooping along its length
GFX.frondGeo = function () {
  if (this.geos.frond) return this.geos.frond;
  const g = new THREE.PlaneGeometry(0.7, 2.6, 1, 10); g.translate(0, 1.3, 0); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = -p.getZ(i), k = z / 2.6; p.setY(i, Math.sin(k * 1.6) * 0.9 - k * k * 1.6 - Math.abs(p.getX(i)) * 0.3); p.setZ(i, -z * (1 - k * 0.15)); }
  g.computeVertexNormals();
  return (this.geos.frond = g);
};
// two crossed quads for a grass tuft (base at y=0)
GFX.tuftGeo = function () {
  if (this.geos.tuft) return this.geos.tuft;
  const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0);
  const pos = [], uv = [], nor = [];
  for (const rot of [0, Math.PI / 2]) {
    const b = a.clone(); b.rotateY(rot); const ni = b.toNonIndexed();
    pos.push(...ni.attributes.position.array); uv.push(...ni.attributes.uv.array);
    for (let i = 0; i < ni.attributes.position.count; i++) nor.push(0, 1, 0); // up-facing normals light the tuft like the ground
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return (this.geos.tuft = g);
};

// ------------------------------------------------------------------ foliage & props (THREE.Group, feet at y=0)
const M = {
  bark: () => GFX.mat('#7a6048', { tex: 'bark' }), darkbark: () => GFX.mat('#4a3a2a', { tex: 'bark' }),
  leaf: c => GFX.mat(c, { tex: 'leaves', rough: 0.8 }), rock: c => GFX.mat(c, { tex: 'rock', rough: 0.95 }),
  stone: c => GFX.mat(c, { tex: 'stone' }), plaster: c => GFX.mat(c, { tex: 'plaster', rough: 0.95 }),
  wood: c => GFX.mat(c, { tex: 'wood', rough: 0.8 })
};
function mesh(geo, material, x = 0, y = 0, z = 0, s = 1, parent) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z);
  if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]); else m.scale.setScalar(s);
  m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
const PROPS = {
  // Mediterranean stone pine: tall leaning trunk, flat umbrella crown
  umbrellaPine(r) {
    const g = new THREE.Group(), bend = (r() - 0.5) * 1.2, h = 4.2 + r() * 1.5;
    mesh(GFX.trunk(0.22, 0.13, h, bend), M.bark(), 0, 0, 0, 1, g);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + r(), d = i ? 0.9 + r() * 0.5 : 0;
      mesh(GFX.blob(i % 4, 0.25), M.leaf(i % 2 ? '#3f6a2c' : '#4a7832'), bend + Math.cos(a) * d, h + 0.2 + r() * 0.3, Math.sin(a) * d, [1.3 + r() * 0.4, 0.55, 1.3 + r() * 0.4], g);
    }
    GFX.leafCards(g, bend, h + 0.35, 0, 2.0, 0.55, 2.0, '#4a7832', 22, r);
    return g;
  },
  cypress(r) {
    const g = new THREE.Group(), h = 4 + r() * 2.5;
    mesh(GFX.trunk(0.1, 0.08, 0.6), M.darkbark(), 0, 0, 0, 1, g);
    mesh(GFX.blob(Math.floor(r() * 4), 0.12), M.leaf('#22442a'), 0, h * 0.5 + 0.3, 0, [0.55, h * 0.5, 0.55], g);
    return g;
  },
  olive(r) {
    const g = new THREE.Group(), b = (r() - 0.5) * 0.6;
    mesh(GFX.trunk(0.22, 0.14, 1.4, b), M.bark(), 0, 0, 0, 1, g);
    mesh(GFX.trunk(0.12, 0.07, 1.0, -b), M.bark(), b, 1.2, 0, 1, g).rotation.z = 0.5;
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + r(); mesh(GFX.blob(i, 0.28), M.leaf(i % 2 ? '#7c8a5a' : '#6a7a4c'), b + Math.cos(a) * 0.6, 1.9 + r() * 0.5, Math.sin(a) * 0.6, 0.85 + r() * 0.3, g); }
    GFX.leafCards(g, b, 2.1, 0, 1.4, 0.9, 1.4, '#7c8a5a', 18, r);
    return g;
  },
  palm(r) {
    const g = new THREE.Group(), bend = 0.6 + r() * 0.9, h = 4.5 + r() * 2;
    const t = mesh(GFX.trunk(0.2, 0.13, h, bend, 9), GFX.mat('#9a7a52', { tex: 'bark', repeat: [1, 3] }), 0, 0, 0, 1, g);
    t.material.map.repeat.set(1, 4);
    const fm = GFX.mat('#4c8a34', { tex: 'frond', alpha: true, side: THREE.DoubleSide, rough: 0.7 });
    for (let i = 0; i < 9; i++) { const f = mesh(GFX.frondGeo(), fm, bend, h, 0, 0.9 + r() * 0.3, g); f.rotation.y = i / 9 * Math.PI * 2 + r() * 0.3; f.rotation.x = -0.2 + r() * 0.3; f.castShadow = true; }
    for (let i = 0; i < 4; i++) mesh(GFX.sphere(0.1, 8, 6), GFX.mat('#5a4020'), bend + Math.cos(i * 1.6) * 0.15, h - 0.12, Math.sin(i * 1.6) * 0.15, 1, g);
    return g;
  },
  forestTree(r) { // tall dark tree for the night forest
    const g = new THREE.Group(), h = 6 + r() * 4;
    mesh(GFX.trunk(0.28, 0.12, h, (r() - 0.5) * 0.5), M.darkbark(), 0, 0, 0, 1, g);
    for (let i = 0; i < 4; i++) mesh(GFX.blob(i, 0.3), M.leaf(i % 2 ? '#1a3420' : '#22402a'), (r() - 0.5) * 0.8, h * (0.55 + i * 0.13), (r() - 0.5) * 0.8, [1.6 - i * 0.25, 1.2, 1.6 - i * 0.25], g);
    GFX.leafCards(g, 0, h * 0.72, 0, 1.6, h * 0.25, 1.6, '#22402a', 16, r);
    return g;
  },
  deadTree(r) {
    const g = new THREE.Group(), h = 3 + r() * 2;
    mesh(GFX.trunk(0.2, 0.08, h, 0.3), M.darkbark(), 0, 0, 0, 1, g);
    for (let i = 0; i < 4; i++) { const b = mesh(GFX.trunk(0.07, 0.02, 1.4, 0.2), M.darkbark(), 0.2, h * (0.5 + i * 0.12), 0, 1, g); b.rotation.set(r() - 0.5, i * 1.7, 0.8 + r() * 0.5); }
    return g;
  },
  bush(r, col = '#4a6a34') { const g = new THREE.Group(); for (let i = 0; i < 3; i++) mesh(GFX.blob(i, 0.3), M.leaf(col), (r() - 0.5) * 0.8, 0.35, (r() - 0.5) * 0.8, 0.45 + r() * 0.3, g); GFX.leafCards(g, 0, 0.4, 0, 0.75, 0.4, 0.75, col, 8, r); return g; },
  rock(r, col = '#8a8478', s = 1) {
    const g = new THREE.Group();
    mesh(GFX.blob(Math.floor(r() * 4) + 10, 0.35, 1), M.rock(col), 0, 0.15 * s, 0, [s * (0.8 + r() * 0.6), s * (0.5 + r() * 0.4), s * (0.8 + r() * 0.6)], g).rotation.y = r() * 6;
    return g;
  },
  column(r, h = 5, broken = false, col = '#e8dcc0') {
    const g = new THREE.Group(), hh = broken ? h * (0.3 + r() * 0.5) : h;
    mesh(GFX.rbox(1.2, 0.35, 1.2, 0.04), M.stone(col), 0, 0.17, 0, 1, g);
    const shaft = new THREE.CylinderGeometry(0.42, 0.48, hh, 18, 1); // fluting via flat facets
    mesh(shaft, M.stone(col), 0, 0.35 + hh / 2, 0, 1, g);
    if (!broken) { mesh(GFX.rbox(1.25, 0.32, 1.25, 0.04), M.stone(col), 0, 0.35 + hh + 0.16, 0, 1, g); mesh(new THREE.CylinderGeometry(0.62, 0.45, 0.25, 18), M.stone(col), 0, 0.35 + hh - 0.05, 0, 1, g); }
    return g;
  },
  tomb(r) {
    const g = new THREE.Group(), col = mixHex('#8a8a90', '#6a6a60', r());
    if (r() < 0.6) { mesh(GFX.rbox(0.8, 1.2, 0.22, 0.06), M.stone(col), 0, 0.55, 0, 1, g).rotation.z = (r() - 0.5) * 0.2; mesh(GFX.rbox(1, 0.12, 0.5, 0.03), M.stone(col), 0, 0.05, 0.1, 1, g); }
    else { mesh(GFX.rbox(0.16, 1.6, 0.16, 0.03), M.stone(col), 0, 0.8, 0, 1, g); mesh(GFX.rbox(0.8, 0.16, 0.16, 0.03), M.stone(col), 0, 1.15, 0, 1, g); }
    return g;
  },
  pot(r, plant = true) {
    const g = new THREE.Group();
    mesh(GFX.lathe('pot', [[0, 0], [0.18, 0], [0.26, 0.2], [0.28, 0.42], [0.24, 0.5], [0.27, 0.53], [0.22, 0.55], [0.2, 0.45]], 16), GFX.mat('#b8603a', { tex: 'plaster' }), 0, 0, 0, 1, g);
    if (plant) mesh(GFX.blob(Math.floor(r() * 4), 0.35), M.leaf(r() < 0.5 ? '#3a7a30' : '#4a8a3a'), 0, 0.7, 0, 0.36, g);
    if (plant && r() < 0.6) for (let i = 0; i < 6; i++) mesh(GFX.sphere(0.05, 6, 4), GFX.mat(r() < 0.5 ? '#e04080' : '#f0f0f0'), (r() - 0.5) * 0.5, 0.65 + r() * 0.3, (r() - 0.5) * 0.5, 1, g);
    return g;
  }
};
GFX.props = PROPS;

// instanced grass tufts scattered by a placement function -> InstancedMesh
GFX.grass = function (n, tint, place, size = 0.6) {
  const m = new THREE.InstancedMesh(GFX.tuftGeo(), GFX.mat(tint, { tex: 'tuft', alpha: true, side: THREE.DoubleSide, rough: 1 }), n);
  const o = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const p = place(); if (!p) continue;
    o.position.set(p[0], p[1] || 0, p[2]); o.rotation.set(0, Math.random() * 3, 0); const s = size * (0.6 + Math.random() * 0.8); o.scale.set(s, s * (0.7 + Math.random() * 0.6), s);
    o.updateMatrix(); m.setMatrixAt(k++, o.matrix);
  }
  m.count = k; m.receiveShadow = true; return m;
};
// instanced flowers: little coloured spheres
GFX.flowers = function (n, cols, place) {
  const m = new THREE.InstancedMesh(GFX.sphere(0.06, 6, 4), GFX.mat('#ffffff', { rough: 0.6 }), n), o = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const p = place(); if (!p) continue;
    o.position.set(p[0], (p[1] || 0) + 0.12 + Math.random() * 0.1, p[2]); o.scale.setScalar(0.7 + Math.random() * 0.8); o.updateMatrix(); m.setMatrixAt(k, o.matrix);
    m.setColorAt(k++, lin(cols[Math.floor(Math.random() * cols.length)]));
  }
  m.count = k; return m;
};

// ------------------------------------------------------------------ painted sky panoramas (equirectangular)
// u = longitude around the stage, horizon at the vertical middle. Layers are painted back to front.
GFX.panorama = function (key, P) {
  if (this.panos[key]) return this.panos[key];
  const W = 1024, H = 512, HZ = H / 2, c = mkCanvas(W, H), g = c.getContext('2d'), r = mulberry32(hashStr(key) + 5);
  let gr = g.createLinearGradient(0, 0, 0, HZ);
  gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.7, mixHex(P.sky[0], P.sky[1], 0.75)); gr.addColorStop(1, P.sky[1]);
  g.fillStyle = gr; g.fillRect(0, 0, W, HZ + 2);
  g.fillStyle = P.haze; g.fillRect(0, HZ, W, H - HZ);
  // stars and moon
  if (P.stars) {
    for (let i = 0; i < 700; i++) { const y = Math.pow(r(), 1.6) * HZ * 0.95, a = 0.3 + r() * 0.7; g.fillStyle = `rgba(255,255,${200 + r() * 55},${a * (1 - y / HZ)})`; g.fillRect(r() * W, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
  }
  // sun / moon glow
  if (P.sun) {
    const [su, el, col, size] = P.sun, sx = su * W, sy = HZ - el / (Math.PI / 2) * HZ;
    for (const dx of [-W, 0, W]) {
      gr = g.createRadialGradient(sx + dx, sy, 0, sx + dx, sy, size * 9); gr.addColorStop(0, col); gr.addColorStop(0.15, col.length > 7 ? col : col + '80'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.globalAlpha = 0.55; g.fillRect(sx + dx - size * 9, sy - size * 9, size * 18, size * 18); g.globalAlpha = 1;
      g.fillStyle = P.moon ? '#f4f0e0' : '#fffbe8'; g.beginPath(); g.arc(sx + dx, sy, size, 0, 7); g.fill();
      if (P.moon) { g.fillStyle = 'rgba(160,160,150,0.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(sx + dx + (r() - 0.5) * size, sy + (r() - 0.5) * size, size * (0.1 + r() * 0.2), 0, 7); g.fill(); } }
    }
  }
  // clouds: soft fbm, denser toward the horizon
  if (P.clouds) {
    const cw = 256, ch = 64, cc = mkCanvas(cw, ch), cg = cc.getContext('2d'), im = cg.createImageData(cw, ch), d = im.data;
    const [cr, cgc, cb] = P.cloudCol || [255, 255, 255];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const v = y / ch, n = fbm(x / cw * 8, y / ch * 3, 8, 5, 7 + key.length), a = smooth(0.52 - P.clouds * 0.12, 0.72, n) * smooth(0.05, 0.6, v) * (1 - smooth(0.92, 1, v));
      const shadeK = 0.82 + (1 - v) * 0.18 - (n - 0.6) * 0.3, i = (y * cw + x) * 4;
      d[i] = cr * shadeK; d[i + 1] = cgc * shadeK; d[i + 2] = cb * shadeK; d[i + 3] = a * 235;
    }
    cg.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(cc, 0, HZ * 0.25, W, HZ * 0.73);
  }
  // silhouette layers
  const ridge = (base, amp, freq, seed, col, topCol) => {
    const pts = [];
    for (let x = 0; x <= W; x += 2) pts.push([x, HZ - (base + amp * fbm(x / W * freq, seed, freq, 4, seed)) * HZ]);
    gr = g.createLinearGradient(0, HZ - (base + amp) * HZ, 0, HZ); gr.addColorStop(0, topCol || col); gr.addColorStop(1, mixHex(col, P.haze, 0.35));
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, HZ + 1); for (const p of pts) g.lineTo(p[0], p[1]); g.lineTo(W, HZ + 1); g.fill();
    return x => pts[clamp(Math.round(x / 2), 0, pts.length - 1)][1];
  };
  for (const L of P.layers || []) {
    switch (L[0]) {
      case 'mountains': ridge(0.05, L[2] || 0.22, 6, 3, mixHex(L[1], P.haze, 0.55)); ridge(0.02, (L[2] || 0.22) * 0.7, 9, 5, mixHex(L[1], P.haze, 0.35)); break;
      case 'hills': { const y = ridge(0.01, L[2] || 0.07, 7, 11, L[1]); if (L[3]) village(y, L[3]); break; }
      case 'treeline': {
        for (let row = 0; row < 3; row++) {
          const col = mixHex(L[1], P.haze, 0.5 - row * 0.22); g.fillStyle = col;
          for (let x = -10; x < W + 10; x += 5 + r() * 6) { const h = (0.06 + r() * 0.1 + row * 0.03) * HZ, w = 6 + r() * 8; g.beginPath(); g.moveTo(x - w, HZ + 1); g.lineTo(x, HZ - h); g.lineTo(x + w, HZ + 1); g.fill(); }
        }
        break;
      }
      case 'mesas': {
        for (let row = 0; row < 2; row++) {
          let x = r() * 60;
          while (x < W) {
            const w = 40 + r() * 120, h = (0.06 + r() * 0.16) * HZ * (row ? 1.2 : 0.8), col = mixHex(L[1], P.haze, row ? 0.25 : 0.55);
            g.fillStyle = col; g.beginPath(); g.moveTo(x - 14, HZ + 1); g.lineTo(x, HZ - h); g.lineTo(x + w, HZ - h); g.lineTo(x + w + 14, HZ + 1); g.fill();
            g.fillStyle = 'rgba(0,0,0,0.12)'; for (let s = 1; s < 4; s++) g.fillRect(x - 4, HZ - h + s * h / 4, w + 8, 2);
            x += w + 20 + r() * 80;
          }
        }
        break;
      }
      case 'sea': {
        gr = g.createLinearGradient(0, HZ, 0, H); gr.addColorStop(0, mixHex(L[1], P.haze, 0.4)); gr.addColorStop(0.3, L[1]); gr.addColorStop(1, shade(L[1], -0.3));
        g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
        g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 400; i++) { const y = HZ + Math.pow(r(), 2) * 60; g.fillRect(r() * W, y, 2 + r() * 6 * (y - HZ) / 20, 1); }
        break;
      }
      case 'islands': for (let i = 0; i < 3; i++) { const x = r() * W, w = 30 + r() * 90, h = 6 + r() * 16; g.fillStyle = mixHex(L[1], P.haze, 0.45); g.beginPath(); g.ellipse(x, HZ + 1, w, h, 0, Math.PI, 0); g.fill(); } break;
      case 'ruins': { // arches and columns of the old theater on the skyline
        g.fillStyle = mixHex(L[1], P.haze, 0.3);
        for (let k = 0; k < 2; k++) {
          const x0 = r() * W, n = 4 + Math.floor(r() * 5), aw = 22, ah = 40;
          for (let i = 0; i < n; i++) { const x = x0 + i * aw; g.fillRect(x, HZ - ah, 5, ah); g.fillRect(x - 2, HZ - ah - 6, aw + 4, 7); }
          g.save(); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < n - 1; i++) { g.beginPath(); g.arc(x0 + i * aw + 5 + (aw - 5) / 2, HZ - ah + 8, (aw - 5) / 2, Math.PI, 0); g.fill(); } g.restore();
        }
        for (let i = 0; i < 18; i++) { const x = r() * W, h = 20 + r() * 26; g.fillStyle = mixHex('#1e3a22', P.haze, 0.35); g.beginPath(); g.ellipse(x, HZ - h / 2, 3 + r() * 2, h / 2, 0, 0, 7); g.fill(); }
        break;
      }
      case 'graves': for (let i = 0; i < 60; i++) {
        const x = r() * W, h = 6 + r() * 10; g.fillStyle = L[1];
        if (r() < 0.5) { g.fillRect(x, HZ - h, 2, h); g.fillRect(x - 3, HZ - h * 0.75, 8, 2); } else { g.beginPath(); g.ellipse(x, HZ - h, 3, h * 1.6, 0, 0, 7); g.fill(); }
      } break;
      case 'cave': {
        const cg = mkCanvas(256, 128), cx = cg.getContext('2d'), im = cx.createImageData(256, 128);
        for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) { const n = fbm(x / 256 * 8, y / 128 * 4, 8, 5, 3), i = (y * 256 + x) * 4, l = 0.08 + n * 0.25; im.data[i] = l * 120; im.data[i + 1] = l * 135; im.data[i + 2] = l * 150; im.data[i + 3] = 255; }
        cx.putImageData(im, 0, 0); g.drawImage(cg, 0, 0, W, HZ);
        g.fillStyle = '#0a1014'; for (let i = 0; i < 80; i++) { const x = r() * W, w = 4 + r() * 10, h = 20 + r() * 80; g.beginPath(); g.moveTo(x - w, 0); g.lineTo(x, h); g.lineTo(x + w, 0); g.fill(); }
        ridge(0.02, 0.2, 10, 9, '#141c22'); break;
      }
    }
  }
  function village(ridgeY, cols) { // whitewashed houses with blue doors and domes on a hillside
    for (let k = 0; k < 3; k++) {
      const x0 = r() * W, n = 6 + Math.floor(r() * 10);
      for (let i = 0; i < n; i++) {
        const x = x0 + (r() - 0.5) * 90, y = ridgeY(((x % W) + W) % W) + 2 + r() * 8, w = 5 + r() * 9, h = 4 + r() * 7;
        g.fillStyle = mixHex('#f4f2ec', P.haze, 0.25); g.fillRect(x, y - h, w, h + 6);
        g.fillStyle = mixHex(cols, P.haze, 0.3); if (r() < 0.25) { g.beginPath(); g.arc(x + w / 2, y - h, w / 2.4, Math.PI, 0); g.fill(); } else g.fillRect(x + w * 0.4, y - h * 0.5, 1.5, h * 0.5);
      }
    }
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.mapping = THREE.EquirectangularReflectionMapping;
  return (this.panos[key] = t);
};
// image-based lighting from the panorama (cached per stage)
GFX.envFor = function (key, pano) {
  this.envs = this.envs || {};
  if (this.envs[key]) return this.envs[key];
  if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(R3.renderer);
  return (this.envs[key] = this.pmrem.fromEquirectangular(pano).texture);
};
// sky sphere that follows the camera
GFX.skySphere = function (pano) {
  const m = new THREE.Mesh(GFX.sphere(150, 48, 24), new THREE.MeshBasicMaterial({ map: pano, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1; m.userData.sky = true; return m;
};
// direction from panorama coordinates (u around, elevation in radians), matching SphereGeometry's mapping
GFX.dirFrom = function (u, el) {
  const p = u * Math.PI * 2;
  return new THREE.Vector3(-Math.cos(p) * Math.cos(el), Math.sin(el), Math.sin(p) * Math.cos(el));
};

// ------------------------------------------------------------------ detail helpers
// fluffy leaf cards scattered over an ellipsoid canopy
GFX.leafCards = function (parent, cx, cy, cz, sx, sy, sz, col, n, r) {
  const m = GFX.mat(col, { tex: 'leafcard', alpha: true, side: THREE.DoubleSide, rough: 0.8 }), geo = this.geos.card || (this.geos.card = new THREE.PlaneGeometry(1, 1));
  for (let i = 0; i < n; i++) {
    const u = r() * Math.PI * 2, v = Math.acos(r() * 2 - 1), x = Math.sin(v) * Math.cos(u), y = Math.cos(v), z = Math.sin(v) * Math.sin(u);
    const c = mesh(geo, m, cx + x * sx, cy + y * sy * 0.9, cz + z * sz, (sx + sz) * (0.35 + r() * 0.25), parent);
    c.rotation.set(r() * 3, r() * 3, r() * 3); c.receiveShadow = false;
  }
};
// floating particles (fireflies, dust motes, embers); returns Points with a tick(t)
GFX.particles = function (n, col, box, size, drift = 0.01, blink = false) {
  const g = new THREE.BufferGeometry(), p = [], base = [];
  for (let i = 0; i < n; i++) { const x = box[0] + Math.random() * (box[1] - box[0]), y = box[2] + Math.random() * (box[3] - box[2]), z = box[4] + Math.random() * (box[5] - box[4]); p.push(x, y, z); base.push(x, y, z, Math.random() * 6.28); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color: lin(col), map: GFX.texture('spark'), size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
  const pts = new THREE.Points(g, m);
  pts.userData.tick = t => {
    const a = g.attributes.position;
    for (let i = 0; i < n; i++) { const ph = base[i * 4 + 3]; a.setXYZ(i, base[i * 4] + Math.sin(t * drift + ph) * 0.6, base[i * 4 + 1] + Math.sin(t * drift * 1.3 + ph * 2) * 0.3, base[i * 4 + 2] + Math.cos(t * drift * 0.8 + ph) * 0.6); }
    a.needsUpdate = true; if (blink) m.opacity = 0.6 + Math.sin(t * 0.05) * 0.3;
  };
  return pts;
};
// instanced pebbles
GFX.pebbles = function (n, col, place, size = 0.12) {
  const m = new THREE.InstancedMesh(GFX.blob(12, 0.35, 1), GFX.mat(col, { tex: 'rock' }), n), o = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) { const p = place(); if (!p) continue; o.position.set(p[0], (p[1] || 0) + 0.02, p[2]); o.rotation.set(Math.random(), Math.random() * 6, 0); const s = size * (0.4 + Math.random()); o.scale.set(s, s * 0.6, s * (0.7 + Math.random() * 0.6)); o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k++, lin(mixHex(col, Math.random() < 0.5 ? '#ffffff' : '#404040', Math.random() * 0.3))); }
  m.count = k; m.castShadow = true; m.receiveShadow = true; return m;
};
Object.assign(PROPS, {
  log(r) { const g = new THREE.Group(); const l = mesh(GFX.trunk(0.2, 0.18, 2.2 + r(), 0.1, 10), GFX.mat('#8a7a64', { tex: 'bark' }), 0, 0.15, 0, 1, g); l.rotation.z = Math.PI / 2; l.position.x = -1.1; return g; },
  agave(r) { const g = new THREE.Group(), m = GFX.mat('#7a9a7a', { rough: 0.6, side: THREE.DoubleSide }); for (let i = 0; i < 12; i++) { const c = mesh(cone(0.09, 0.9 + r() * 0.4, 6), m, 0, 0.4, 0, 1, g); c.rotation.set(0.5 + r() * 0.7, i * 2.4, 0); c.position.set(Math.sin(i * 2.4) * 0.15, 0.35, Math.cos(i * 2.4) * 0.15); } return g; },
  stoneWall(r, len = 4) { const g = new THREE.Group(); for (let i = 0; i < len * 5; i++) { const x = (i % (len * 2.5)) * 0.4 - len / 2, y = Math.floor(i / (len * 2.5)) * 0.28 + 0.14; mesh(GFX.blob(i % 4 + 10, 0.3, 1), M.rock(mixHex('#b8a888', '#8a7a64', r())), x + r() * 0.1, y, (r() - 0.5) * 0.1, [0.24, 0.16, 0.22], g); } return g; },
  lantern(r, col = '#ffc870') { const g = new THREE.Group(), dark = GFX.mat('#2a2a2e', { metal: 0.7, rough: 0.4 }); mesh(cyl(0.04, 0.05, 2.2, 10), dark, 0, 1.1, 0, 1, g); mesh(GFX.rbox(0.24, 0.32, 0.24, 0.03), GFX.mat(col, { emissive: col, opacity: 0.85 }), 0, 2.35, 0, 1, g); mesh(cone(0.2, 0.15, 4), dark, 0, 2.58, 0, 1, g).rotation.y = Math.PI / 4; const l = new THREE.PointLight(lin(col), 1.2, 7, 1.5); l.position.set(0, 2.3, 0); g.add(l); return g; },
  brazier(r) { const g = new THREE.Group(), st = M.stone('#c8b48a'); mesh(cyl(0.12, 0.2, 1.1, 12), st, 0, 0.55, 0, 1, g); mesh(GFX.lathe('bowl', [[0, 0], [0.3, 0.05], [0.42, 0.25], [0.4, 0.28]], 16), GFX.mat('#6a4a2a', { metal: 0.6, rough: 0.4 }), 0, 1.1, 0, 1, g); const f = mesh(cone(0.25, 0.6, 10), GFX.mat('#ffa030', { emissive: '#ff7a10', opacity: 0.85 }), 0, 1.6, 0, 1, g); f.castShadow = false; f.userData.flame = true; const l = new THREE.PointLight(lin('#ff9a40'), 1.6, 10, 1.4); l.position.set(0, 1.9, 0); g.add(l); return g; },
  lounger(r, col = '#f0f0f0') { const g = new THREE.Group(), w = M.wood('#c8a070'); mesh(GFX.rbox(0.7, 0.08, 1.8, 0.02), w, 0, 0.35, 0, 1, g); const back = mesh(GFX.rbox(0.7, 0.08, 0.7, 0.02), w, 0, 0.6, -0.95, 1, g); back.rotation.x = -0.9; mesh(GFX.rbox(0.62, 0.06, 1.6, 0.03), GFX.mat(col, { tex: 'fabric' }), 0, 0.42, 0.05, 1, g); for (const x of [-0.3, 0.3]) for (const z of [-0.8, 0.8]) mesh(cyl(0.03, 0.03, 0.35, 8), w, x, 0.17, z, 1, g); return g; },
  parasol(r, col = '#f4f0e8') { const g = new THREE.Group(); mesh(cyl(0.035, 0.035, 2.4, 8), M.wood('#a07a50'), 0, 1.2, 0, 1, g); mesh(cone(1.4, 0.5, 16), GFX.mat(col, { tex: 'fabric', side: THREE.DoubleSide }), 0, 2.45, 0, 1, g); return g; },
  crate(r) { const g = new THREE.Group(); mesh(GFX.rbox(0.7, 0.7, 0.7, 0.03), M.wood('#a07a4a'), 0, 0.35, 0, 1, g).rotation.y = r(); return g; },
  barrel(r) { const g = new THREE.Group(); mesh(GFX.lathe('barrel', [[0, 0], [0.28, 0], [0.33, 0.4], [0.28, 0.8], [0, 0.8]], 16), M.wood('#8a5a32'), 0, 0, 0, 1, g); for (const y of [0.12, 0.68]) mesh(new THREE.TorusGeometry(0.3, 0.015, 6, 20), GFX.mat('#4a4a50', { metal: 0.8 }), 0, y, 0, 1, g).rotation.x = Math.PI / 2; return g; },
  mushroom(r) { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const x = (r() - 0.5) * 0.4, z = (r() - 0.5) * 0.4, s = 0.6 + r() * 0.6; mesh(cyl(0.025 * s, 0.03 * s, 0.15 * s, 8), GFX.mat('#e8e0d0'), x, 0.075 * s, z, 1, g); mesh(GFX.sphere(0.08 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), GFX.mat('#c8a070'), x, 0.15 * s, z, [1, 0.6, 1], g); } return g; },
  statue(r) { const g = new THREE.Group(), st = M.stone('#e8e0cc'); mesh(GFX.rbox(1.0, 1.0, 1.0, 0.04), st, 0, 0.5, 0, 1, g); mesh(GFX.sphere(0.3, 16, 12), st, 0, 2.15, 0, [0.9, 1.1, 1], g); mesh(GFX.lathe('torso', [[0.25, 0], [0.32, 0.4], [0.4, 0.8], [0.2, 0.95]].map(([a, b]) => [a, b]), 16), st, 0, 1.0, 0, [1, 1, 0.7], g); mesh(GFX.capsule(0.09, 0.5), st, 0.42, 1.75, 0, 1, g).rotation.z = 0.3; return g; }
});
