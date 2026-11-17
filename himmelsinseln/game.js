// Himmelsinseln – Spiel-Logik: Flug, Kamera, Eingabe, HUD, Audio
import * as THREE from 'three';
import {
  V3, TAU, clamp, lerp, smooth, mulberry, C, xf, GB, GEO, U, SUN, SEA_Y, FOG_HEX, TEX, initTextures,
  makeBatch, makeSky, makeSea, makeCloudPuffs, makeBirds, makeAurora, makeDistant, ISLAND_DEFS, buildIsland,
} from './world.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'himmelsinseln.v1';
const store = {
  load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } },
  save(o) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { /* privat/voll – egal */ } },
};
const saved = store.load();
const state = { mode: 'menu', paused: false, unlocked: new Set(Array.isArray(saved.u) ? saved.u : []), muted: !!saved.mute, energy: 60, finale: 0, time: 0 };
const persist = () => store.save({ u: [...state.unlocked], mute: state.muted });

// ---------------------------------------------------------------- Renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
renderer.toneMapping = THREE.NoToneMapping;
const QUALITY = [2, 1.5, 1.25, 1]; let qIdx = 0;
const applyPR = () => renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[qIdx]));
applyPR();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_HEX, U.uFog.value.x, U.uFog.value.y);
const camera = new THREE.PerspectiveCamera(64, 1, 0.5, 6000);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xa9b6ff, 0xff9a7a, 1.75));
const sun = new THREE.DirectionalLight(0xffd6a0, 2.7); sun.position.copy(SUN).multiplyScalar(100); scene.add(sun);

initTextures();
const sky = makeSky(); sky.scale.setScalar(3000); scene.add(sky);
const sea = makeSea(); scene.add(sea);
const puffs = makeCloudPuffs(ISLAND_DEFS); scene.add(puffs);
scene.add(makeBirds());
scene.add(makeDistant());
const aurora = makeAurora(); scene.add(aurora);

const shared = { motes: [], mists: [] };
const islands = ISLAND_DEFS.map((d) => { const is = buildIsland(d, shared); scene.add(is.group); return is; });
scene.add(makeBatch(shared.motes, { fogK: 1 }));
{ // freie Glühwürmchen im Himmel
  const r = mulberry(5), it = [];
  for (let i = 0; i < 260; i++) { const a = r() * TAU, d = 40 + r() * 760; it.push({ p: [Math.cos(a) * d, -30 + r() * 230, Math.sin(a) * d], s: 1 + r() * 1.3, c: [0xfff0c0, 0xffd0e8, 0xc8e8ff][i % 3], a: .7, m: [6, .2 + r() * .3, r() * 30, 0] }); }
  scene.add(makeBatch(it, { fogK: 1 }));
}
const mistBatch = makeBatch(shared.mists, { tex: TEX.soft, additive: false, fogK: 0.5, order: 3 }); scene.add(mistBatch);

// ---------------------------------------------------------------- Sternenfunken (Schub-Energie)
const sparks = [];
{
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 0]; const pts = [];
  const P = (i) => { const is = islands[i]; return new V3(is.def.pos[0], is.def.pos[1] + is.ringPos.y, is.def.pos[2]); };
  for (let k = 0; k < order.length - 1; k++) { const a = P(order[k]), b = P(order[k + 1]); for (let j = 1; j <= 5; j++) { const t = 0.16 + j * 0.113; const p = a.clone().lerp(b, t); p.y += Math.sin(t * Math.PI) * 26 + Math.sin(k * 3 + j) * 6; pts.push(p); } }
  const a0 = new V3(0, 30, 0), b0 = P(0); for (let j = 1; j <= 3; j++) pts.push(a0.clone().lerp(b0, j * 0.22));
  for (const [i, j] of [[0, 2], [1, 4], [3, 6], [5, 0], [7, 2]]) { const a = P(i), b = P(j); for (const t of [0.35, 0.5, 0.65]) { const p = a.clone().lerp(b, t); p.y += 18; pts.push(p); } }
  const gb = new GB();
  gb.add(new THREE.TorusGeometry(3.4, 0.28, 5, 22), xf(0, 0, 0), 0xffe9a8, { light: true, jit: .1 });
  gb.add(GEO.octa, xf(0, 0, 0, 1.0, 1.5, 1.0), 0xffffff, { light: true });
  gb.add(GEO.octa, xf(0, 0, 0, 1.5, .35, .35), 0xfff4c8, { light: true });
  var sparkMesh = new THREE.InstancedMesh(gb.build(), new THREE.MeshBasicMaterial({ vertexColors: true }), pts.length);
  sparkMesh.frustumCulled = false; scene.add(sparkMesh);
  pts.forEach((p, i) => sparks.push({ p, t: 0, ph: i * 1.3 }));
  var sparkGlow = makeBatch(pts.map((p) => ({ p: [p.x, p.y, p.z], s: 13, c: 0xffd070, a: .6 })), { dynamic: true, fogK: 0.6 }); scene.add(sparkGlow);
}

