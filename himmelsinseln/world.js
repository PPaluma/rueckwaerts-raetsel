// Himmelsinseln – Weltaufbau: Himmel, Wolkenmeer, prozedurale Inseln, Partikel
import * as THREE from 'three';

export const V3 = THREE.Vector3;
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

export function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function h2(x, y) { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
export function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h2(xi, yi), h2(xi + 1, yi), fx), lerp(h2(xi, yi + 1), h2(xi + 1, yi + 1), fx), fy);
}
export function fbm(x, y, o = 4) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); n += a; a *= .5; f *= 2.03; } return s / n; }

export const SEA_Y = -80;
export const SUN = new V3(0.62, 0.21, -0.76).normalize();
export const MOON = new V3(-0.55, 0.40, 0.62).normalize();
export const FOG_HEX = 0xf6bfa8;
const rgb = (hex) => new V3((hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255);

export const U = {
  uTime: { value: 0 },
  uFog: { value: new THREE.Vector2(140, 1900) },
  uFogCol: { value: rgb(FOG_HEX) },
  uSun: { value: SUN },
  uMoon: { value: MOON },
  uNight: { value: 0 },
};

const _cc = new Map();
export function C(hex) { let c = _cc.get(hex); if (!c) { c = new THREE.Color(hex); _cc.set(hex, c); } return c; }

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new V3(), _s = new V3();
export function xf(x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}
const UP = new V3(0, 1, 0);
// Matrix für einen Einheitskörper (Höhe 1 entlang Y, zentriert) von p0 nach p1
export function segM(p0, p1, w, d = w) {
  const dir = new V3().subVectors(p1, p0); const len = dir.length() || 1e-4; dir.multiplyScalar(1 / len);
  return new THREE.Matrix4().compose(new V3().addVectors(p0, p1).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(UP, dir), new V3(w, len, d));
}

const jr = mulberry(777);
const FAKE_L = new V3(0.5, 0.75, -0.43).normalize();
const _a = new V3(), _b = new V3(), _c = new V3(), _n = new V3(), _ab = new V3(), _ac = new V3(), _lc = new V3(), _col = new THREE.Color();

// Geometrie-Sammler: fügt viele Körper zu EINEM Mesh mit Vertexfarben zusammen
export class GB {
  constructor() { this.p = []; this.c = []; }
  tri(a, b, c, col, hint) {
    if (hint) { _ab.subVectors(b, a); _ac.subVectors(c, a); _n.crossVectors(_ab, _ac); if (_n.dot(hint) < 0) { const t = b; b = c; c = t; } }
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.c.push(col.r, col.g, col.b);
  }
  add(geo, m, col, o = {}) {
    const g = geo.index ? (geo.userData.ni || (geo.userData.ni = geo.toNonIndexed())) : geo;
    const arr = g.attributes.position.array; const jit = o.jit === undefined ? 0.07 : o.jit;
    if (typeof col === 'number') col = C(col);
    for (let i = 0; i < arr.length; i += 9) {
      _a.set(arr[i], arr[i + 1], arr[i + 2]); _b.set(arr[i + 3], arr[i + 4], arr[i + 5]); _c.set(arr[i + 6], arr[i + 7], arr[i + 8]);
      _col.copy(col);
      if (o.fn) { _lc.copy(_a).add(_b).add(_c).multiplyScalar(1 / 3); o.fn(_lc, _col); }
      _a.applyMatrix4(m); _b.applyMatrix4(m); _c.applyMatrix4(m);
      let k = 1 + (jr() - .5) * 2 * jit;
      if (o.light) { _ab.subVectors(_b, _a); _ac.subVectors(_c, _a); _n.crossVectors(_ab, _ac).normalize(); k *= 0.72 + 0.38 * Math.max(0, _n.dot(FAKE_L)) + 0.1 * _n.y; }
      _col.multiplyScalar(k);
      this.p.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
      for (let j = 0; j < 3; j++) this.c.push(_col.r, _col.g, _col.b);
    }
  }
  get empty() { return this.p.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    this.p = this.c = null; return g;
  }
}

const _geoCache = new Map();
function cylT(top, n = 8) { const k = top + '_' + n; let g = _geoCache.get(k); if (!g) { g = new THREE.CylinderGeometry(top, 1, 1, n); _geoCache.set(k, g); } return g; }
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 7),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone10: new THREE.ConeGeometry(1, 1, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  octa: new THREE.OctahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.06, 5, 28),
};

// ---------------------------------------------------------------- Texturen
function radialTex(stops, size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, a] of stops) g.addColorStop(t, `rgba(255,255,255,${a})`);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; return t;
}
export const TEX = {};
export function initTextures() {
  TEX.glow = radialTex([[0, 1], [0.12, 0.75], [0.35, 0.28], [0.65, 0.07], [1, 0]]);
  TEX.soft = radialTex([[0, 0.9], [0.4, 0.55], [0.75, 0.15], [1, 0]]);
}

// ---------------------------------------------------------------- Billboard-Batch (Glühen, Funken, Nebel)
const batchVS = `
uniform float uTime; uniform vec2 uFog; uniform float uFogK;
attribute vec3 iPos; attribute vec4 iCol; attribute float iSize; attribute vec4 iMove;
varying vec4 vCol; varying vec2 vUv;
void main(){
  vec3 p = iPos; float ph = iMove.z; float sp = iMove.y;
  p += vec3(sin(uTime*sp+ph), cos(uTime*sp*0.7+ph*1.3), sin(uTime*sp*1.3+ph*2.1)) * iMove.x;
  float life = 1.0;
  if (iMove.w > 0.0) { float k = fract(uTime*iMove.w*0.03 + ph); p.y += k*36.0; life = sin(k*3.14159); }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float s = iSize * (1.0 + 0.16*sin(uTime*2.3 + ph*7.0 + iPos.x));
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
  float fog = smoothstep(uFog.x, uFog.y, -mv.z);
  vCol = iCol; vCol.a *= life * (1.0 - fog*uFogK); vUv = uv;
}`;
const batchFS = `
uniform sampler2D map; varying vec4 vCol; varying vec2 vUv;
void main(){ float a = texture2D(map, vUv).a * vCol.a; if (a < 0.004) discard; gl_FragColor = vec4(vCol.rgb, a); }`;

// items: {p:[x,y,z], s, c:hex, a, m:[amp,speed,phase,rise]}
export function makeBatch(items, { tex = TEX.glow, additive = true, fogK = 0.85, dynamic = false, order = 5 } = {}) {
  const n = items.length;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const P = new Float32Array(n * 3), Cc = new Float32Array(n * 4), S = new Float32Array(n), Mv = new Float32Array(n * 4);
  items.forEach((it, i) => {
    P.set(it.p, i * 3); const c = rgb(it.c === undefined ? 0xffffff : it.c);
    Cc.set([c.x, c.y, c.z, it.a === undefined ? 1 : it.a], i * 4); S[i] = it.s || 1;
    Mv.set(it.m || [0, 0, i * 1.7, 0], i * 4);
  });
  const usage = dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage;
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3).setUsage(usage));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(Cc, 4).setUsage(usage));
  g.setAttribute('iSize', new THREE.InstancedBufferAttribute(S, 1).setUsage(usage));
  g.setAttribute('iMove', new THREE.InstancedBufferAttribute(Mv, 4));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uFog: U.uFog, uFogK: { value: fogK }, map: { value: tex } },
    vertexShader: batchVS, fragmentShader: batchFS, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = order; return m;
}

// ---------------------------------------------------------------- Himmel
const NOISE_GLSL = `
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm3(vec2 p){ return vnoise(p)*0.5 + vnoise(p*2.03+7.1)*0.3 + vnoise(p*4.1+3.3)*0.2; }
`;
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSun: U.uSun, uMoon: U.uMoon, uFogCol: U.uFogCol, uNight: U.uNight },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `precision highp float;
uniform float uTime; uniform float uNight; uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uFogCol; varying vec3 vDir;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 zen = vec3(0.115,0.135,0.40), mid = vec3(0.50,0.40,0.78), low = vec3(0.93,0.56,0.66);
  vec3 col = mix(uFogCol, low, smoothstep(0.0,0.10,h));
  col = mix(col, mid, smoothstep(0.06,0.34,h));
  col = mix(col, zen, smoothstep(0.26,0.85,h));
  col = mix(col, col*vec3(0.34,0.36,0.62), uNight*smoothstep(0.08,0.5,h));
  float sd = max(dot(d,uSun),0.0);
  // Sterne
  vec3 sp = d*150.0; vec3 ip = floor(sp); vec3 fp = fract(sp)-0.5;
  float r = fract(sin(dot(ip,vec3(12.9898,78.233,37.719)))*43758.5453);
  float star = step(0.988,r)*smoothstep(0.35,0.0,length(fp))*(0.6+0.4*sin(uTime*2.0+r*90.0));
  col += vec3(1.0,0.95,0.85)*star*smoothstep(0.22-uNight*0.12,0.6-uNight*0.25,h)*(1.2+uNight);
  // Schleierwolken
  vec2 cuv = d.xz/(abs(h)+0.22);
  float cir = fbm3(cuv*vec2(1.3,3.2)+vec2(uTime*0.004,0.0));
  float cm = smoothstep(0.50,0.80,cir)*smoothstep(0.02,0.22,h)*(1.0-smoothstep(0.45,0.8,h));
  col = mix(col, mix(vec3(1.0,0.72,0.70),vec3(1.0,0.92,0.78),pow(sd,3.0)), cm*0.55);
  // Mond
  float md = dot(d,uMoon);
  float disc = smoothstep(0.9938,0.9944,md);
  float cut = smoothstep(0.9930,0.9950,dot(d,normalize(uMoon+vec3(0.055,0.03,-0.02))));
  vec3 mcol = mix(vec3(0.98,0.96,1.0), vec3(0.62,0.58,0.86), cut*0.8);
  mcol *= 0.92+0.08*vnoise(d.xy*60.0);
  col = mix(col, mcol, disc);
  col += vec3(0.65,0.7,1.0)*pow(max(md,0.0),90.0)*0.22;
  // Sonne
  col += vec3(1.0,0.50,0.22)*pow(sd,5.0)*0.42;
  col += vec3(1.0,0.78,0.45)*pow(sd,40.0)*0.42;
  col += vec3(1.0,0.95,0.80)*pow(sd,700.0)*1.2;
  col = mix(col, vec3(1.0,0.98,0.90), smoothstep(0.99955,0.9998,sd));
  if (h < 0.0) col = mix(col, uFogCol + vec3(1.0,0.6,0.3)*pow(sd,6.0)*0.25, smoothstep(0.0,-0.04,h));
  gl_FragColor = vec4(col,1.0);
}`,
    side: THREE.BackSide, depthWrite: false, depthTest: true,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  m.frustumCulled = false; m.renderOrder = -10; return m;
}

