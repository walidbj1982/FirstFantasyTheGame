// Rich scenery: blended terrain (several textures mixed per vertex), coastlines with animated foam,
// wind in grass and leaves, drifting cloud shadows, and landmark models (lighthouse, windmill,
// chapel, sailing boats, gulls) for the world map, the villages and the battle stages.
'use strict';

GFX.time = { value: 0 }; // seconds, updated every frame by R3.render

// ------------------------------------------------------------------ wind
// Sways vertices sideways in proportion to their height: grass tufts, leaves, palm fronds.
GFX.windify = function (m, amt = 0.04) {
  if (!m || m.userData.wind) return m;
  m.userData.wind = true;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = GFX.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        #ifdef USE_INSTANCING
          vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          float hgt = max(0.0, transformed.y);
        #else
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          float hgt = clamp(wp.y * 0.35, 0.0, 2.5);
        #endif
        float s = sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.27) + 0.45 * sin(uTime * 3.9 + wp.x * 1.3 + wp.z * 0.7);
        transformed.x += s * ${amt.toFixed(3)} * hgt;
        transformed.z += s * ${(amt * 0.5).toFixed(3)} * hgt;
      }`);
  };
  m.customProgramCacheKey = () => 'wind' + amt;
  m.needsUpdate = true;
  return m;
};

// ------------------------------------------------------------------ blended terrain
// A vertex attribute "splat" (3 weights) mixes three tiling textures; vertex colours tint them.
// Optional cloud shadows drift across the ground.
TEXTURES.clouds = function (N = 256) { return paintPixels(N, (x, y) => fbm(x / N * 4, y / N * 4, 4, 5, 77)); };
TEXTURES.stripes = function (N = 64) { const c = mkCanvas(N, N), g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f0e6' : '#ffffff'; g.fillRect(i * N / 8, 0, N / 8, N); } g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < N; y += 4) g.fillRect(0, y, N, 1); return c; };
GFX.splatMat = function (texs, scales = [1, 1, 1], cloud = false) {
  const key = 'splat|' + texs.join() + scales.join() + cloud;
  if (this.mats[key]) return this.mats[key];
  const m = new THREE.MeshStandardMaterial({ map: GFX.texture(texs[0]), vertexColors: true, roughness: 0.93, metalness: 0 });
  m.envMapIntensity = 0.6;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tB: { value: GFX.texture(texs[1]) }, tC: { value: GFX.texture(texs[2]) }, tCloud: { value: GFX.texture('clouds') },
      uScale: { value: new THREE.Vector3(...scales) }, uTime: GFX.time, uCloud: { value: cloud ? 1 : 0 } });
    sh.vertexShader = 'attribute vec3 splat;\nvarying vec3 vSplat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSplat = splat;');
    sh.fragmentShader = 'uniform sampler2D tB, tC, tCloud;\nuniform vec3 uScale;\nuniform float uTime, uCloud;\nvarying vec3 vSplat;\n' +
      sh.fragmentShader.replace('#include <map_fragment>', `
        vec4 ta = texture2D(map, vUv * uScale.x), tb = texture2D(tB, vUv * uScale.y), tc = texture2D(tC, vUv * uScale.z);
        vec3 w = max(vSplat, 0.0) + 0.0001;
        // sharpen the blend using each texture's own brightness, so grass grows "through" sand in tufts
        w *= vec3(0.6 + ta.g, 0.6 + tb.g, 0.6 + tc.g); w = pow(w, vec3(2.2)); w /= (w.x + w.y + w.z);
        vec4 texelColor = mapTexelToLinear(ta * w.x + tb * w.y + tc * w.z);
        diffuseColor *= texelColor;
        if (uCloud > 0.5) { float cl = texture2D(tCloud, vUv * 0.02 + vec2(uTime * 0.0035, uTime * 0.0018)).r; diffuseColor.rgb *= mix(1.0, 0.72, smoothstep(0.52, 0.72, cl)); }`);
  };
  m.customProgramCacheKey = () => key;
  return (this.mats[key] = m);
};
// Builds a terrain grid over [x0,x1] x [z0,z1] with `res` vertices per unit.
// f(x, z) -> { h, s: [a, b, c], c: THREE.Color (linear) }
GFX.terrain = function (x0, z0, x1, z1, res, f, mat) {
  const nx = Math.round((x1 - x0) * res), nz = Math.round((z1 - z0) * res);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2), sp = new Float32Array(pos.length), col = new Float32Array(pos.length), idx = [];
  let k = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++, k++) {
    const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz, v = f(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = v.h; pos[k * 3 + 2] = z; uv[k * 2] = x * 0.5; uv[k * 2 + 1] = z * 0.5;
    sp[k * 3] = v.s[0]; sp[k * 3 + 1] = v.s[1]; sp[k * 3 + 2] = v.s[2]; col[k * 3] = v.c.r; col[k * 3 + 1] = v.c.g; col[k * 3 + 2] = v.c.b;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('splat', new THREE.BufferAttribute(sp, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
};
// Sea with turquoise shallows and foam that laps at the shore. f(x, z) -> landness 0..1 (1 = dry land)
GFX.sea = function (x0, z0, x1, z1, res, land, y = -0.1) {
  const nx = Math.round((x1 - x0) * res), nz = Math.round((z1 - z0) * res), n = (nx + 1) * (nz + 1);
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), shore = new Float32Array(n), col = new Float32Array(n * 3), idx = [];
  const deep = lin('#1b4f96'), mid = lin('#2a7cc0'), shallow = lin('#46c0c8'), c = new THREE.Color();
  let k = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++, k++) {
    const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz, L = land(x, z);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x * 0.3; uv[k * 2 + 1] = z * 0.3;
    shore[k] = smooth(0.12, 0.5, L);
    c.copy(deep).lerp(mid, smooth(0.0, 0.25, L)).lerp(shallow, smooth(0.2, 0.5, L)); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('shore', new THREE.BufferAttribute(shore, 1)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const t = GFX.texture('water').clone(); t.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.94 });
  m.envMapIntensity = 1.1;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = GFX.time;
    sh.vertexShader = 'attribute float shore;\nvarying float vShore;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vShore = shore;');
    sh.fragmentShader = 'uniform float uTime;\nvarying float vShore;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 texelColor = mapTexelToLinear(texture2D(map, vUv + vec2(uTime * 0.012, uTime * 0.006)) * 0.6 + texture2D(map, vUv * 1.7 - vec2(uTime * 0.009, uTime * -0.011)) * 0.4);
      diffuseColor *= texelColor;
      float wave = 0.5 + 0.5 * sin(uTime * 1.6 - vShore * 10.0 + texelColor.r * 4.0);
      float foam = smoothstep(0.55, 0.95, vShore * (0.65 + 0.45 * wave)) + smoothstep(0.85, 1.0, vShore) * 0.6;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), clamp(foam, 0.0, 0.9));
      diffuseColor.a = mix(0.9, 0.98, foam);`);
  };
  m.customProgramCacheKey = () => 'sea';
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; return mesh;
};