// ---------------------------------------------------------------- Partikel-Pool (Explosionen, Feuerwerk)
const BN = 420; const burst = { pos: new Float32Array(BN * 3), vel: new Float32Array(BN * 3), life: new Float32Array(BN), max: new Float32Array(BN), size: new Float32Array(BN), next: 0, alive: 0 };
const burstMesh = makeBatch(Array.from({ length: BN }, () => ({ p: [0, -9999, 0], s: 0, c: 0xffffff, a: 1 })), { dynamic: true, fogK: 0.2, order: 8 }); scene.add(burstMesh);
function spawnBurst(p, hex, n, speed, sizeK = 1) {
  const col = new THREE.Color(hex), ca = burstMesh.geometry.attributes.iCol.array;
  for (let i = 0; i < n; i++) {
    const k = burst.next; burst.next = (k + 1) % BN;
    const th = Math.random() * TAU, ph = Math.acos(Math.random() * 2 - 1), sp = speed * (0.35 + Math.random() * 0.75);
    burst.pos.set([p.x, p.y, p.z], k * 3); burst.vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], k * 3);
    burst.life[k] = burst.max[k] = 1.1 + Math.random() * 1.3; burst.size[k] = (1.6 + Math.random() * 2.2) * sizeK;
    const w = Math.random() < 0.25 ? 1 : 0; ca.set([lerp(col.r, 1, w), lerp(col.g, 1, w), lerp(col.b, 1, w), 1], k * 4);
  }
  burstMesh.geometry.attributes.iCol.needsUpdate = true; burst.alive = 3;
}
function updateBursts(dt) {
  if (burst.alive <= 0) return; burst.alive -= dt;
  const P = burstMesh.geometry.attributes.iPos, S = burstMesh.geometry.attributes.iSize, drag = Math.exp(-dt * 1.6);
  for (let k = 0; k < BN; k++) {
    if (burst.life[k] <= 0) { S.array[k] = 0; continue; }
    burst.life[k] -= dt; const j = k * 3;
    burst.vel[j] *= drag; burst.vel[j + 1] = burst.vel[j + 1] * drag - 9 * dt; burst.vel[j + 2] *= drag;
    burst.pos[j] += burst.vel[j] * dt; burst.pos[j + 1] += burst.vel[j + 1] * dt; burst.pos[j + 2] += burst.vel[j + 2] * dt;
    P.array[j] = burst.pos[j]; P.array[j + 1] = burst.pos[j + 1]; P.array[j + 2] = burst.pos[j + 2];
    S.array[k] = burst.size[k] * Math.max(0, burst.life[k] / burst.max[k]);
  }
  P.needsUpdate = S.needsUpdate = true;
}