// ---------------------------------------------------------------- Wolkenmeer
export function makeSea() {
  const SIZE = 5600, SEG = 150;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSun: U.uSun, uFog: U.uFog, uFogCol: U.uFogCol },
    vertexShader: `
uniform float uTime; varying float vH; varying vec3 vW; varying vec3 vN;
${NOISE_GLSL}
float H(vec2 p){ vec2 q = p*0.0052 + vec2(uTime*0.012, uTime*0.004);
  float a = vnoise(q); float b = vnoise(q*2.3+4.0); float c = vnoise(q*5.1+9.0);
  float m = a*0.55+b*0.3+c*0.15; return m*m*(3.0-2.0*m); }
void main(){
  vec4 w = modelMatrix * vec4(position,1.0);
  float h = H(w.xz); float e = 9.0;
  float hx = H(w.xz+vec2(e,0.0)), hz = H(w.xz+vec2(0.0,e));
  float A = 46.0;
  vN = normalize(vec3(-(hx-h)*A, e, -(hz-h)*A));
  w.y += h*A; vH = h; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `precision highp float;
uniform float uTime; uniform vec3 uSun; uniform vec2 uFog; uniform vec3 uFogCol;
varying float vH; varying vec3 vW; varying vec3 vN;
${NOISE_GLSL}
void main(){
  vec2 q = vW.xz*0.021 + vec2(uTime*0.03, uTime*0.012);
  float d1 = fbm3(q); float d2 = fbm3(q*2.7+5.0);
  vec3 n = normalize(vN + vec3(d1-0.5, 0.0, d2-0.5)*0.9);
  float lit = clamp(dot(n, normalize(uSun+vec3(0.0,0.35,0.0)))*0.75+0.35, 0.0, 1.0);
  float hh = clamp(vH*1.15 + (d1-0.5)*0.35, 0.0, 1.0);
  vec3 deep = vec3(0.47,0.36,0.66), midc = vec3(0.86,0.60,0.74), top = vec3(1.0,0.90,0.82);
  vec3 col = mix(deep, midc, smoothstep(0.08,0.5,hh));
  col = mix(col, top, smoothstep(0.38,0.85,hh)*lit);
  col *= 0.80 + 0.30*lit;
  vec3 v = normalize(vW - cameraPosition);
  float sd = max(dot(v,uSun),0.0);
  col += vec3(1.0,0.55,0.25)*pow(sd,4.0)*0.30*smoothstep(0.3,0.8,hh);
  float dist = length(vW - cameraPosition);
  float fog = smoothstep(uFog.x*2.0, uFog.y*0.92, dist);
  col = mix(col, uFogCol + vec3(1.0,0.6,0.3)*pow(sd,6.0)*0.25, fog);
  gl_FragColor = vec4(col,1.0);
}`,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.position.y = SEA_Y;
  m.userData.cell = SIZE / SEG; return m;
}

// ---------------------------------------------------------------- Wolkenbäusche (Low-Poly, instanziert)
export function makeCloudPuffs(islandDefs) {
  const rng = mulberry(4242);
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x4a3566 });
  const src = new THREE.IcosahedronGeometry(1, 1); src.computeVertexNormals(); { const n = src.attributes.normal, q = src.attributes.position; for (let i = 0; i < n.count; i++) n.setXYZ(i, q.getX(i), q.getY(i), q.getZ(i)); }
  for (let v = 0; v < 3; v++) {
    const P = [], N = []; const nb = 5 + v;
    for (let b = 0; b < nb; b++) {
      const ox = (rng() - .5) * 3.2, oy = (rng() - .2) * 0.7, oz = (rng() - .5) * 1.6, s = 0.7 + rng() * 0.75 - Math.abs(ox) * 0.12;
      const pa = src.attributes.position.array, na = src.attributes.normal.array;
      for (let i = 0; i < pa.length; i += 3) { P.push(pa[i] * s + ox, pa[i + 1] * s * 0.72 + oy, pa[i + 2] * s + oz); N.push(na[i], na[i + 1], na[i + 2]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    const count = 26; const im = new THREE.InstancedMesh(g, mat, count); let k = 0, guard = 0;
    while (k < count && guard++ < 2000) {
      const a = rng() * TAU, r = 160 + Math.pow(rng(), 0.8) * 1500;
      const low = rng() < 0.55;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = low ? SEA_Y + 34 + rng() * 40 : 20 + rng() * 300;
      const s = low ? 26 + rng() * 44 : 14 + rng() * 30;
      let ok = true; for (const d of islandDefs) { if (Math.hypot(x - d.pos[0], z - d.pos[2]) < d.R + s * 2.4 && Math.abs(y - d.pos[1]) < 90 + s) ok = false; }
      if (Math.hypot(x, z - 0) < 120) ok = false;
      if (!ok) continue;
      im.setMatrixAt(k++, xf(x, y, z, s, s * (0.75 + rng() * 0.3), s, 0, rng() * TAU, 0));
    }
    im.count = k; im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; group.add(im);
  }
  return group;
}

// ---------------------------------------------------------------- Vögel
export function makeBirds() {
  const rng = mulberry(99); const flocks = 6, per = 7, n = flocks * per;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.35, 0, 0, .45, -1.7, 0, .15, 0, 0, -.35, 1.7, 0, .15, 0, 0, .45], 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 0], 1));
  const Cn = new Float32Array(n * 3), Pp = new Float32Array(n * 4);
  for (let f = 0; f < flocks; f++) {
    const a = rng() * TAU, r = 150 + rng() * 520, cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 10 + rng() * 170;
    const rad = 60 + rng() * 120, ph = rng() * TAU, sp = (0.10 + rng() * 0.08) * (rng() < .5 ? -1 : 1);
    for (let i = 0; i < per; i++) {
      const k = f * per + i; const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      Cn.set([cx, cy + row * 0.8, cz], k * 3);
      Pp.set([rad + side * row * 3.2, ph - row * 4.0 / rad * Math.sign(sp), sp, 1.3 + rng() * 0.6], k * 4);
    }
  }
  g.setAttribute('iC', new THREE.InstancedBufferAttribute(Cn, 3)); g.setAttribute('iP', new THREE.InstancedBufferAttribute(Pp, 4));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uFog: U.uFog, uFogCol: U.uFogCol },
    vertexShader: `uniform float uTime; attribute float aTip; attribute vec3 iC; attribute vec4 iP; varying float vD; varying float vT;