// ------------------------------------------------------------------ landmarks (THREE.Group, base at y=0)
Object.assign(PROPS, {
  lighthouse(r) {
    const g = new THREE.Group(), white = M.plaster('#f4f2ec'), red = GFX.mat('#c03a30', { tex: 'plaster' }), dark = GFX.mat('#2a2a30', { metal: 0.6, rough: 0.4 });
    mesh(GFX.blob(13, 0.3, 1), M.rock('#8a8478'), 0, 0.2, 0, [2.2, 1.0, 2.2], g);
    const body = new THREE.CylinderGeometry(0.55, 0.8, 5, 20);
    mesh(body, white, 0, 3.0, 0, 1, g);
    for (const y of [1.6, 3.6]) mesh(new THREE.CylinderGeometry(0.68 - (y - 1.6) * 0.05, 0.73 - (y - 1.6) * 0.05, 0.7, 20), red, 0, y, 0, 1, g);
    mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 20), dark, 0, 5.55, 0, 1, g);
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 12), GFX.mat('#fff4c0', { emissive: '#ffd860', opacity: 0.85 }), 0, 5.95, 0, 1, g);
    mesh(cone(0.55, 0.5, 16), red, 0, 6.55, 0, 1, g);
    return g;
  },
  windmill(r) { // white round Cycladic windmill with a thatched cap and canvas sails
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.9, 1.05, 3.2, 20), M.plaster('#f4f2ec'), 0, 1.6, 0, 1, g);
    mesh(cone(1.05, 1.0, 18), GFX.mat('#8a6a42', { tex: 'bark' }), 0, 3.7, 0, 1, g);
    mesh(GFX.rbox(0.4, 0.75, 0.08, 0.02), M.wood('#2a6ab8'), 0, 0.4, 1.02, 1, g);
    const hub = pivot(g, 0, 3.3, 1.1); hub.userData.spin = true;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, arm = pivot(hub, 0, 0, 0); arm.rotation.z = a; mesh(GFX.rbox(0.05, 2.4, 0.05, 0.01), M.wood('#7a5a3a'), 0, 1.2, 0, 1, arm); const sail = mesh(new THREE.PlaneGeometry(0.55, 1.7), GFX.mat('#f4efe2', { tex: 'fabric', side: THREE.DoubleSide }), 0.3, 1.45, 0.02, 1, arm); sail.rotation.y = 0.35; }
    return g;
  },
  chapel(r, dome = '#2a6ab8') { // whitewashed chapel with a blue dome and a bell tower
    const g = new THREE.Group(), white = M.plaster('#f6f4ee'), blue = GFX.mat(dome, { rough: 0.5 });
    mesh(GFX.rbox(3.2, 2.4, 2.4, 0.08), white, 0, 1.2, 0, 1, g);
    mesh(GFX.rbox(1.6, 0.5, 1.6, 0.05), white, 0, 2.6, 0, 1, g);
    mesh(GFX.sphere(0.95, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), blue, 0, 2.85, 0, 1, g);
    mesh(cyl(0.03, 0.03, 0.5, 6), GFX.mat('#e0e0e0'), 0, 4.0, 0, 1, g); mesh(GFX.rbox(0.3, 0.04, 0.04, 0.01), GFX.mat('#e0e0e0'), 0, 4.1, 0, 1, g);
    const tw = pivot(g, 1.9, 0, 0.6);
    mesh(GFX.rbox(1.0, 3.6, 1.0, 0.05), white, 0, 1.8, 0, 1, tw);
    mesh(GFX.rbox(1.1, 0.12, 1.1, 0.03), white, 0, 3.65, 0, 1, tw);
    for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) mesh(GFX.rbox(0.18, 0.8, 0.18, 0.03), white, x, 4.1, z, 1, tw);
    mesh(GFX.sphere(0.12, 10, 8), GFX.mat('#b08a40', { metal: 0.8, rough: 0.3 }), 0, 4.05, 0, 1, tw);
    mesh(GFX.sphere(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), blue, 0, 4.5, 0, 1, tw);
    mesh(GFX.rbox(0.9, 1.5, 0.08, 0.03), M.wood(dome), 0, 0.75, 1.21, 1, g);
    return g;
  },
  sailboat(r, sail = '#f4f0e6') {
    const g = new THREE.Group(), hull = GFX.mat(r() < 0.5 ? '#2a5aa8' : '#f0eee8', { tex: 'wood', rough: 0.5 });
    mesh(GFX.lathe('hull', [[0, -0.35], [0.45, -0.25], [0.6, 0.1], [0.62, 0.2]], 14), hull, 0, 0, 0, [1, 1, 2.6], g);
    mesh(GFX.rbox(1.1, 0.06, 2.6, 0.03), M.wood('#b08a5a'), 0, 0.17, 0, 1, g);
    mesh(cyl(0.04, 0.05, 3.2, 8), M.wood('#6a4a2a'), 0, 1.75, 0.2, 1, g);
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 2.8); s.quadraticCurveTo(0.7, 1.2, 1.5, 0.05); s.lineTo(0, 0);
    mesh(new THREE.ShapeGeometry(s), GFX.mat(sail, { tex: 'fabric', side: THREE.DoubleSide }), 0.02, 0.35, 0.25, 1, g).rotation.y = -Math.PI / 2;
    g.userData.bob = r() * 6;
    return g;
  },
  arch(r) { // a natural rock arch for the canyon horizon
    const g = new THREE.Group(), rk = M.rock('#b8683a');
    for (const x of [-3, 3]) mesh(GFX.blob(20 + (x > 0 ? 1 : 0), 0.25, 2), rk, x, 3, 0, [1.6, 3.4, 1.6], g);
    mesh(GFX.blob(22, 0.25, 2), rk, 0, 6.5, 0, [4.6, 1.2, 1.6], g);
    return g;
  },
  stall(r, col) { // market stall: striped awning on poles over a crate of produce
    const g = new THREE.Group(), wood = M.wood('#8a6a42');
    for (const x of [-1.2, 1.2]) for (const z of [-0.4, 0.4]) mesh(cyl(0.035, 0.035, 1.6, 8), wood, x, 0.8, z, 1, g);
    const aw = mesh(new THREE.PlaneGeometry(2.7, 1.4), GFX.mat(col, { tex: 'stripes', side: THREE.DoubleSide, rough: 0.8 }), 0, 1.65, 0.1, 1, g); aw.rotation.x = -Math.PI / 2 + 0.35;
    const fruit = [['#f08a20', 0.07], ['#d83a2a', 0.07], ['#7ac040', 0.06], ['#f0d040', 0.06], ['#5a2a6a', 0.05]];
    for (let i = 0; i < 26; i++) { const [c, s] = fruit[i % fruit.length]; mesh(GFX.sphere(s, 8, 6), GFX.mat(c, { rough: 0.5 }), -1.0 + (i % 13) * 0.16 + r() * 0.04, 0.62 + r() * 0.05, -0.1 + Math.floor(i / 13) * 0.2, 1, g); }
    return g;
  }
});
// a flock of gulls circling around a point; returns a group with a tick(t)
GFX.gulls = function (n, cx, cy, cz, rad, r) {
  const g = new THREE.Group(), m = GFX.mat('#f4f4f4', { side: THREE.DoubleSide, rough: 0.8 }), birds = [];
  const wing = new THREE.PlaneGeometry(0.35, 0.12); wing.translate(0.175, 0, 0);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(), L = new THREE.Mesh(wing, m), Rw = new THREE.Mesh(wing, m); Rw.scale.x = -1; b.add(L, Rw);
    birds.push({ b, L, Rw, ph: r() * 6.28, rr: rad * (0.6 + r() * 0.6), h: cy + r() * 1.5, sp: 0.25 + r() * 0.2 }); g.add(b);
  }
  g.userData.tick = t => {
    for (const k of birds) {
      const a = t * k.sp * 0.016 + k.ph; k.b.position.set(cx + Math.cos(a) * k.rr, k.h + Math.sin(a * 2) * 0.3, cz + Math.sin(a) * k.rr);
      k.b.rotation.y = -a; const f = Math.sin(t * 0.25 + k.ph) * 0.5; k.L.rotation.z = f; k.Rw.rotation.z = -f;
    }
  };
  return g;
};

// ------------------------------------------------------------------ wind on existing foliage
{
  const grass0 = GFX.grass;
  GFX.grass = function (...a) { const m = grass0.apply(this, a); GFX.windify(m.material, 0.16); return m; };
  const cards0 = GFX.leafCards;
  GFX.leafCards = function (parent, cx, cy, cz, sx, sy, sz, col, n, r) {
    const before = parent.children.length; cards0.call(this, parent, cx, cy, cz, sx, sy, sz, col, n, r);
    for (let i = before; i < parent.children.length; i++) { const c = parent.children[i]; c.castShadow = false; GFX.windify(c.material, 0.02); }
  };
  const leaf0 = M.leaf; M.leaf = c => GFX.windify(leaf0(c), 0.01);
  const palm0 = PROPS.palm;
  PROPS.palm = function (r) { const g = palm0(r); g.traverse(o => { if (o.material && o.material.map && o.material.alphaTest) GFX.windify(o.material, 0.035); }); return g; };
}