// ---------------------------------------------------------------- Spielfigur: Himmelsdrache
const player = { pos: new V3(0, 30, 0), yaw: 0, pitch: 0, roll: 0, yawVel: 0, speed: 40, boostK: 0, push: new V3(), bounce: 0, fwd: new V3(0, 0, -1), group: new THREE.Group() };
const wings = [];
{
  const gb = new GB(); const cream = 0xfff4e0, teal = 0x2fd0c4, deep = 0x1a9aa6, gold = 0xffc94a;
  gb.add(GEO.ico1, xf(0, 0, 0, .78, .66, 2.2), cream, { jit: .04, fn: (p, c) => { if (p.y > 0.12) c.set(p.y > .5 ? deep : teal); } });
  gb.add(GEO.cone, xf(0, .32, -2.25, .46, 1.9, .46, -Math.PI / 2 + .3, 0, 0), cream, { fn: (p, c) => { if (p.z < -0.2) c.set(teal); } });
  gb.add(GEO.octa, xf(0, .72, -3.25, .44, .42, .8), teal, { jit: .05 });
  gb.add(GEO.cone, xf(0, .64, -4.15, .2, .8, .2, -Math.PI / 2, 0, 0), gold);
  for (const s of [-1, 1]) { gb.add(GEO.cone, xf(s * .3, 1.12, -2.85, .1, .95, .1, .95, 0, -s * .25), gold); gb.add(GEO.octa, xf(s * .34, .82, -3.5, .09), 0x1b1740, { jit: 0 }); }
  gb.add(GEO.cone, xf(0, 0, 3.4, .42, 3.6, .32, Math.PI / 2, 0, 0), cream, { fn: (p, c) => { if (p.z < 0) c.set(teal); } });
  gb.add(GEO.octa, xf(0, 0, 5.5, 1.0, .07, 1.1), gold, { jit: .05 });
  for (let i = 0; i < 4; i++) gb.add(GEO.cone, xf(0, .72 - i * .04, -.9 + i * .85, .1, .7 - i * .08, .34, -.5, 0, 0), gold);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x30303a });
  player.group.add(new THREE.Mesh(gb.build(), mat));
  for (const s of [-1, 1]) {
    const inner = new THREE.Group(); inner.position.set(s * .5, .25, -.5);
    const v = (x, z, y = 0) => new V3(x * s, y, z);
    const ib = new GB();
    ib.tri(v(0, -1.0), v(0, 1.2), v(2.9, -1.1), C(teal)); ib.tri(v(0, 1.2), v(2.7, 1.5), v(2.9, -1.1), C(0x35cfc0));
    ib.tri(v(0, 1.2), v(1.3, 2.3), v(2.7, 1.5), C(cream));
    inner.add(new THREE.Mesh(ib.build(), mat));
    const outer = new THREE.Group(); outer.position.set(s * 2.8, 0, 0);
    const ob = new GB();
    ob.tri(v(0, -1.1), v(-.1, 1.5), v(3.9, .4), C(0x35cfc0)); ob.tri(v(-.1, 1.5), v(1.6, 2.4), v(3.9, .4), C(0xffe08a));
    ob.tri(v(1.4, 1.6), v(3.0, 2.2), v(3.9, .4), C(gold)); ob.tri(v(0, -1.1), v(3.9, .4), v(2.2, -1.0), C(deep));
    outer.add(new THREE.Mesh(ob.build(), mat));
    const tip = new THREE.Object3D(); tip.position.set(s * 3.8, 0, .5); outer.add(tip);
    inner.add(outer); player.group.add(inner); wings.push({ s, inner, outer, tip });
  }
  player.group.rotation.order = 'YXZ'; player.group.scale.setScalar(1.25); scene.add(player.group);
}
// Flügelspitzen-Bänder
const TR = 30; const trails = wings.map(() => {
  const g = new THREE.BufferGeometry(); const pos = new Float32Array(TR * 2 * 3), col = new Float32Array(TR * 2 * 3); const idx = [];
  for (let i = 0; i < TR - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.frustumCulled = false; m.renderOrder = 6; scene.add(m);
  return { g, pts: Array.from({ length: TR }, () => ({ p: new V3(), r: new V3(1, 0, 0) })), init: false };
});
// Windstreifen (bei Schub)
const SL = 80; const slGeo = new THREE.BufferGeometry(); const slPos = new Float32Array(SL * 6); const slData = [];
{ const r = mulberry(8); for (let i = 0; i < SL; i++) { const a = r() * TAU, d = 8 + r() * 14; slData.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * .7, z: -r() * 70, l: 1.5 + r() * 3 }); } }
slGeo.setAttribute('position', new THREE.BufferAttribute(slPos, 3).setUsage(THREE.DynamicDrawUsage));
const slMat = new THREE.LineBasicMaterial({ color: 0xfff2d8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const speedLines = new THREE.LineSegments(slGeo, slMat); speedLines.frustumCulled = false; speedLines.renderOrder = 7; camera.add(speedLines);

// ---------------------------------------------------------------- Audio (WebAudio, synthetisch)
const audio = {
  ctx: null, master: null, windGain: null, windFilter: null, voices: [], chord: 0, nextChord: 0,
  chords: [[146.83, 220, 329.63, 369.99], [123.47, 185, 293.66, 440], [98, 146.83, 246.94, 369.99], [110, 164.81, 277.18, 329.63]],
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC(); const master = this.master = ctx.createGain(); master.gain.value = state.muted ? 0 : 0.8; master.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0); let b = 0;
      for (let i = 0; i < d.length; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.windFilter = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
      const g = this.windGain = ctx.createGain(); g.gain.value = 0.0; src.connect(f); f.connect(g); g.connect(master); src.start();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; const pad = ctx.createGain(); pad.gain.value = 0; lp.connect(pad); pad.connect(master);
      pad.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 4);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 350; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      this.chords[0].forEach((fr, i) => { for (const [type, det, vol] of [['sine', -5, .5], ['triangle', 6, .22]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = fr; o.detune.value = det + i * 2; og.gain.value = vol * (i === 0 ? 1 : .7); o.connect(og); og.connect(lp); o.start(); this.voices.push({ o, i }); } });
      this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.28; const fb = ctx.createGain(); fb.gain.value = 0.35; this.delay.connect(fb); fb.connect(this.delay); const dg = ctx.createGain(); dg.gain.value = 0.4; this.delay.connect(dg); dg.connect(master);
      this.nextChord = ctx.currentTime + 9;
    } catch (e) { this.ctx = null; }
  },
  tick(speedK, boostK) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    this.windGain.gain.setTargetAtTime(0.05 + speedK * 0.07 + boostK * 0.12, t, 0.3); this.windFilter.frequency.setTargetAtTime(380 + speedK * 250 + boostK * 600, t, 0.3);
    if (t > this.nextChord) { this.nextChord = t + 9; this.chord = (this.chord + 1) % this.chords.length; const ch = this.chords[this.chord]; for (const v of this.voices) v.o.frequency.setTargetAtTime(ch[v.i], t, 1.2); }
  },
  note(freq, at, dur, vol = 0.2, type = 'sine') {
    const c = this.ctx; if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = freq;
    const t = c.currentTime + at; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); if (this.delay) g.connect(this.delay); o.start(t); o.stop(t + dur + 0.05);
  },
  sfx(kind) {
    if (!this.ctx) return;
    if (kind === 'spark') [880, 1174.7, 1568].forEach((f, i) => this.note(f, i * 0.055, 0.35, 0.11));
    else if (kind === 'unlock') [587.33, 739.99, 880, 1174.66, 1479.98, 1760].forEach((f, i) => { this.note(f, i * 0.11, 1.6, 0.16, 'triangle'); this.note(f / 2, i * 0.11, 1.2, 0.07); });
    else if (kind === 'bounce') { this.note(180, 0, 0.3, 0.18); this.note(120, 0.02, 0.4, 0.14); }
    else if (kind === 'finale') [293.66, 369.99, 440, 587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, i) => this.note(f, i * 0.16, 2.6, 0.15, 'triangle'));
  },
  setMuted(m) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); },
};