void main(){ float ang = iP.y + uTime*iP.z;
  vec3 c = iC + vec3(cos(ang)*iP.x, sin(uTime*0.4+iP.y*3.0)*5.0, sin(ang)*iP.x);
  vec3 fw = vec3(-sin(ang),0.0,cos(ang))*sign(iP.z); vec3 rt = vec3(fw.z,0.0,-fw.x);
  vec3 p = position; p.y += aTip*sin(uTime*7.0+iP.y*40.0+iC.x)*0.75; p.x *= 1.0-0.2*aTip*abs(sin(uTime*7.0+iP.y*40.0+iC.x));
  vec3 w = c + (rt*p.x + vec3(0.0,p.y,0.0) - fw*p.z)*iP.w;
  vec4 mv = viewMatrix*vec4(w,1.0); vD = -mv.z; vT = aTip; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec2 uFog; uniform vec3 uFogCol; varying float vD; varying float vT;
void main(){ vec3 col = mix(vec3(0.20,0.14,0.30), vec3(0.42,0.28,0.44), vT); gl_FragColor = vec4(mix(col,uFogCol,smoothstep(uFog.x,uFog.y,vD)*0.9),1.0); }`,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
}

// ---------------------------------------------------------------- Polarlicht (Finale)
export function makeAurora() {
  const grp = new THREE.Group(); const uA = { value: 0 };
  for (let i = 0; i < 3; i++) {
    const g = new THREE.CylinderGeometry(1300 + i * 240, 1300 + i * 240, 900, 120, 6, true, i * 2.1 + 3.4, 2.7);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uA, uS: { value: i * 3.7 } },
      vertexShader: `uniform float uTime; uniform float uS; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; float w = sin(uv.x*26.0+uTime*0.25+uS)*110.0 + sin(uv.x*61.0-uTime*0.2)*40.0; p.xz *= 1.0 + w/1400.0*(1.0-uv.y*0.5); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `precision highp float; uniform float uTime; uniform float uA; uniform float uS; varying vec2 vUv;
void main(){ float x = vUv.x; float c = 0.5+0.5*sin(x*38.0+uTime*0.3+uS+sin(x*17.0+uTime*0.22)*2.0); c = c*c;
  float rays = 0.72+0.28*sin(x*700.0+uTime*0.9)*sin(x*233.0-uTime*0.5+uS);
  float v = smoothstep(0.0,0.10,vUv.y)*pow(1.0-vUv.y,2.2); float e = smoothstep(0.0,0.15,x)*smoothstep(1.0,0.85,x);
  vec3 col = mix(vec3(0.18,1.0,0.58), vec3(0.62,0.30,1.0), smoothstep(0.05,0.6,vUv.y));
  gl_FragColor = vec4(col*(0.15+c)*rays*v*e*uA*1.1, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat); m.position.y = 900 + i * 90; m.frustumCulled = false; m.renderOrder = -5; grp.add(m);
  }
  grp.userData.uA = uA; grp.visible = false; return grp;
}

// ---------------------------------------------------------------- Wasser / Lava
class WB {
  constructor() { this.p = []; this.uv = []; this.f = []; }
  quad(a, b, c, d, ua, ub, uc, ud, fa, fb, fc, fd) { // a,b unten ; c,d oben (2 Dreiecke)
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    this.uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); this.f.push(fa, fb, fc, fa, fc, fd);
  }
  disc(cx, y, cz, r, n = 18) {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      this.p.push(cx, y, cz, p1[0], y, p1[1], p0[0], y, p0[1]);
      this.uv.push(.5, cz * .07, .5 + (p1[0] - cx) / r * .4, p1[1] * .07, .5 + (p0[0] - cx) / r * .4, p0[1] * .07); this.f.push(-1, -1, -1);
    }
  }
  get empty() { return this.p.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aFade', new THREE.Float32BufferAttribute(this.f, 1)); return g;
  }
}
function waterMat(colA, colB, glow) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uFog: U.uFog, uFogCol: U.uFogCol, uA: { value: rgb(colA) }, uB: { value: rgb(colB) }, uGlow: { value: glow } },
    vertexShader: `attribute float aFade; varying vec2 vUv; varying float vF; varying float vD;
void main(){ vUv = uv; vF = aFade; vec4 mv = modelViewMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `precision highp float; uniform float uTime; uniform vec2 uFog; uniform vec3 uFogCol; uniform vec3 uA; uniform vec3 uB; uniform float uGlow;
varying vec2 vUv; varying float vF; varying float vD;
${NOISE_GLSL}
void main(){
  float sp = vF < -0.5 ? 0.25 : 1.0;
  float n = vnoise(vec2(vUv.x*7.0, vUv.y*0.9 - uTime*1.9*sp));
  float n2 = vnoise(vec2(vUv.x*17.0+3.0, vUv.y*2.6 - uTime*3.4*sp));
  float st = smoothstep(0.42,0.85,n*0.65+n2*0.5);
  vec3 col = mix(uA, uB, st);
  float f = max(vF,0.0);
  float edge = vF < -0.5 ? 1.0 : smoothstep(0.0,0.14,vUv.x)*smoothstep(1.0,0.86,vUv.x);
  float a = (0.80+0.2*st)*edge*(1.0-smoothstep(0.55,1.0,f));
  col = mix(col, vec3(1.0), smoothstep(0.5,1.0,f)*0.6*(1.0-uGlow));
  col = mix(col, uFogCol, smoothstep(uFog.x,uFog.y,vD)*(1.0-uGlow*0.6));
  gl_FragColor = vec4(col, a);
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}
let MAT = null;
function mats() {
  if (!MAT) MAT = {
    lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
    unlit: new THREE.MeshBasicMaterial({ vertexColors: true }),
    water: waterMat(0x4fb9e8, 0xe9fbff, 0),
    lava: waterMat(0xff5a14, 0xffd95a, 1),
  };
  return MAT;
}

// ---------------------------------------------------------------- Insel-Grundform
function terrain(gb, def, off, o = {}) {
  const NS = o.ns || 52, NR = o.nr || 9, NB = o.nb || 10; const { R, D } = def; const sd = def.seed * 13.37 % 1000; const cliff = def.cliff || 5;
  const pal = def.pal; const hill = def.hill === undefined ? 3 : def.hill;
  const rad = (a) => R * (0.76 + 0.34 * fbm(Math.cos(a) * 1.15 + sd, Math.sin(a) * 1.15 - sd, 3));
  const topH = (x, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x), u = Math.min(1, r / rad(a));
    let y = hill * 2 * (fbm(x * 0.03 + sd, z * 0.03 + sd * 2, 3) - 0.5) * (1 - u * u * u);
    if (def.shape) y += def.shape(x, z, r, u);
    return y - 1.8 * u * u * u * u;
  };
  const top = (i, j) => { const a = j / NS * TAU, u = Math.pow(i / NR, 0.9), r = rad(a) * u; const x = Math.cos(a) * r, z = Math.sin(a) * r; return new V3(x + off.x, topH(x, z) + off.y, z + off.z); };
  const bot = (i, j) => {
    const a = j / NS * TAU, u = 1 - i / NB, ca = Math.cos(a), sa = Math.sin(a), ra = rad(a);
    let rr = ra * u; if (i > 0 && i < NB) rr *= 0.97 + 0.26 * (vn(a * 5 + sd, u * 6) - 0.5);
    const x = ca * rr, z = sa * rr; const yr = topH(ca * ra, sa * ra);
    const y = yr - cliff * smooth(0, 0.14, 1 - u) - D * Math.pow(1 - u, 1.45) * (0.4 + 1.2 * fbm(x * 0.05 + sd * 3, z * 0.05 - sd, 3));
    return new V3(x + off.x, y + off.y, z + off.z);
  };
  const col = new THREE.Color(), cA = C(pal.g1), cB = C(pal.g2), cD = C(pal.dirt), rA = C(pal.r1), rB = C(pal.r2);
  const hint = new V3(0, 1, 0), cen = new V3();
  const T = []; for (let i = 0; i <= NR; i++) { T.push([]); for (let j = 0; j <= NS; j++) T[i].push(top(i, j % NS)); }
  const topTri = (a, b, c) => {
    cen.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(off);
    const n = fbm(cen.x * 0.09 + sd, cen.z * 0.09, 2); col.copy(cA).lerp(cB, smooth(0.3, 0.7, n));
    if (def.topCol) def.topCol(cen.x, cen.z, cen.y, col, n);
    col.multiplyScalar(0.93 + jr() * 0.14); gb.tri(a, b, c, col, hint);
  };
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { if (i > 0) topTri(T[i][j], T[i + 1][j], T[i][j + 1]); topTri(T[i][j + 1], T[i + 1][j], T[i + 1][j + 1]); }
  const B = []; for (let i = 0; i <= NB; i++) { B.push([]); for (let j = 0; j <= NS; j++) B[i].push(i === 0 ? T[NR][j] : bot(i, j % NS)); }
  const bh = new V3();
  const botTri = (a, b, c, i) => {
    cen.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(off); const t = i / NB;
    if (i === 0) col.copy(cD); else { col.copy(rA).lerp(rB, Math.sin(cen.y * 0.42 + fbm(cen.x * 0.06, cen.z * 0.06, 2) * 7) > 0.1 ? 1 : 0); col.multiplyScalar(lerp(1.05, 0.6, t)); }
    col.multiplyScalar(0.9 + jr() * 0.2); bh.set(cen.x, -R * (0.25 + t * 1.5), cen.z); gb.tri(a, b, c, col, bh);
  };
  for (let i = 0; i < NB; i++) for (let j = 0; j < NS; j++) { botTri(B[i][j], B[i + 1][j], B[i][j + 1], i); if (i < NB - 1) botTri(B[i][j + 1], B[i + 1][j], B[i + 1][j + 1], i); }
  return { rad, topH };
}

// ---------------------------------------------------------------- Requisiten
function pine(c, x, z, s, cols) {
  const y = c.h(x, z) - 0.2; c.gb.add(GEO.cyl, xf(x, y + 0.9 * s, z, 0.3 * s, 1.9 * s, 0.3 * s), 0x6b4a2f);
  for (let k = 0; k < 3; k++) { const r = (1.9 - k * 0.48) * s; c.gb.add(GEO.cone, xf(x, y + (2.7 + k * 1.5) * s, z, r, 2.7 * s, r, 0, c.rng() * TAU, 0), cols[k], { jit: .12 }); }
}
function round(c, x, z, s, cols, trunk = 0x6b4a2f) {
  const y = c.h(x, z) - 0.2; c.gb.add(GEO.cyl, xf(x, y + 1.5 * s, z, 0.34 * s, 3 * s, 0.34 * s), trunk);
  c.gb.add(GEO.ico1, xf(x, y + 4.1 * s, z, 2.0 * s, 1.8 * s, 2.0 * s, c.rng(), c.rng() * 3, 0), cols[0], { jit: .1 });
  c.gb.add(GEO.ico0, xf(x + 1.2 * s, y + 3.5 * s, z + 0.5 * s, 1.3 * s, 1.2 * s, 1.3 * s, c.rng(), c.rng() * 3, 0), cols[1], { jit: .1 });
  c.gb.add(GEO.ico0, xf(x - 1.0 * s, y + 3.8 * s, z - 0.8 * s, 1.25 * s, 1.1 * s, 1.25 * s, c.rng(), c.rng() * 3, 0), cols[2], { jit: .1 });
}
function rock(c, x, z, s, col, lift = 0) {
  c.gb.add(GEO.ico0, xf(x, c.h(x, z) + s * 0.3 + lift, z, s * (0.8 + c.rng() * .5), s * (0.6 + c.rng() * .5), s * (0.8 + c.rng() * .5), c.rng() * 3, c.rng() * 3, c.rng() * 3), col, { jit: .14 });
}
function crystal(c, x, y, z, h, r, col, rx, rz) {
  const base = xf(x, y, z, 1, 1, 1, rx, c.rng() * TAU, rz);
  const fn = (p, cc) => { cc.lerp(C(0xffffff), clamp(p.y + 0.45, 0, 1) * 0.5); };
  c.glow.add(GEO.cyl6, base.clone().multiply(xf(0, h * 0.375, 0, r, h * 0.75, r)), col, { light: true, fn, jit: .1 });
  c.glow.add(new THREE.ConeGeometry(1, 1, 6), base.clone().multiply(xf(0, h * 0.875, 0, r, h * 0.25, r)), col, { light: true, fn: (p, cc) => cc.lerp(C(0xffffff), 0.55), jit: .1 });
}
function seg(b, x0, y0, z0, x1, y1, z1, w, col, o) { b.add(GEO.box, segM(new V3(x0, y0, z0), new V3(x1, y1, z1), w), col, o); }
function fall(c, wb, a, width, inLen, len, mistCol = 0xffffff) {
  const ca = Math.cos(a), sa = Math.sin(a), rimR = c.rad(a) * 0.985, G = 7, F = 9; const rx = -sa, rz = ca;
  let prev = null, dist = 0; const rimY = c.h(ca * rimR, sa * rimR) + 0.3;
  for (let k = 0; k <= G + F; k++) {
    let r, y, q = 0, w = width;
    if (k <= G) { r = rimR - (1 - k / G) * inLen; y = c.h(ca * r, sa * r) + 0.3; }
    else { q = (k - G) / F; r = rimR + 2.6 * (1 - Math.exp(-q * 6)); y = rimY - len * Math.pow(q, 1.5) - 0.6 * Math.min(1, q * 6); w = width * (1 + q * 0.7); }
    const cx = ca * r, cz = sa * r; const cur = { l: new V3(cx - rx * w / 2, y, cz - rz * w / 2), r: new V3(cx + rx * w / 2, y, cz + rz * w / 2), q, d: 0 };
    if (prev) { dist += prev.l.distanceTo(cur.l); cur.d = dist / 9; wb.quad(prev.l, prev.r, cur.r, cur.l, [0, prev.d], [1, prev.d], [1, cur.d], [0, cur.d], prev.q, prev.q, cur.q, cur.q); }
    prev = cur;
  }
  const P = c.def.pos; const mx = P[0] + ca * (rimR + 3), mz = P[2] + sa * (rimR + 3), my = P[1] + rimY - len;
  for (let i = 0; i < 4; i++) c.mists.push({ p: [mx + (c.rng() - .5) * 10, my + 6 + c.rng() * 14, mz + (c.rng() - .5) * 10], s: 16 + c.rng() * 16, c: mistCol, a: 0.3, m: [3, 0.5 + c.rng() * .5, c.rng() * 9, 0] });
}
const faceY = (a) => Math.PI / 2 - a;

// ---------------------------------------------------------------- Insel-Themen
export const ISLAND_DEFS = [
  {
    id: 'wald', name: 'Waldinsel', skill: 'Naturverbundenheit', icon: '🌿', glowHex: 0x8dff7a,
    desc: 'Du verstehst das Flüstern der Blätter. Wurzeln, Moos und Wind erzählen dir ihre Geheimnisse.',
    pos: [-95, 8, -235], R: 56, D: 78, seed: 11, hill: 3.2, ring: [0, 27, 0],
    pal: { g1: 0x66c456, g2: 0x3f9e4c, dirt: 0x7d5538, r1: 0x8d7b70, r2: 0x6c5d58 },
    build(c) {
      const { rng } = c;
      for (let i = 0; i < 52; i++) { const [x, z] = c.spot(0.28, 0.93); const s = 0.9 + rng() * 1.15; if (rng() < 0.62) pine(c, x, z, s, [0x2c8a50, 0x3aa35b, 0x58bf6c]); else round(c, x, z, s * 0.95, [0x58b85a, 0x86d05c, 0x3f9c52]); }
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, x = Math.cos(a) * 10, z = Math.sin(a) * 10, y = c.h(x, z); c.gb.add(GEO.box, xf(x, y + 2, z, 1.3, 4.4 + rng() * 2, 0.9, 0.08 * (rng() - .5), -a, 0.12 * (rng() - .5)), 0x9a9690, { jit: .1 }); c.glow.add(GEO.octa, xf(x, y + 5.6 + rng(), z, .35, .5, .35), 0xbfffa0); c.glows.push({ p: [x, y + 5.8, z], s: 3.5, c: 0x9dff8a, a: .7 }); }
      for (let i = 0; i < 18; i++) { const [x, z] = c.spot(0.1, 0.9); const y = c.h(x, z), s = 0.5 + rng() * 0.9; c.gb.add(GEO.cyl, xf(x, y + .5 * s, z, .22 * s, 1 * s, .22 * s), 0xf2e8d5); c.gb.add(GEO.cone, xf(x, y + 1.25 * s, z, .9 * s, .7 * s, .9 * s), rng() < .5 ? 0xe2503c : 0xf08a3c, { jit: .05 }); }
      for (let i = 0; i < 14; i++) { const [x, z] = c.spot(0.2, 0.97); rock(c, x, z, 0.8 + rng() * 1.8, 0x8f8a86); }
      for (let i = 0; i < 60; i++) { const [x, z] = c.spot(0.05, 0.95); c.gb.add(GEO.octa, xf(x, c.h(x, z) + .35, z, .28, .4, .28), [0xfff3a0, 0xffffff, 0xff9ecb, 0xa0d8ff][i % 4], { jit: 0 }); }
      fall(c, c.wb, 2.3, 3.2, 26, c.fallLen);
      for (let i = 0; i < 46; i++) { const [x, z] = c.spot(0, 0.95); c.motes.push({ p: [x, c.h(x, z) + 2 + rng() * 14, z], s: 0.9 + rng() * .8, c: 0xd8ff8a, a: .9, m: [2.5, .5 + rng() * .6, rng() * 20, 0] }); }
    },
  },
  {
    id: 'wasser', name: 'Wasserfall-Insel', skill: 'Heilkunst', icon: '💧', glowHex: 0x7fe8ff,
    desc: 'Das Quellwasser der Himmel schließt Wunden und beruhigt jedes aufgewühlte Herz.',
    pos: [185, 38, -335], R: 54, D: 70, seed: 23, hill: 1.6, ring: [0, 25, 0],
    pal: { g1: 0x6fd6a2, g2: 0x45b58c, dirt: 0x8a6a55, r1: 0x8a96b0, r2: 0x6d7896 },
    shape: (x, z, r) => -3.4 * smooth(19, 11, r),
    topCol: (x, z, y, col) => { const r = Math.hypot(x, z); if (r < 20) col.lerp(C(0xe8dcb0), smooth(20, 16, r)); },
    build(c) {
      const { rng } = c;
      c.wb.disc(0, -1.5, 0, 17.5, 22);
      [0.5, 1.75, 3.2, 4.45, 5.5].forEach((a, i) => fall(c, c.wb, a, 3.6 + (i % 2) * 1.8, c.rad(a) - 15, c.fallLen));
      const by = -2.2; c.gb.add(GEO.cyl12, xf(0, by, 0, 5, 2.4, 5), 0xe6e2da); c.gb.add(GEO.cyl12, xf(0, by + 1.5, 0, 4.2, .7, 4.2), 0xf4f1ea);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.gb.add(GEO.cyl, xf(Math.cos(a) * 3.4, by + 4.6, Math.sin(a) * 3.4, .32, 5.6, .32), 0xf4f1ea); }
      c.gb.add(GEO.cone10, xf(0, by + 9.2, 0, 5.2, 3.8, 5.2), 0x2fa7a0, { jit: .1 }); c.gb.add(GEO.ico0, xf(0, by + 11.5, 0, .5), 0xffe1a0);
      c.glow.add(GEO.ico1, xf(0, by + 4.3, 0, 1.1), 0xb6fff2, { light: true }); c.glows.push({ p: [0, by + 4.3, 0], s: 11, c: 0x7fffe0, a: .8 });
      for (let i = 0; i < 16; i++) { const [x, z] = c.spot(0.45, 0.92); round(c, x, z, 0.9 + rng() * 0.9, [0xffa6cf, 0xffc4dd, 0xf582b6], 0x5a4038); }
      for (let i = 0; i < 16; i++) { const a = rng() * TAU, r = 17 + rng() * 3; rock(c, Math.cos(a) * r, Math.sin(a) * r, 0.9 + rng() * 1.6, 0xb9bfd0); }
      for (let i = 0; i < 12; i++) { const a = rng() * TAU, r = 6 + rng() * 10, x = Math.cos(a) * r, z = Math.sin(a) * r; c.gb.add(GEO.cyl, xf(x, -1.4, z, .9, .08, .9), 0x3faa60); if (i % 2) c.gb.add(GEO.octa, xf(x, -1.15, z, .3), 0xffb0d8, { jit: 0 }); }
      for (let i = 0; i < 40; i++) { const [x, z] = c.spot(0.4, 0.95); c.gb.add(GEO.octa, xf(x, c.h(x, z) + .35, z, .28, .4, .28), [0xffffff, 0xffd0e6, 0xbff4ff][i % 3], { jit: 0 }); }
      for (let i = 0; i < 36; i++) { const [x, z] = c.spot(0, 0.9); c.motes.push({ p: [x, c.h(x, z) + 2 + rng() * 12, z], s: 0.9 + rng() * .7, c: 0xbffcff, a: .85, m: [2.5, .5 + rng() * .5, rng() * 20, 0] }); }
    },
  },
  {
    id: 'kristall', name: 'Kristallhöhle', skill: 'Arkane Magie', icon: '🔮', glowHex: 0xd58bff,
    desc: 'In den singenden Kristallen schlummert uralte Kraft – nun gehorcht sie deinem Willen.',
    pos: [395, -4, -55], R: 47, D: 82, seed: 37, hill: 3.5, ring: [13, 22, 10],
    pal: { g1: 0x6b58bb, g2: 0x4a3c95, dirt: 0x453763, r1: 0x57487e, r2: 0x3d3260 },
    build(c) {
      const { rng } = c; const cols = [0x4fe6ff, 0xf06bff, 0x9a7bff, 0x6affd9];
      const mx = -11, mz = -7, my = c.h(mx, mz) - 1;
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rng(), r = i === 0 ? 0 : 2 + rng() * 4.5, h = i === 0 ? 24 : 9 + rng() * 11; crystal(c, mx + Math.cos(a) * r, my, mz + Math.sin(a) * r, h, 1.2 + h * 0.07, cols[i % 2], i === 0 ? 0.05 : Math.sin(a) * 0.38, i === 0 ? 0 : -Math.cos(a) * 0.38); }
      c.glows.push({ p: [mx, my + 13, mz], s: 46, c: 0x7a9bff, a: .55 }, { p: [mx, my + 22, mz], s: 16, c: 0xaef6ff, a: .8 });
      c.colliders.push({ x: mx, z: mz, r: 7, top: my + 24 });
      for (let k = 0; k < 11; k++) {
        const [x, z] = c.spot(0.35, 0.92, mx, mz, 13); const y = c.h(x, z) - .6, n = 3 + (rng() * 4 | 0), col = cols[k % 4]; let hm = 0;
        for (let i = 0; i < n; i++) { const a = rng() * TAU, r = i ? 0.8 + rng() * 2 : 0, h = (i ? 2.5 : 5) + rng() * 5; hm = Math.max(hm, h); crystal(c, x + Math.cos(a) * r, y, z + Math.sin(a) * r, h, .5 + h * .08, col, Math.sin(a) * .45 * (i ? 1 : 0), -Math.cos(a) * .45 * (i ? 1 : 0)); }
        c.glows.push({ p: [x, y + hm * .6, z], s: hm * 2.8, c: col, a: .5 });
      }
      for (let i = 0; i < 16; i++) { const [x, z] = c.spot(0.2, 0.97); rock(c, x, z, 1.2 + rng() * 2.6, 0x54467c); }
      // Felsbogen
      const ax = 16, az = -20; const ay = c.h(ax, az);
      for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * Math.PI; c.gb.add(GEO.ico0, xf(ax + Math.cos(a) * 9, ay + Math.sin(a) * 12 - 1, az + Math.cos(a) * 3, 3.2 - Math.sin(a) * 0.8, 3.4, 3, rng() * 3, rng() * 3, 0), 0x5e4f8c, { jit: .14 }); }
      crystal(c, ax, ay + 10.2, az, 4, .7, 0x6affd9, Math.PI, 0); c.glows.push({ p: [ax, ay + 7.5, az], s: 9, c: 0x6affd9, a: .6 });
      for (let i = 0; i < 26; i++) { const [x, z] = c.spot(0.1, 0.95); const y = c.h(x, z); c.glow.add(GEO.cone, xf(x, y + .5, z, .45, .5, .45), i % 2 ? 0x7af2ff : 0xff8af4); c.glows.push({ p: [x, y + .7, z], s: 2.4, c: i % 2 ? 0x4fe6ff : 0xf06bff, a: .55 }); }
      for (let i = 0; i < 60; i++) { const [x, z] = c.spot(0, 0.95); c.motes.push({ p: [x, c.h(x, z) + 2 + rng() * 22, z], s: 0.9 + rng() * .9, c: cols[i % 4], a: .9, m: [3, .4 + rng() * .5, rng() * 20, 0] }); }
    },
  },
  {
    id: 'schmiede', name: 'Schmiede-Insel', skill: 'Schmiedekunst', icon: '⚒️', glowHex: 0xffa040,
    desc: 'Im Feuer des Himmelsvulkans formst du Sternenerz zu Werkzeugen von Legende.',
    pos: [325, 22, 265], R: 52, D: 74, seed: 41, hill: 2.2, ring: [18, 27, -17],
    pal: { g1: 0x5a4c4c, g2: 0x403636, dirt: 0x33282a, r1: 0x3d3234, r2: 0x2a2226 },
    build(c) {
      const { rng } = c; const vx = -12, vz = -9, vy = c.h(vx, vz) - 1, VH = 23;
      c.gb.add(cylT(0.36, 10), xf(vx, vy + VH / 2, vz, 16, VH, 16), 0x3b3032, { jit: .16, fn: (p, cc) => { if (p.y > 0.3) cc.lerp(C(0x8a3520), (p.y - 0.3) * 2.5); } });
      c.glow.add(GEO.cyl12, xf(vx, vy + VH + .05, vz, 5.4, .5, 5.4), 0xffb030, { jit: .12 });
      c.glows.push({ p: [vx, vy + VH + 3, vz], s: 46, c: 0xff6a1a, a: .6 }, { p: [vx, vy + VH + 1, vz], s: 16, c: 0xffd070, a: .8 });
      c.colliders.push({ x: vx, z: vz, r: 14, top: vy + VH + 1 });
      const lavaA = 0.95;
      for (const a of [lavaA, 2.9, 4.6]) { const ca = Math.cos(a), sa = Math.sin(a); for (let k = 0; k < 5; k++) { const t0 = k / 5, t1 = (k + 1) / 5 + 0.02, w = 1.3 + Math.sin(k * 2.1 + a) * .5; const r0 = lerp(5.9, 16.2, t0), r1 = lerp(5.9, 16.2, t1); seg(c.glow, vx + ca * r0, vy + VH * (1 - t0) + .1, vz + sa * r0, vx + ca * r1, vy + VH * (1 - t1) + .1, vz + sa * r1, w, 0xff7a1a, { jit: .25, fn: (p, cc) => cc.lerp(C(0xffe070), rng() * .5) }); } c.glows.push({ p: [vx + ca * 11, vy + 11, vz + sa * 11], s: 14, c: 0xff5a14, a: .45 }); }
      // Lavastrom zur Kante
      c.lb.disc(vx + Math.cos(lavaA) * 18, vy + 1.25, vz + Math.sin(lavaA) * 18, 4.5, 10);
      fall(c, c.lb, 0.78, 3.4, c.rad(0.78) - 12, c.fallLen * 0.8, 0xffb070);
      c.glows.push({ p: [Math.cos(0.78) * c.rad(0.78), -4, Math.sin(0.78) * c.rad(0.78)], s: 22, c: 0xff6a1a, a: .5 });
      // Schmiede
      const fx = 15, fz = 12, fy = c.h(fx, fz) - .5;
      c.gb.add(GEO.box, xf(fx, fy + 3.5, fz, 10, 7, 8, 0, .4, 0), 0x7a6e68, { jit: .1 });
      c.gb.add(GEO.cone4, xf(fx, fy + 9.2, fz, 8.2, 4.6, 8.2, 0, .4 + Math.PI / 4, 0), 0x8a3a30, { jit: .1 });
      c.gb.add(GEO.box, xf(fx + 2.5, fy + 9.5, fz - 2, 1.9, 8, 1.9, 0, .4, 0), 0x5a504c);
      c.glow.add(GEO.box, xf(fx + 2.5, fy + 13.6, fz - 2, 1.3, .3, 1.3, 0, .4, 0), 0xffa040);
      c.glow.add(GEO.box, xf(fx - 4.7, fy + 2.4, fz + 2.0, .4, 4.2, 3, 0, .4, 0), 0xffb650); c.glows.push({ p: [fx - 5.6, fy + 2.5, fz + 2.4], s: 13, c: 0xff9a30, a: .7 });
      for (let i = 0; i < 26; i++) c.motes.push({ p: [fx + 2.5 + (rng() - .5) * 2, fy + 13, fz - 2 + (rng() - .5) * 2], s: .8 + rng() * .8, c: 0xffa040, a: .95, m: [1.5, .8 + rng(), rng() * 20, 6 + rng() * 6] });
      // Amboss
      const ax = 3, az = -27, ay = c.h(ax, az);
      c.gb.add(GEO.cyl, xf(ax, ay + .8, az, 4.4, 1.8, 4.4), 0x6a5e5a); const S = 1.5, dk = 0x2c2c36;
      c.gb.add(GEO.box, xf(ax, ay + 1.7 + .5 * S, az, 3 * S, 1 * S, 2 * S), dk, { jit: .12 }); c.gb.add(GEO.box, xf(ax, ay + 1.7 + 1.6 * S, az, 1.5 * S, 1.3 * S, 1.3 * S), dk, { jit: .12 });
      c.gb.add(GEO.box, xf(ax, ay + 1.7 + 2.8 * S, az, 4.2 * S, 1.1 * S, 2.1 * S), 0x3a3a48, { jit: .12 }); c.gb.add(GEO.cone, xf(ax + 3.2 * S, ay + 1.7 + 2.85 * S, az, .55 * S, 2.4 * S, .9 * S, 0, 0, -Math.PI / 2), 0x3a3a48);
      c.glow.add(GEO.box, xf(ax - .4, ay + 1.7 + 3.5 * S, az, 5.5, .3, .7, 0, .5, 0), 0xffc050, { jit: .1 }); c.glows.push({ p: [ax, ay + 7.5, az], s: 10, c: 0xffa040, a: .7 });
      for (let i = 0; i < 20; i++) { const [x, z] = c.spot(0.3, 0.97, vx, vz, 17); rock(c, x, z, 1 + rng() * 2.6, 0x2e2628); }
      for (let i = 0; i < 16; i++) { const [x, z] = c.spot(0.3, 0.92, vx, vz, 17); const y = c.h(x, z) + .1, a = rng() * TAU, l = 2 + rng() * 4; seg(c.glow, x, y, z, x + Math.cos(a) * l, y + .05, z + Math.sin(a) * l, .35, 0xff6a1a, { jit: .2 }); c.glows.push({ p: [x, y + .5, z], s: 5, c: 0xff5a14, a: .35 }); }
      for (let i = 0; i < 34; i++) c.motes.push({ p: [vx + (rng() - .5) * 9, vy + VH, vz + (rng() - .5) * 9], s: 1 + rng(), c: i % 3 ? 0xff8a30 : 0xffd070, a: .95, m: [2.5, .6 + rng(), rng() * 20, 5 + rng() * 8] });
    },
  },
  {
    id: 'bibliothek', name: 'Bibliotheksturm', skill: 'Altes Wissen', icon: '📚', glowHex: 0xffd97a,
    desc: 'Tausend schwebende Bücher öffnen sich dir. Kein Rätsel bleibt lange verborgen.',
    pos: [35, 72, 400], R: 45, D: 80, seed: 53, hill: 2, ring: [23, 22, 15],
    pal: { g1: 0xa9cc5c, g2: 0x7fae4f, dirt: 0x8a6240, r1: 0x9a8a7a, r2: 0x786a60 },
    build(c) {
      const { rng } = c; const tx = -6, tz = -4, ty = c.h(tx, tz) - 1, TH = 32, st = 0xdccfb8;
      c.gb.add(GEO.cyl12, xf(tx, ty + 1.2, tz, 9.2, 2.4, 9.2), 0xb9ab96);
      c.gb.add(cylT(0.8, 12), xf(tx, ty + TH / 2, tz, 7.6, TH, 7.6), st, { jit: .08 });
      c.gb.add(GEO.cyl12, xf(tx, ty + TH - 6, tz, 7.4, 1, 7.4), 0xb9ab96); c.gb.add(GEO.cyl12, xf(tx, ty + TH + .4, tz, 7.6, 1.2, 7.6), 0xb9ab96);
      c.gb.add(new THREE.ConeGeometry(1, 1, 12), xf(tx, ty + TH + 8, tz, 8.8, 15, 8.8), 0x3d5fb4, { jit: .12 });
      c.glow.add(GEO.ico0, xf(tx, ty + TH + 16.2, tz, 1), 0xffe9a8, { light: true }); c.glows.push({ p: [tx, ty + TH + 16.2, tz], s: 16, c: 0xffd97a, a: .9 });
      for (let l = 0; l < 4; l++) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + l * .5, hh = 6 + l * 6.6, rr = 7.6 * lerp(1, .8, hh / TH) - 0.08; c.glow.add(GEO.box, xf(tx + Math.cos(a) * rr, ty + hh, tz + Math.sin(a) * rr, 1.25, 2.5, .5, 0, faceY(a), 0), 0xffdf8a, { jit: .08 }); if (i % 2 === 0) c.glows.push({ p: [tx + Math.cos(a) * (rr + .6), ty + hh, tz + Math.sin(a) * (rr + .6)], s: 6.5, c: 0xffc860, a: .55 }); }
      c.glow.add(GEO.box, xf(tx + Math.cos(.6) * 7.6, ty + 3.6, tz + Math.sin(.6) * 7.6, 2.6, 4.6, .6, 0, faceY(.6), 0), 0xffca6a);
      c.colliders.push({ x: tx, z: tz, r: 9.5, top: ty + TH + 17 });
      const ux = 7, uz = 8, uy = c.h(ux, uz) - 1;
      c.gb.add(cylT(0.85, 8), xf(ux, uy + 9, uz, 3.6, 18, 3.6), st, { jit: .08 }); c.gb.add(GEO.cone, xf(ux, uy + 22, uz, 4.6, 8, 4.6), 0x8a3f7a, { jit: .1 });
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + .3; c.glow.add(GEO.box, xf(ux + Math.cos(a) * 3.25, uy + 12, uz + Math.sin(a) * 3.25, .9, 1.9, .4, 0, faceY(a), 0), 0xffdf8a); }
      c.colliders.push({ x: ux, z: uz, r: 5, top: uy + 26 });
      // schwebende Bücher (eigenes, rotierendes Mesh)
      const bb = new GB(); const bc = [0xc0392b, 0x2e6fb7, 0x2f9e6a, 0x8e44ad, 0xd98a2b, 0x1f8a8a];
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * TAU + rng() * .2, r = 12 + rng() * 9, y = ty + 12 + rng() * 34, s = 1 + rng() * .9;
        const m = xf(Math.cos(a) * r, y, Math.sin(a) * r, s, s, s, (rng() - .5) * 1.2, rng() * TAU, (rng() - .5) * 1.2);
        if (i % 3) { bb.add(GEO.box, m.clone().multiply(xf(0, 0, 0, 1.7, .42, 2.3)), bc[i % 6], { jit: .06 }); bb.add(GEO.box, m.clone().multiply(xf(0.08, 0, 0, 1.62, .3, 2.38)), 0xfff3d6, { jit: .02 }); }
        else { for (const sg of [-1, 1]) { bb.add(GEO.box, m.clone().multiply(xf(sg * .82, .2, 0, 1.6, .1, 2.3, 0, 0, sg * .35)), bc[i % 6]); bb.add(GEO.box, m.clone().multiply(xf(sg * .8, .32, 0, 1.5, .16, 2.15, 0, 0, sg * .35)), 0xfff3d6, { jit: .02 }); } }
        if (i % 4 === 0) c.glows.push({ p: [tx + Math.cos(a) * r * .0, y, tz], s: 0, c: 0, a: 0 });
      }
      const books = new THREE.Mesh(bb.build(), mats().lit); books.position.set(tx, 0, tz); c.group.add(books);
      c.anims.push((t) => { books.rotation.y = t * 0.12; books.position.y = Math.sin(t * .6) * .8; });
      for (let i = 0; i < 9; i++) { const [x, z] = c.spot(0.5, 0.92, tx, tz, 14); round(c, x, z, 0.9 + rng() * .8, [0xe9b840, 0xf0cf55, 0xdc8f2e]); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3, r = 24 + rng() * 6, x = Math.cos(a) * r, z = Math.sin(a) * r, y = c.h(x, z); c.gb.add(GEO.cyl, xf(x, y + 2.2, z, .18, 4.4, .18), 0x40384a); c.glow.add(GEO.octa, xf(x, y + 4.8, z, .5, .7, .5), 0xffe9a8); c.glows.push({ p: [x, y + 4.8, z], s: 7, c: 0xffc860, a: .7 }); }
      for (let i = 0; i < 7; i++) { const [x, z] = c.spot(0.4, 0.9, tx, tz, 13); const y = c.h(x, z); c.gb.add(GEO.box, xf(x, y + 1.6, z, 2.2, 3.4, .5, 0, rng() * 3, .06), 0xbfb5a6, { jit: .1 }); }
      for (let i = 0; i < 50; i++) { const [x, z] = c.spot(0.2, 0.95); c.gb.add(GEO.octa, xf(x, c.h(x, z) + .35, z, .28, .4, .28), [0xfff3a0, 0xffffff, 0xffb070][i % 3], { jit: 0 }); }
      for (let i = 0; i < 40; i++) { const a = rng() * TAU, r = 9 + rng() * 14; c.motes.push({ p: [tx + Math.cos(a) * r, ty + 6 + rng() * 40, tz + Math.sin(a) * r], s: .9 + rng() * .8, c: 0xffe19a, a: .9, m: [3, .4 + rng() * .5, rng() * 20, 0] }); }
    },
  },
  {
    id: 'hafen', name: 'Wolkenhafen', skill: 'Windreiten', icon: '🪁', glowHex: 0x9fe8ff,
    desc: 'Du liest die Strömungen der Lüfte wie eine Karte – der Himmel gehört dir.',
    pos: [-275, 96, 295], R: 50, D: 68, seed: 67, hill: 2.4, ring: [1, 30, 0],
    pal: { g1: 0x9bdc7c, g2: 0x74c46e, dirt: 0x9a7048, r1: 0xa89684, r2: 0x86766a },
    build(c) {
      const { rng } = c; const wood = 0xa8743f, wood2 = 0x8a5a30;
      const mill = (x, z, s, face, sp) => {
        const y = c.h(x, z) - .8;
        c.gb.add(cylT(0.62, 8), xf(x, y + 7 * s, z, 3.4 * s, 14 * s, 3.4 * s), 0xf3eee2, { jit: .06 });
        c.gb.add(GEO.cone, xf(x, y + 16 * s, z, 3.2 * s, 4.2 * s, 3.2 * s), 0xd9523f, { jit: .1 });
        c.glow.add(GEO.box, xf(x + Math.cos(face) * 3 * s, y + 2.2, z + Math.sin(face) * 3 * s, 1.4, 2.6, .5, 0, faceY(face), 0), 0xffd98a);
        c.glow.add(GEO.box, xf(x + Math.cos(face + 2) * 2.5 * s, y + 9 * s, z + Math.sin(face + 2) * 2.5 * s, 1, 1.5, .4, 0, faceY(face + 2), 0), 0xffd98a);
        const sb = new GB();
        for (let i = 0; i < 4; i++) { const m = xf(0, 0, 0, 1, 1, 1, 0, 0, i * Math.PI / 2); sb.add(GEO.box, m.clone().multiply(xf(0, 5.2 * s, 0, .3 * s, 10.4 * s, .3 * s)), wood2); sb.add(GEO.box, m.clone().multiply(xf(1.25 * s, 6.3 * s, .12, 2.3 * s, 7.4 * s, .12)), i % 2 ? 0xfaf5ea : 0xf2c9b0, { jit: .05 }); }
        sb.add(GEO.cone, xf(0, 0, .4, .7 * s, 1.4 * s, .7 * s, Math.PI / 2, 0, 0), 0x8a5a30);
        const holder = new THREE.Group(); holder.position.set(x + Math.cos(face) * 3.1 * s, y + 13.4 * s, z + Math.sin(face) * 3.1 * s); holder.rotation.y = faceY(face);
        const sails = new THREE.Mesh(sb.build(), mats().lit); holder.add(sails); c.group.add(holder);
        c.anims.push((t) => { sails.rotation.z = t * sp; });
        c.colliders.push({ x, z, r: 4.2 * s, top: y + 18 * s });
      };
      mill(-19, -13, 1.25, 0.9, 0.55); mill(21, 17, 0.95, 2.4, -0.7);
      // Steg + Luftschiff
      const pa = -0.55, ca = Math.cos(pa), sa = Math.sin(pa), r0 = c.rad(pa) - 14, py = c.h(ca * r0, sa * r0) + 1.1, L = 34;
      for (let i = 0; i < 17; i++) { const r = r0 + i * 2; c.gb.add(GEO.box, xf(ca * r, py, sa * r, 1.8, .3, 5.4, 0, -pa, 0), i % 2 ? wood : wood2, { jit: .08 }); }
      for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) { const r = r0 + 2 + i * 7.6, x = ca * r - sa * sd * 2.6, z = sa * r + ca * sd * 2.6; c.gb.add(GEO.cyl, xf(x, py - 2.4, z, .28, 7.6, .28), wood2); if (i === 4 || i === 2) { c.glow.add(GEO.octa, xf(x, py + 2, z, .4, .55, .4), 0xffe9a8); c.glows.push({ p: [x, py + 2, z], s: 6, c: 0xffc860, a: .7 }); } }
      const sx = ca * (r0 + L + 5), sz = sa * (r0 + L + 5), sy = py + 10;
      const bm = xf(sx, sy, sz, 1, 1, 1, 0, -pa + Math.PI / 2, 0);
      c.gb.add(GEO.ico1, bm.clone().multiply(xf(0, 0, 0, 4.6, 4.2, 9.5)), 0xf6efe2, { jit: .04, fn: (p, cc) => { if (Math.floor((Math.atan2(p.y, p.x) + Math.PI) / TAU * 8) % 2) cc.set(0xe2574c); } });
      c.gb.add(GEO.box, bm.clone().multiply(xf(0, -6.6, 0, 2.6, 1.7, 6.2)), wood, { jit: .1 }); c.gb.add(GEO.box, bm.clone().multiply(xf(0, -5.4, 0, 3, .3, 6.6)), wood2);
      for (const zz of [-2.4, 2.4]) for (const xx of [-1.2, 1.2]) c.gb.add(GEO.box, bm.clone().multiply(xf(xx, -4.6, zz, .1, 3, .1)), 0x5a4030);
      c.gb.add(GEO.box, bm.clone().multiply(xf(0, 0, 9.3, .2, 5, 3.4)), 0xe2574c); c.gb.add(GEO.box, bm.clone().multiply(xf(0, 0, 9.3, 5, .2, 3.4)), 0xe2574c);
      c.glow.add(GEO.octa, bm.clone().multiply(xf(0, -5.6, -3.6, .4)), 0xffe9a8); c.glows.push({ p: [sx, sy - 5.6, sz], s: 8, c: 0xffc860, a: .6 });
      // Ballons
      const bal = [[-6, 26, 0xffcf4a, 0xff8a3c], [12, -24, 0x4ac6c0, 0xf6efe2], [-30, 12, 0xff8fb8, 0xf6efe2]];
      bal.forEach(([x, z, c1, c2], i) => { const y = c.h(x, z), hh = 15 + i * 4; c.gb.add(GEO.ico1, xf(x, y + hh, z, 3, 3.5, 3), c1, { jit: .03, fn: (p, cc) => { if (Math.floor((Math.atan2(p.z, p.x) + Math.PI) / TAU * 8) % 2) cc.set(c2); } }); c.gb.add(GEO.cone, xf(x, y + hh - 3.6, z, 1.6, 2.4, 1.6, Math.PI, 0, 0), c1); c.gb.add(GEO.box, xf(x, y + hh - 6, z, 1.3, 1.1, 1.3), wood); seg(c.gb, x, y, z, x, y + hh - 6, z, .08, 0x5a4030); });
      for (let i = 0; i < 9; i++) { const [x, z] = c.spot(0.55, 0.93); const y = c.h(x, z), hh = 6 + rng() * 3; c.gb.add(GEO.cyl, xf(x, y + hh / 2, z, .12, hh, .12), 0x5a4030); const col = [0xe2574c, 0x4ac6c0, 0xffcf4a][i % 3]; const a = rng() * TAU, q = new V3(x, y + hh, z), q2 = new V3(x, y + hh - 1.4, z), q3 = new V3(x + Math.cos(a) * 2.8, y + hh - .6, z + Math.sin(a) * 2.8); c.gb.tri(q, q2, q3, C(col)); c.gb.tri(q, q3, q2, C(col)); }
      for (let i = 0; i < 12; i++) { const [x, z] = c.spot(0.2, 0.85); const y = c.h(x, z), s = 1 + rng() * .8; if (i % 2) c.gb.add(GEO.box, xf(x, y + s * .5, z, s, s, s, 0, rng() * 3, 0), wood, { jit: .12 }); else c.gb.add(GEO.cyl, xf(x, y + s * .6, z, s * .5, s * 1.2, s * .5), wood2, { jit: .12 }); }
      for (let i = 0; i < 12; i++) { const [x, z] = c.spot(0.4, 0.93); round(c, x, z, 0.8 + rng() * .7, [0x8fd66a, 0xb9e67a, 0x6fc468]); }
      for (let i = 0; i < 50; i++) { const [x, z] = c.spot(0.1, 0.95); c.gb.add(GEO.octa, xf(x, c.h(x, z) + .35, z, .28, .4, .28), [0xffffff, 0xfff3a0, 0xff9ecb][i % 3], { jit: 0 }); }
      for (let i = 0; i < 30; i++) { const [x, z] = c.spot(0, 0.95); c.motes.push({ p: [x, c.h(x, z) + 3 + rng() * 22, z], s: .8 + rng() * .7, c: 0xeafcff, a: .8, m: [4, .5 + rng() * .5, rng() * 20, 0] }); }
    },
  },
  {
    id: 'mond', name: 'Mondtempel', skill: 'Mondmystik', icon: '🌙', glowHex: 0xb8ccff,
    desc: 'Das silberne Licht zeigt dir, was zwischen den Welten verborgen liegt.',
    pos: [-455, 128, -25], R: 48, D: 76, seed: 79, hill: 1.2, ring: [0, 27, 0],
    pal: { g1: 0x86aed2, g2: 0x5f89b8, dirt: 0x6a6490, r1: 0x9aa0c4, r2: 0x747aa6 },
    build(c) {
      const { rng } = c; const y0 = c.h(0, 0) - .6, mar = 0xeceffa;
      c.gb.add(cylT(1, 14), xf(0, y0 + .5, 0, 17.5, 1.2, 17.5), 0xcfd4ea, { jit: .05 }); c.gb.add(cylT(1, 14), xf(0, y0 + 1.5, 0, 15, 1, 15), mar, { jit: .05 });
      const tops = [];
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU, x = Math.cos(a) * 12.4, z = Math.sin(a) * 12.4; const broken = i === 3 || i === 7, h = broken ? 4 + rng() * 3.5 : 11.5;
        c.gb.add(GEO.box, xf(x, y0 + 2.4, z, 2.6, .8, 2.6, 0, -a, 0), mar); c.gb.add(cylT(0.86, 8), xf(x, y0 + 2.8 + h / 2, z, 1.05, h, 1.05), mar, { jit: .07 });
        if (!broken) { c.gb.add(GEO.box, xf(x, y0 + 2.8 + h + .4, z, 2.7, .8, 2.7, 0, -a, 0), mar); tops.push([i, x, y0 + 2.8 + h + 1.2, z]); } else tops.push(null);
      }
      for (let i = 0; i < 10; i++) { const A = tops[i], B = tops[(i + 1) % 10]; if (A && B) seg(c.gb, A[1], A[2], A[3], B[1], B[2], B[3], 1.5, 0xdfe3f2, { jit: .06 }); }
      c.gb.add(GEO.cyl12, xf(0, y0 + 2.9, 0, 2.6, 1.8, 2.6), 0xcfd4ea); c.glow.add(GEO.cyl12, xf(0, y0 + 3.85, 0, 2.1, .12, 2.1), 0xbcd0ff);
      const ob = new GB(); ob.add(GEO.ico1, xf(0, 0, 0, 2.3), 0xe8eeff, { light: true, jit: .05 });
      ob.add(GEO.torus, xf(0, 0, 0, 3.9, 3.9, 3.9, 1.2, 0, 0), 0xffe9b0); ob.add(GEO.torus, xf(0, 0, 0, 4.8, 4.8, 4.8, .3, 0, .9), 0xbcd0ff);
      const orb = new THREE.Mesh(ob.build(), mats().unlit); orb.position.set(0, y0 + 9.5, 0); c.group.add(orb);
      c.anims.push((t) => { orb.rotation.set(t * .3, t * .5, t * .2); orb.position.y = y0 + 9.5 + Math.sin(t * .9) * .6; });
      c.glows.push({ p: [0, y0 + 9.5, 0], s: 30, c: 0x9fbaff, a: .7 }, { p: [0, y0 + 9.5, 0], s: 10, c: 0xffffff, a: .7 });
      for (let i = 0; i < 14; i++) { const [x, z] = c.spot(0.5, 0.93); round(c, x, z, 0.9 + rng() * .9, [0xc6d8f5, 0xe4ecff, 0xa2bbe8], 0x6a6088); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .4, r = c.rad(a) * 0.8, x = Math.cos(a) * r, z = Math.sin(a) * r, y = c.h(x, z); c.glow.add(GEO.octa, xf(x, y + 3, z, 1, 3.4, 1, 0, rng() * 3, 0), 0xcfdcff, { light: true }); c.glows.push({ p: [x, y + 3.5, z], s: 10, c: 0x9fbaff, a: .6 }); }
      for (let i = 0; i < 34; i++) { const [x, z] = c.spot(0.36, 0.95); const y = c.h(x, z); c.glow.add(GEO.octa, xf(x, y + .5, z, .3, .5, .3), 0xd6e6ff); if (i % 2) c.glows.push({ p: [x, y + .6, z], s: 2.6, c: 0x9fd0ff, a: .6 }); }
      for (let i = 0; i < 10; i++) { const [x, z] = c.spot(0.4, 0.97); rock(c, x, z, 1 + rng() * 1.6, 0xb4b9d6); }
      for (let i = 0; i < 50; i++) { const [x, z] = c.spot(0, 0.95); c.motes.push({ p: [x, c.h(x, z) + 2 + rng() * 22, z], s: .9 + rng() * .8, c: 0xd6e4ff, a: .9, m: [3, .35 + rng() * .4, rng() * 20, 0] }); }
    },
  },
  {
    id: 'drache', name: 'Drachenhorst', skill: 'Drachenmut', icon: '🐉', glowHex: 0xff7a5a,
    desc: 'Wer dem Drachenei nahe kam, ohne zu zittern, fürchtet keinen Sturm mehr.',
    pos: [-335, 58, -405], R: 47, D: 86, seed: 97, hill: 4, ring: [9, 27, 7],
    pal: { g1: 0xb96a44, g2: 0x935038, dirt: 0x6a3a2e, r1: 0x7c4638, r2: 0x58302c },
    build(c) {
      const { rng } = c; const rk = 0x8a4c3a;
      const spire = (x, z, H, R0, lean) => {
        let y = c.h(x, z) - 2, px = x, pz = z, r = R0; const n = 5;
        for (let i = 0; i < n; i++) { const h = H / n * (1.25 - i * .1), nr = r * 0.74; c.gb.add(cylT(nr / r, 7), xf(px, y + h / 2, pz, r, h, r, (rng() - .5) * .16, rng() * 3, (rng() - .5) * .16), rk, { jit: .16, fn: (p, cc) => { if (rng() < .25) cc.set(0x6a3a30); } }); y += h * 0.93; px += lean[0] * h * .12; pz += lean[1] * h * .12; r = nr; }
        c.gb.add(GEO.cone, xf(px, y + r * 1.1, pz, r, r * 2.6, r), 0x9a5a44, { jit: .12 });
        c.colliders.push({ x: x + lean[0] * H * .05, z: z + lean[1] * H * .05, r: R0 * 0.95, top: y + r * 2.4 });
      };
      spire(-15, 7, 40, 9, [.6, -.3]); spire(13, -19, 20, 5.5, [-.5, .4]); spire(-4, 24, 13, 4, [.2, .5]);
      const nx = 9, nz = 7, ny = c.h(nx, nz) - 1;
      c.gb.add(cylT(0.75, 9), xf(nx, ny + 2, nz, 12, 4.4, 12), 0x6a3a30, { jit: .14 });
      for (let i = 0; i < 80; i++) { const a = rng() * TAU, r = 6.2 + rng() * 2.6, y = ny + 4.2 + rng() * 2.6 - (r - 6.2) * .3, l = 2.5 + rng() * 2.5, ta = a + Math.PI / 2 + (rng() - .5) * .9; const x = nx + Math.cos(a) * r, z = nz + Math.sin(a) * r, dy = (rng() - .5) * 1.4; seg(c.gb, x - Math.cos(ta) * l, y - dy, z - Math.sin(ta) * l, x + Math.cos(ta) * l, y + dy, z + Math.sin(ta) * l, .3 + rng() * .25, [0x7a5234, 0x5e3d28, 0x94683f][i % 3], { jit: .12 }); }
      c.gb.add(GEO.cyl12, xf(nx, ny + 4.5, nz, 6.3, .6, 6.3), 0xd8c690, { jit: .08 });
      const eb = new GB(); eb.add(GEO.ico1, xf(0, 0, 0, 3.1, 4.3, 3.1), 0xffe6a8, { jit: .05, fn: (p, cc) => { if (vn(p.x * 3.1 + 5, p.y * 3.1 + p.z * 2.3) > 0.62) cc.set(0x38b8a4); } });
      const egg = new THREE.Mesh(eb.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a3a10 })); egg.position.set(nx, ny + 8.4, nz); egg.rotation.z = .14; c.group.add(egg);
      c.anims.push((t) => { const s = 1 + Math.sin(t * 2.2) * .025; egg.scale.set(s, 2 - s, s); egg.material.emissive.setRGB(.36 + .16 * Math.sin(t * 2.2), .2 + .08 * Math.sin(t * 2.2), .06); });
      c.glows.push({ p: [nx, ny + 8.4, nz], s: 26, c: 0xffa040, a: .6 });
      for (const [ox, oz, s] of [[4.2, 2.6, .5], [-3.4, 3.4, .42]]) c.gb.add(GEO.ico1, xf(nx + ox, ny + 5.6, nz + oz, 3 * s, 4 * s, 3 * s, .3, 0, .4), 0xf2dca8, { jit: .05 });
      // Rippenbögen + Schädel
      const bx = 24, bz = -3, bone = 0xefe8d6;
      for (let i = 0; i < 6; i++) { const z = bz + i * 2.6 - 6, y = c.h(bx, z), w = 3.4 - Math.abs(i - 2.5) * .35, hh = 5.2 - Math.abs(i - 2.5) * .5; for (const sg of [-1, 1]) { seg(c.gb, bx + sg * w, y - .3, z, bx + sg * w * 1.1, y + hh * .6, z, .4, bone); seg(c.gb, bx + sg * w * 1.1, y + hh * .6, z, bx + sg * .4, y + hh, z, .34, bone); } }
      const sy = c.h(bx, bz - 10); c.gb.add(GEO.ico0, xf(bx, sy + 1.6, bz - 10.5, 2.2, 1.7, 2.9), bone, { jit: .06 }); for (const sg of [-1, 1]) c.gb.add(GEO.cone, xf(bx + sg * 1.6, sy + 3.3, bz - 9.4, .5, 3.2, .5, .7, 0, -sg * .5), bone);
      for (let i = 0; i < 7; i++) { const [x, z] = c.spot(0.5, 0.93, nx, nz, 14); const y = c.h(x, z), hh = 4 + rng() * 4, dk = 0x3d2a26; seg(c.gb, x, y - .3, z, x + (rng() - .5), y + hh, z + (rng() - .5), .5, dk); for (let k = 0; k < 3; k++) { const a = rng() * TAU, t = .45 + k * .2; seg(c.gb, x, y + hh * t, z, x + Math.cos(a) * 2.4, y + hh * t + 1.8, z + Math.sin(a) * 2.4, .26, dk); } }
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + .5, r = 17 + (i % 2) * 5, x = nx + Math.cos(a) * r, z = nz + Math.sin(a) * r; if (Math.hypot(x, z) > c.R * .7) continue; const y = c.h(x, z); c.gb.add(cylT(1.5, 7), xf(x, y + .9, z, .9, 1.8, .9), 0x4e2b28); c.glow.add(GEO.cone, xf(x, y + 2.9, z, .95, 2.6, .95), 0xffa030, { jit: .2, fn: (p, cc) => cc.lerp(C(0xfff0a0), clamp(.3 - p.y, 0, 1)) }); c.glows.push({ p: [x, y + 3, z], s: 11, c: 0xff7a2a, a: .75 }); for (let k = 0; k < 6; k++) c.motes.push({ p: [x, y + 2, z], s: .7 + rng() * .5, c: 0xffa040, a: .9, m: [1.2, .8 + rng(), rng() * 20, 3 + rng() * 5] }); }
      for (let i = 0; i < 22; i++) { const [x, z] = c.spot(0.3, 0.97); rock(c, x, z, 1 + rng() * 2.8, 0x7a4436); }
      for (let i = 0; i < 26; i++) { const [x, z] = c.spot(0, 0.95); c.motes.push({ p: [x, c.h(x, z) + 2 + rng() * 26, z], s: .9 + rng() * .7, c: 0xffb070, a: .85, m: [3, .5 + rng() * .5, rng() * 20, 0] }); }
    },
  },
];

// ---------------------------------------------------------------- Insel zusammenbauen
export function buildIsland(def, shared) {
  const M = mats(); const rng = mulberry(def.seed * 7919 + 13);
  const group = new THREE.Group(); group.position.set(def.pos[0], def.pos[1], def.pos[2]);
  const gb = new GB(), glow = new GB(), wb = new WB(), lb = new WB();
  const { rad, topH } = terrain(gb, def, new V3());
  const c = { def, gb, glow, wb, lb, rng, group, rad, h: topH, R: def.R, glows: [], motes: [], mists: shared.mists, colliders: [], anims: [], fallLen: def.pos[1] - SEA_Y - 22 };
  c.spot = (u0, u1, ax, az, ar) => {
    for (let k = 0; k < 30; k++) {
      const a = rng() * TAU, u = Math.sqrt(lerp(u0 * u0, u1 * u1, rng())), r = rad(a) * u, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (ax !== undefined && Math.hypot(x - ax, z - az) < ar) continue;
      if (Math.hypot(x - def.ring[0], z - def.ring[2]) < 4.5) continue;
      return [x, z];
    } return [rad(0) * u1 * .9, 0];
  };
  def.build(c);
  // Ranken, Wurzeln, Treibfelsen
  const vine = def.pal.vine || def.pal.g2;
  for (let i = 0; i < 22; i++) {
    const a = rng() * TAU, r = rad(a) * (0.93 + rng() * .06), x = Math.cos(a) * r, z = Math.sin(a) * r, y = topH(x, z) - 1, l = 5 + rng() * 15;
    const ox = Math.cos(a) * 1.6, oz = Math.sin(a) * 1.6;
    seg(gb, x, y + 1.2, z, x + ox, y - l * .4, z + oz, .4, vine); seg(gb, x + ox, y - l * .4, z + oz, x + ox * 1.2, y - l, z + oz * 1.2, .26, vine);
    for (let k = 0; k < 3; k++) gb.add(GEO.octa, xf(x + ox * (1 + k * .1), y - l * (.3 + k * .3), z + oz * (1 + k * .1), .7, .5, .7, rng(), rng(), 0), def.pal.g1);
  }
  for (let i = 0; i < 11; i++) {
    const a = rng() * TAU, r = def.R * (1.0 + rng() * .5), x = Math.cos(a) * r, z = Math.sin(a) * r, y = -6 - rng() * def.D * .6, s = 1.4 + rng() * 3.6;
    gb.add(GEO.ico0, xf(x, y, z, s, s * 1.25, s, rng() * 3, rng() * 3, 0), def.pal.r1, { jit: .16 });
    gb.add(GEO.cone, xf(x, y - s * 1.3, z, s * .75, s * 1.6, s * .75, Math.PI, 0, 0), def.pal.r2, { jit: .16 });
    if (s > 2.6) gb.add(GEO.cyl, xf(x, y + s * 1.05, z, s * .78, s * .3, s * .78), def.pal.g1, { jit: .1 });
  }
  const lit = new THREE.Mesh(gb.build(), M.lit); group.add(lit);
  if (!glow.empty) group.add(new THREE.Mesh(glow.build(), M.unlit));
  if (!wb.empty) { const m = new THREE.Mesh(wb.build(), M.water); m.renderOrder = 2; group.add(m); }
  if (!lb.empty) { const m = new THREE.Mesh(lb.build(), M.lava); m.renderOrder = 2; group.add(m); }

  // Fertigkeits-Ring + Rune + Lichtsäule
  const rp = new V3(def.ring[0], def.ring[1] + topH(def.ring[0], def.ring[2]), def.ring[2]);
  const rb = new GB();
  rb.add(new THREE.TorusGeometry(8.2, 0.55, 6, 36), xf(0, 0, 0), 0xffffff, { light: true, jit: .12 });
  rb.add(new THREE.TorusGeometry(9.6, 0.14, 4, 36), xf(0, 0, 0), 0xffffff, { jit: .0 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; rb.add(GEO.octa, xf(Math.cos(a) * 8.2, Math.sin(a) * 8.2, 0, .9, .9, 1.3, 0, 0, a), 0xffffff, { light: true }); }
  const ring = new THREE.Mesh(rb.build(), new THREE.MeshBasicMaterial({ vertexColors: true, color: def.glowHex })); ring.position.copy(rp); group.add(ring);
  const ob = new GB(); ob.add(GEO.octa, xf(0, 0, 0, 1.7, 2.6, 1.7), 0xffffff, { light: true }); ob.add(GEO.octa, xf(0, 0, 0, 2.7, .5, 2.7, 0, .78, 0), 0xffffff, { light: true });
  const rune = new THREE.Mesh(ob.build(), new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff })); rune.position.copy(rp); group.add(rune);
  const bg = new THREE.CylinderGeometry(1.2, 3.4, 420, 10, 1, true); bg.translate(0, 210, 0);
  { const pa = bg.attributes.position, col = new Float32Array(pa.count * 3), cc = new THREE.Color(def.glowHex); for (let i = 0; i < pa.count; i++) { const k = pa.getY(i) > 10 ? 0 : 0.26; col.set([cc.r * k, cc.g * k, cc.b * k], i * 3); } bg.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.copy(rp); beam.renderOrder = 4; group.add(beam);
  const ringGlow = makeBatch([{ p: [rp.x, rp.y, rp.z], s: 34, c: def.glowHex, a: .55 }, { p: [rp.x, rp.y, rp.z], s: 11, c: 0xffffff, a: .8 }], { fogK: 0.3 });
  group.add(ringGlow);
  if (c.glows.length) group.add(makeBatch(c.glows.filter(g => g.s > 0)));
  const P = def.pos; for (const m of c.motes) shared.motes.push({ ...m, p: [m.p[0] + P[0], m.p[1] + P[1], m.p[2] + P[2]] });
  return { def, group, rad, topH, colliders: c.colliders, anims: c.anims, ringPos: rp, ring, rune, beam, ringGlow, phase: rng() * TAU, baseY: P[1], unlocked: false, cliff: def.cliff || 5 };
}

// ---------------------------------------------------------------- ferne Inseln (Silhouetten)
export function makeDistant() {
  const rng = mulberry(31337); const gb = new GB();
  const pals = [{ g1: 0x6fc070, g2: 0x4a9e60, dirt: 0x7d5538, r1: 0x8d7b90, r2: 0x6c5d78 }, { g1: 0x9a8ad0, g2: 0x6a5ab0, dirt: 0x5a4a80, r1: 0x7a6aa0, r2: 0x5a4a80 }, { g1: 0xe0a070, g2: 0xc07a58, dirt: 0x8a5a48, r1: 0x9a6a68, r2: 0x7a4a50 }];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + rng() * .3, r = 900 + rng() * 800, R = 50 + rng() * 110;
    const def = { R, D: R * (1.2 + rng()), seed: 200 + i * 7, hill: 5 + rng() * 8, pal: pals[i % 3], cliff: 8 };
    const off = new V3(Math.cos(a) * r, -20 + rng() * 300, Math.sin(a) * r);
    const { rad, topH } = terrain(gb, def, off, { ns: 22, nr: 4, nb: 6 });
    for (let k = 0; k < 14; k++) { const b = rng() * TAU, u = rng() * .85, rr = rad(b) * u, x = Math.cos(b) * rr, z = Math.sin(b) * rr, s = 5 + rng() * 9; gb.add(GEO.cone, xf(off.x + x, off.y + topH(x, z) + s * 1.2, off.z + z, s * .55, s * 2.6, s * .55), i % 3 === 1 ? 0x8a7ad0 : 0x3f9058, { jit: .12 }); }
    if (i % 4 === 0) gb.add(cylT(0.7, 6), xf(off.x, off.y + topH(0, 0) + R * .35, off.z, R * .12, R * .7, R * .12), 0xcfc4d0);
  }
  return new THREE.Mesh(gb.build(), mats().lit);
}