// ---------------------------------------------------------------- Eingabe
const input = { x: 0, y: 0, boost: false, brake: false, keys: new Set(), sx: 0, sy: 0, stickId: null };
const stick = $('stick'), knob = $('knob'), zone = $('stickzone');
const STICK_R = 52; let stickHome = null, stickOrigin = { x: 0, y: 0 };
function setKnob(dx, dy) { knob.style.transform = `translate(${dx}px,${dy}px)`; }
zone.addEventListener('pointerdown', (e) => {
  if (input.stickId !== null) return; input.stickId = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch (_) { }
  stickOrigin = { x: e.clientX, y: e.clientY }; const r = stick.getBoundingClientRect();
  if (!stickHome) stickHome = { left: stick.style.left, bottom: stick.style.bottom };
  stick.style.left = (e.clientX - r.width / 2) + 'px'; stick.style.bottom = (window.innerHeight - e.clientY - r.height / 2) + 'px'; stick.classList.add('act'); e.preventDefault();
});
zone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== input.stickId) return; let dx = e.clientX - stickOrigin.x, dy = e.clientY - stickOrigin.y; const d = Math.hypot(dx, dy);
  if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; } setKnob(dx, dy); input.sx = dx / STICK_R; input.sy = -dy / STICK_R; e.preventDefault();
});
const stickEnd = (e) => { if (e.pointerId !== input.stickId) return; input.stickId = null; input.sx = input.sy = 0; setKnob(0, 0); stick.classList.remove('act'); stick.style.left = ''; stick.style.bottom = ''; };
zone.addEventListener('pointerup', stickEnd); zone.addEventListener('pointercancel', stickEnd); zone.addEventListener('lostpointercapture', stickEnd);
function holdBtn(el, key) {
  const on = (e) => { input[key] = true; el.classList.add('dn'); try { el.setPointerCapture(e.pointerId); } catch (_) { } e.preventDefault(); };
  const off = () => { input[key] = false; el.classList.remove('dn'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
}
holdBtn($('boost'), 'boost'); holdBtn($('brake'), 'brake');
window.addEventListener('keydown', (e) => {
  if (e.repeat) return; input.keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') toggleMute();
  if ((e.code === 'Enter' || e.code === 'Space') && state.mode === 'menu' && ready) start();
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
window.addEventListener('blur', () => { input.keys.clear(); input.boost = input.brake = false; });
for (const ev of ['touchmove', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => { if (!e.target.closest || !e.target.closest('.card')) e.preventDefault(); }, { passive: false });
function readInput() {
  const k = input.keys; let x = input.sx, y = input.sy;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1; if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
  input.x = clamp(x, -1, 1); input.y = clamp(y, -1, 1);
  input.kb = k.has('ShiftLeft') || k.has('ShiftRight'); input.kbr = k.has('Space');
}

// ---------------------------------------------------------------- HUD / UI
const hud = $('hud'), toastEl = $('toast'); let toastT = 0;
function toast(msg, sec = 4) { toastEl.textContent = msg; toastEl.classList.add('on'); toastT = sec; }
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
$('dots').innerHTML = ISLAND_DEFS.map((d) => `<i style="--c:${hex(d.glowHex)}"></i>`).join('');
function refreshHud() {
  $('num').textContent = `${state.unlocked.size}/${ISLAND_DEFS.length}`;
  [...$('dots').children].forEach((el, i) => el.classList.toggle('on', state.unlocked.has(ISLAND_DEFS[i].id)));
}
function toggleMute() { state.muted = !state.muted; $('mute').textContent = state.muted ? '🔇' : '🔊'; audio.setMuted(state.muted); persist(); }
$('mute').textContent = state.muted ? '🔇' : '🔊';
$('mute').addEventListener('click', () => { audio.init(); toggleMute(); });
const card = $('card'); let cardT = 0;
function showCard(d) {
  $('cic').textContent = d.icon; $('cname').textContent = d.skill; $('cisl').textContent = d.name; $('cdesc').textContent = d.desc;
  card.style.setProperty('--c', hex(d.glowHex)); card.classList.add('on'); cardT = 6.5; toastT = 0; toastEl.classList.remove('on');
}
card.addEventListener('pointerdown', () => { cardT = 0; card.classList.remove('on'); });
const panel = $('panel'), fin = $('fin');
function openOv(el) { el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.remove('out')); state.paused = true; }
function closeOv(el) { el.classList.add('out'); setTimeout(() => el.classList.add('hidden'), 500); state.paused = false; }
$('count').addEventListener('click', () => {
  $('psub').textContent = `${state.unlocked.size} von ${ISLAND_DEFS.length} entdeckt`;
  $('grid').innerHTML = ISLAND_DEFS.map((d) => state.unlocked.has(d.id) ? `<div class="on" style="--c:${hex(d.glowHex)}"><i>${d.icon}</i><b>${d.skill}</b>${d.name}</div>` : `<div><i>❔</i><b>???</b>${d.name}</div>`).join('');
  openOv(panel);
});
$('pclose').addEventListener('click', () => closeOv(panel));
$('preset').addEventListener('click', () => { closeOv(panel); resetGame(); });
$('fgo').addEventListener('click', () => closeOv(fin));
$('freset').addEventListener('click', () => { closeOv(fin); resetGame(); });
$('sreset').addEventListener('click', () => { resetGame(true); $('sreset').classList.add('hidden'); $('go').textContent = 'Abheben'; });

// ---------------------------------------------------------------- Fertigkeiten
const GOLD = 0xffe2a0;
function markUnlocked(is, on) {
  is.unlocked = on; is.beam.visible = !on; is.ring.material.color.setHex(on ? GOLD : is.def.glowHex);
  is.ring.scale.setScalar(on ? 0.72 : 1); is.rune.visible = !on;
  const a = is.ringGlow.geometry.attributes.iSize; a.array[0] = on ? 16 : 34; a.array[1] = on ? 0 : 11; a.needsUpdate = true;
}
const _w = new V3();
function ringWorld(is, out = _w) { return out.copy(is.ringPos).add(is.group.position); }
function unlock(is) {
  if (is.unlocked) return; state.unlocked.add(is.def.id); persist(); markUnlocked(is, true);
  const p = ringWorld(is).clone(); spawnBurst(p, is.def.glowHex, 150, 50, 0.55); spawnBurst(p, 0xffffff, 40, 26, 0.4);
  audio.sfx('unlock'); showCard(is.def); refreshHud(); state.energy = 100;
  try { navigator.vibrate && navigator.vibrate([30, 40, 60]); } catch (e) { }
  if (state.unlocked.size === ISLAND_DEFS.length) state.finale = 0.001;
}
function resetGame(silent) {
  state.unlocked.clear(); persist(); islands.forEach((is) => markUnlocked(is, false)); refreshHud();
  state.finale = 0; fwT = 0; aurora.userData.uA.value = 0; U.uNight.value = 0; aurora.visible = false; state.energy = 60;
  player.pos.set(0, 30, 0); player.yaw = 0; player.pitch = 0; player.yawVel = 0; player.push.set(0, 0, 0); trails.forEach((t) => t.init = false);
  if (!silent) toast('Neues Abenteuer – alle Inseln warten wieder auf dich.');
}
islands.forEach((is) => markUnlocked(is, state.unlocked.has(is.def.id)));
refreshHud();
if (state.unlocked.size === ISLAND_DEFS.length) { aurora.visible = true; aurora.userData.uA.value = 1; U.uNight.value = 1; }

// ---------------------------------------------------------------- Flugphysik
const WORLD_R = 820, CEIL = 330, FLOOR = SEA_Y + 52;
let boundT = 0;
function updatePlayer(dt) {
  readInput(); const p = player;
  const wantBoost = (input.boost || input.kb) && state.energy > 1, brake = input.brake || input.kbr;
  state.energy = clamp(state.energy + (wantBoost ? -20 : 4 + state.unlocked.size * 0.6) * dt, 0, 100);
  p.boostK = lerp(p.boostK, wantBoost ? 1 : 0, 1 - Math.exp(-dt * 4));
  const targetSpeed = brake ? 15 : 40 + p.boostK * 44;
  p.speed = lerp(p.speed, targetSpeed, 1 - Math.exp(-dt * (brake ? 2.2 : 1.8)));
  let ix = input.x, iy = input.y;
  // sanfte Weltgrenzen
  const dc = Math.hypot(p.pos.x, p.pos.z);
  if (dc > WORLD_R) {
    const toC = Math.atan2(p.pos.x, p.pos.z); let diff = toC - p.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const k = smooth(WORLD_R, WORLD_R + 160, dc); ix = lerp(ix, clamp(-diff * 1.5, -1, 1), k);
    if (boundT <= 0) { toast('Ein warmer Wind trägt dich zurück zu den Inseln …', 3.5); boundT = 8; }
  }
  boundT -= dt;
  if (p.pos.y > CEIL) iy = Math.min(iy, -smooth(CEIL, CEIL + 50, p.pos.y));
  if (p.pos.y < FLOOR + 14) iy = Math.max(iy, smooth(FLOOR + 14, FLOOR, p.pos.y) * 0.8);
  const turn = brake ? 1.9 : 1.45;
  p.yawVel = lerp(p.yawVel, -ix * turn, 1 - Math.exp(-dt * 4.5)); p.yaw += p.yawVel * dt;
  p.pitch = lerp(p.pitch, iy * 0.8, 1 - Math.exp(-dt * 3.2));
  p.roll = lerp(p.roll, clamp(p.yawVel * 0.55, -0.95, 0.95), 1 - Math.exp(-dt * 6));
  const cp = Math.cos(p.pitch); p.fwd.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp);
  p.pos.addScaledVector(p.fwd, p.speed * dt); p.pos.addScaledVector(p.push, dt); p.push.multiplyScalar(Math.exp(-dt * 3));
  // Wolkenmeer federt ab
  if (p.pos.y < FLOOR) { p.pos.y = FLOOR; if (p.push.y < 10) { p.push.y = 34; p.pitch = Math.max(p.pitch, 0.35); spawnBurst(p.pos, 0xffe6dc, 26, 16, 1.2); audio.sfx('bounce'); } }
  collide(dt);
  p.group.position.copy(p.pos); p.group.rotation.set(p.pitch, p.yaw, p.roll);
  // Flügelschlag
  const flapF = 2.2 + p.boostK * 3.2 + Math.max(0, p.pitch) * 3 + (brake ? 2.5 : 0); p.flap = (p.flap || 0) + flapF * dt * 2;
  const amp = 0.2 + p.boostK * 0.12 + Math.max(0, p.pitch) * 0.3 + (brake ? 0.25 : 0);
  for (const w of wings) { w.inner.rotation.z = w.s * (0.1 + Math.sin(p.flap) * amp); w.outer.rotation.z = w.s * (Math.sin(p.flap - 0.9) * amp * 1.25 - 0.05); }
}
function collide(dt) {
  const p = player.pos, k = Math.min(1, dt * 14);
  for (const is of islands) {
    const g = is.group.position, dx = p.x - g.x, dz = p.z - g.z, dy = p.y - g.y, d = Math.hypot(dx, dz) || 1e-3;
    if (d > is.def.R * 1.25 + 6) continue;
    const ra = is.rad(Math.atan2(dz, dx)), u = d / ra;
    if (u < 1.05) {
      const top = is.topH(dx, dz) + 2.4, bottom = -(is.cliff + is.def.D * Math.pow(Math.max(0, 1 - u), 1.45) * 0.8) - 2.5;
      if (dy < top && dy > bottom) {
        const upPen = top - dy, downPen = dy - bottom, sidePen = (1.05 - u) * ra;
        if (upPen <= 10 || upPen < Math.min(downPen, sidePen)) { p.y += upPen * k; player.pitch = Math.max(player.pitch, 0.12); }
        else if (sidePen < downPen) { p.x += dx / d * sidePen * k; p.z += dz / d * sidePen * k; player.push.x += dx / d * 40 * dt; player.push.z += dz / d * 40 * dt; }
        else { p.y -= downPen * k; player.pitch = Math.min(player.pitch, -0.1); }
      }
    }
    for (const c of is.colliders) {
      const cx = dx - c.x, cz = dz - c.z, cd = Math.hypot(cx, cz) || 1e-3, r = c.r + 2;
      if (cd < r && dy < c.top + 2) {
        if (c.top + 2 - dy < 4) p.y += (c.top + 2 - dy) * k;
        else { const pen = r - cd; p.x += cx / cd * pen * k; p.z += cz / cd * pen * k; player.push.x += cx / cd * 30 * dt; player.push.z += cz / cd * 30 * dt; }
      }
    }
  }
}

// ---------------------------------------------------------------- Kamera
const camPos = new V3(0, 60, 120), camLook = new V3(), _t = new V3(), _t2 = new V3(), _t3 = new V3(); let camK = 0.6, portrait = false;
function updateCamera(dt) {
  const p = player;
  if (state.mode === 'menu') {
    const is = islands[0], a = state.time * 0.06 + 2.25, R = portrait ? 200 : 128;
    _t.set(is.group.position.x + Math.cos(a) * R, is.group.position.y + 30, is.group.position.z + Math.sin(a) * R);
    camPos.copy(_t); camLook.set(is.group.position.x, is.group.position.y + (portrait ? -6 : 4), is.group.position.z);
    camera.position.copy(camPos); camera.lookAt(camLook); return;
  }
  camK = Math.min(5.5, camK + dt * 1.6);
  const back = (portrait ? 20 : 14) * (1 + p.boostK * 0.12), cp = Math.cos(p.pitch * 0.7);
  _t.set(p.pos.x + Math.sin(p.yaw) * cp * back, p.pos.y + 4.8 - Math.sin(p.pitch * 0.7) * back, p.pos.z + Math.cos(p.yaw) * cp * back);
  if (_t.y < SEA_Y + 56) _t.y = SEA_Y + 56;
  camPos.lerp(_t, 1 - Math.exp(-dt * camK));
  _t2.copy(p.pos).addScaledVector(p.fwd, 14); _t2.y += 2.2; camLook.lerp(_t2, 1 - Math.exp(-dt * (camK + 3)));
  camera.position.copy(camPos); camera.lookAt(camLook); camera.rotateZ(p.roll * 0.22);
  const fov = (portrait ? 82 : 64) + p.boostK * 13; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
function updateTrails(dt) {
  player.group.updateMatrixWorld(true);
  const right = _t.set(1, 0, 0).applyQuaternion(player.group.quaternion); const bk = player.boostK;
  wings.forEach((w, wi) => {
    const tr = trails[wi]; w.tip.getWorldPosition(_t2);
    if (!tr.init) { tr.pts.forEach((q) => { q.p.copy(_t2); q.r.copy(right); }); tr.init = true; }
    const head = tr.pts[0].p, dist = head.distanceTo(_t2), n = Math.min(TR, Math.floor(dist / 0.4));
    if (n > 0) { _t3.copy(head); for (let k = 1; k <= n; k++) { const last = tr.pts.pop(); last.p.copy(_t3).lerp(_t2, k / n); last.r.copy(right); tr.pts.unshift(last); } }
    const pos = tr.g.attributes.position.array, col = tr.g.attributes.color.array;
    for (let i = 0; i < TR; i++) {
      const q = tr.pts[i], f = 1 - i / (TR - 1), wd = (0.03 + 0.2 * f) * (0.8 + bk * 0.9), j = i * 6;
      pos[j] = q.p.x - q.r.x * wd; pos[j + 1] = q.p.y - q.r.y * wd; pos[j + 2] = q.p.z - q.r.z * wd; pos[j + 3] = q.p.x + q.r.x * wd; pos[j + 4] = q.p.y + q.r.y * wd; pos[j + 5] = q.p.z + q.r.z * wd;
      const b = f * f * (0.28 + bk * 0.5); const r = b * 1.0, g = b * lerp(0.85, 0.95, bk), bl = b * lerp(0.55, 0.9, bk);
      col[j] = col[j + 3] = r; col[j + 1] = col[j + 4] = g; col[j + 2] = col[j + 5] = bl;
    }
    tr.g.attributes.position.needsUpdate = tr.g.attributes.color.needsUpdate = true;
  });
  slMat.opacity = bk * 0.34; speedLines.visible = bk > 0.02;
  if (speedLines.visible) {
    const v = player.speed * 1.6 * dt;
    for (let i = 0; i < SL; i++) { const s = slData[i]; s.z += v; if (s.z > 2) s.z = -70; const j = i * 6; slPos[j] = slPos[j + 3] = s.x; slPos[j + 1] = slPos[j + 4] = s.y; slPos[j + 2] = s.z; slPos[j + 5] = s.z - s.l * (0.5 + bk); }
    slGeo.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Welt-Update
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(); let hudTick = 0, fwT = 0;
function updateWorld(dt, t) {
  for (const is of islands) {
    is.group.position.y = is.baseY + Math.sin(t * 0.35 + is.phase) * 1.6;
    { const d = is.group.position.distanceTo(player.pos); is.beam.material.opacity = 0.18 + 0.82 * smooth(70, 320, d); }
    is.ring.rotation.y = t * (is.unlocked ? 0.25 : 0.6) + is.phase; is.rune.rotation.y = -t * 1.4; is.rune.position.y = is.ringPos.y + Math.sin(t * 1.7 + is.phase) * 0.7;
    for (const f of is.anims) f(t, dt);
  }
  puffs.rotation.y = t * 0.0035;
  const sga = sparkGlow.geometry.attributes.iSize; let sgDirty = false;
  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i];
    if (s.t > 0) { s.t -= dt; if (s.t <= 0) { sga.array[i] = 13; sgDirty = true; } }
    const sc = s.t > 0 ? 0.0001 : 1 + Math.sin(t * 3 + s.ph) * 0.08;
    _m.compose(s.p, _q.setFromEuler(_e.set(0, t * 1.2 + s.ph, 0)), _s.set(sc, sc, sc)); sparkMesh.setMatrixAt(i, _m);
    if (s.t <= 0 && state.mode === 'fly' && !state.paused && s.p.distanceToSquared(player.pos) < 49) {
      s.t = 28; sga.array[i] = 0; sgDirty = true; state.energy = Math.min(100, state.energy + 34); spawnBurst(s.p, 0xffd070, 22, 20, 0.45); audio.sfx('spark');
    }
  }
  sparkMesh.instanceMatrix.needsUpdate = true; if (sgDirty) sga.needsUpdate = true;
  if (state.mode === 'fly' && !state.paused) for (const is of islands) if (!is.unlocked && ringWorld(is).distanceToSquared(player.pos) < 121) unlock(is);
  // Finale
  if (state.finale > 0) {
    state.finale += dt; aurora.visible = true; aurora.userData.uA.value = Math.min(1, aurora.userData.uA.value + dt * 0.4); U.uNight.value = aurora.userData.uA.value;
    if (state.finale < 16) {
      fwT -= dt; if (fwT <= 0) { fwT = 0.32 + Math.random() * 0.3; _t.copy(player.pos).addScaledVector(player.fwd, 70 + Math.random() * 50); _t.x += (Math.random() - .5) * 120; _t.z += (Math.random() - .5) * 120; _t.y += 5 + Math.random() * 50; spawnBurst(_t, [0xff7ab8, 0x7fe8ff, 0xffe08a, 0x9dff8a, 0xd58bff][Math.random() * 5 | 0], 46, 38, 2.6); if (Math.random() < .5) audio.note(400 + Math.random() * 800, 0, 0.5, 0.05); }
    }
    if (state.finale > 3 && !state.finShown) { state.finShown = true; audio.sfx('finale'); card.classList.remove('on'); cardT = 0; openOv(fin); }
  } else state.finShown = false;
  if (aurora.visible) { aurora.position.x = camera.position.x; aurora.position.z = camera.position.z; }
  // Himmel & Meer folgen der Kamera
  sky.position.copy(camera.position);
  const cell = sea.userData.cell; sea.position.x = Math.round(camera.position.x / cell) * cell; sea.position.z = Math.round(camera.position.z / cell) * cell;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
  if (cardT > 0) { cardT -= dt; if (cardT <= 0) card.classList.remove('on'); }
  if (state.mode === 'fly' && (hudTick++ % 4) === 0) updateHud();
}
function updateHud() {
  $('boost').style.setProperty('--e', state.energy.toFixed(0));
  let best = null, bd = 1e9; for (const is of islands) { if (is.unlocked) continue; const d = ringWorld(is).distanceTo(player.pos); if (d < bd) { bd = d; best = is; } }
  const comp = $('compass');
  if (!best) { $('tname').textContent = 'Alle entdeckt'; $('tdist').textContent = 'Freier Flug'; $('arrow').firstElementChild.style.transform = 'rotate(0deg)'; return; }
  ringWorld(best); const dx = _w.x - player.pos.x, dz = _w.z - player.pos.z, dy = _w.y - player.pos.y;
  let rel = Math.atan2(dx, -dz) + player.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  $('arrow').firstElementChild.style.transform = `rotate(${(rel * 180 / Math.PI).toFixed(0)}deg)`;
  if (comp._n !== best.def.name) { comp._n = best.def.name; $('tname').textContent = best.def.name; }
  $('tdist').textContent = `${Math.round(bd)} m${dy > 25 ? ' · ▲ höher' : dy < -25 ? ' · ▼ tiefer' : ''}`;
}

// ---------------------------------------------------------------- Schleife, Qualität, Resize
let raf = 0, last = 0, ready = false, fAcc = 0, fN = 0, fGrace = 4;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const raw = (now - last) / 1000; last = now; const dt = Math.min(raw, 0.05);
  if (raw < 0.5) { fAcc += raw; fN++; if (fAcc > 2.5) { const fps = fN / fAcc; fAcc = fN = 0; if (fGrace > 0) fGrace -= 2.5; else if (fps < 42 && qIdx < QUALITY.length - 1 && (window.devicePixelRatio || 1) > QUALITY[qIdx + 1] - 0.01) { qIdx++; applyPR(); fGrace = 2.5; } } }
  state.time += dt; U.uTime.value = state.time;
  if (state.mode === 'fly' && !state.paused) updatePlayer(dt);
  else { player.group.position.copy(player.pos); player.group.rotation.set(player.pitch, player.yaw, player.roll); }
  updateWorld(dt, state.time); updateCamera(dt); updateTrails(dt); updateBursts(dt);
  if (state.mode === 'fly') audio.tick(player.speed / 84, player.boostK);
  renderer.render(scene, camera);
}
function startLoop() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(frame); }
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopLoop(); if (audio.ctx) audio.ctx.suspend(); }
  else { startLoop(); if (audio.ctx && state.mode === 'fly') audio.ctx.resume(); }
});
function resize() {
  const w = window.innerWidth, h = window.innerHeight; portrait = h > w;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = portrait ? 82 : 64; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- Start
function start() {
  if (state.mode !== 'menu') return; audio.init(); state.mode = 'fly'; camK = 0.5; fGrace = 4;
  $('start').classList.add('out'); setTimeout(() => $('start').classList.add('hidden'), 800); hud.classList.add('on');
  const touch = matchMedia('(pointer:coarse)').matches;
  setTimeout(() => toast(touch ? 'Links steuern · Fliege durch die leuchtenden Ringe' : 'WASD / Pfeiltasten steuern · Umschalt = Schub · Leertaste = Schweben', 6), 900);
  try { const el = document.documentElement; if (touch && el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => { }); } catch (e) { }
}
$('go').addEventListener('click', start);
player.group.position.copy(player.pos);
renderer.compile(scene, camera);
startLoop();
ready = true; $('load').classList.add('hidden'); $('go').classList.remove('hidden');
if (state.unlocked.size > 0) { $('go').textContent = 'Weiterfliegen'; $('sreset').classList.remove('hidden'); }

// Debug-/Test-Zugriff
window.__himmel = {
  state, player, islands, sparks, renderer, unlock, resetGame,
  ringPos: (i) => ringWorld(islands[i]).clone(),
  flyTo(i, dist = 60) { const r = ringWorld(islands[i]).clone(); player.pos.set(r.x, r.y, r.z + dist); player.yaw = 0; player.pitch = 0; player.yawVel = 0; player.push.set(0, 0, 0); trails.forEach((t) => t.init = false); camPos.set(r.x, r.y + 5, r.z + dist + 16); camLook.copy(r); },
  look(x, y, z, yaw = 0) { player.pos.set(x, y, z); player.yaw = yaw; player.pitch = 0; trails.forEach((t) => t.init = false); camK = 50; },
};
