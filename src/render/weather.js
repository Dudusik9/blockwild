// Погода: дождь, снег в холодных биомах, гроза с молнией
import * as THREE from 'three';
import { BIOMES } from '../world/biomes.js';

const RV = /* glsl */`
attribute vec3 aSeed; attribute float aEnd;
uniform vec3 uCam; uniform float uTime; uniform float uInt; uniform sampler2D uHeights; uniform vec2 uOrigin; uniform float uSnow;
varying float vA;
void main() {
  float R = 16.0; float S = 32.0;
  vec2 off = mod(aSeed.xy * S - uCam.xz + R, S) - R;
  vec2 xz = uCam.xz + off;
  float speed = uSnow > 0.5 ? 2.2 : 24.0;
  float fall = mod(aSeed.z * 40.0 - uTime * speed, 40.0);
  float y = uCam.y - 24.0 + fall;
  if (uSnow > 0.5) { xz.x += sin(uTime * 0.9 + aSeed.z * 30.0) * 0.5; xz.y += cos(uTime * 0.7 + aSeed.z * 20.0) * 0.5; }
  vec2 uv = (floor(xz) - uOrigin + 0.5) / S;
  float roof = texture2D(uHeights, uv).r * 255.0;
  float hide = (fract(aSeed.z * 17.31) > uInt || y < roof + 1.0 || abs(off.x) > R - 1.0 && false) ? 1.0 : 0.0;
  float len = uSnow > 0.5 ? 0.0 : 0.9;
  vec3 p = vec3(xz.x, y + aEnd * len, xz.y);
  p.x += aEnd * (uSnow > 0.5 ? 0.0 : 0.06);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 4.0 * (1.0 / max(0.5, -mv.z)) * 90.0 / 8.0;
  vA = (1.0 - hide) * (uSnow > 0.5 ? 0.9 : 0.5 * (0.35 + 0.65 * aEnd));
  if (hide > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const RF = /* glsl */`
precision highp float; uniform vec3 uColor; uniform float uSnow; varying float vA;
void main() {
  float a = vA;
  if (uSnow > 0.5) { vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.2) discard; }
  gl_FragColor = vec4(uColor, a);
}`;

export class Weather {
  constructor(game) {
    this.g = game;
    this.state = 'clear'; this.timer = 300 + Math.random() * 600;
    this.rainTarget = 0; this.thunderTarget = 0;
    this.nextStrike = 10; this.bolts = [];
    const N = 3000;
    const mk = (points) => {
      const g = new THREE.BufferGeometry();
      const seeds = [], ends = [];
      for (let i = 0; i < N; i++) {
        const sx = Math.random(), sz = Math.random(), sp = Math.random();
        if (points) { seeds.push(sx, sz, sp); ends.push(0); }
        else { seeds.push(sx, sz, sp, sx, sz, sp); ends.push(0, 1); }
      }
      g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 3));
      g.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(ends.length * 3), 3));
      return g;
    };
    this.hdata = new Uint8Array(32 * 32);
    this.htex = new THREE.DataTexture(this.hdata, 32, 32, THREE.RedFormat, THREE.UnsignedByteType);
    this.htex.minFilter = this.htex.magFilter = THREE.NearestFilter; this.htex.needsUpdate = true;
    const uni = (snow, color) => ({ uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uInt: { value: 0 }, uHeights: { value: this.htex }, uOrigin: { value: new THREE.Vector2() }, uSnow: { value: snow }, uColor: { value: new THREE.Color(color) } });
    this.rainU = uni(0, 0xaec4ff); this.snowU = uni(1, 0xffffff);
    const rm = new THREE.ShaderMaterial({ vertexShader: RV, fragmentShader: RF, uniforms: this.rainU, transparent: true, depthWrite: false });
    const sm = new THREE.ShaderMaterial({ vertexShader: RV, fragmentShader: RF, uniforms: this.snowU, transparent: true, depthWrite: false });
    this.rain = new THREE.LineSegments(mk(false), rm); this.snow = new THREE.Points(mk(true), sm);
    for (const o of [this.rain, this.snow]) { o.frustumCulled = false; o.renderOrder = 4; o.visible = false; g_scene(game).add(o); }
    this.hT = 0; this.splashT = 0;
    this.boltMat = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 1, depthWrite: false, fog: false });
  }
  set(s) {
    this.state = s;
    this.timer = s === 'clear' ? 600 + Math.random() * 900 : 150 + Math.random() * 300;
    this.rainTarget = s === 'clear' ? 0 : 1; this.thunderTarget = s === 'thunder' ? 1 : 0;
    this.nextStrike = 4 + Math.random() * 8;
  }
  update(dt) {
    const g = this.g, p = g.player, w = g.world;
    this.timer -= dt;
    if (this.timer <= 0) {
      const r = Math.random();
      if (this.state === 'clear') this.set(r < 0.7 ? 'rain' : 'thunder'); else this.set('clear');
    }
    g.rain += (this.rainTarget - g.rain) * Math.min(1, dt * 0.35);
    g.thunder += (this.thunderTarget - g.thunder) * Math.min(1, dt * 0.35);
    if (Math.abs(g.rain - this.rainTarget) < 0.01) g.rain = this.rainTarget;
    // молнии
    g.flash = Math.max(0, (g.flash || 0) - dt * 2.2);
    if (g.thunder > 0.5) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) { this.nextStrike = 7 + Math.random() * 20; this.strike(); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt;
      b.line.material.opacity = Math.max(0, b.t / 0.35);
      if (b.t <= 0) { g.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); this.bolts.splice(i, 1); }
    }
    // осадки
    if (!p) return;
    const biome = BIOMES[w.getBiome(Math.floor(p.x), Math.floor(p.z))];
    const snowing = biome && biome.cold && (g.rain > 0.02);
    const intensity = Math.min(1, g.rain * (g.thunder > 0.5 ? 1 : 0.8));
    this.rain.visible = !snowing && g.rain > 0.03; this.snow.visible = snowing;
    for (const u of [this.rainU, this.snowU]) { u.uCam.value.set(p.x, p.y + 1.6, p.z); u.uTime.value = g.clock; u.uInt.value = intensity; }
    // карта высот вокруг
    this.hT -= dt;
    if (this.hT <= 0 && g.rain > 0.02) {
      this.hT = 0.2;
      const ox = Math.floor(p.x) - 16, oz = Math.floor(p.z) - 16;
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) this.hdata[j * 32 + i] = w.topY(ox + i, oz + j);
      this.htex.needsUpdate = true;
      this.rainU.uOrigin.value.set(ox, oz); this.snowU.uOrigin.value.set(ox, oz);
    }
    // брызги
    if (this.rain.visible && g.particles && g.settings.particles) {
      this.splashT -= dt;
      if (this.splashT <= 0) {
        this.splashT = 0.03;
        for (let k = 0; k < 3 * intensity; k++) {
          const x = p.x + (Math.random() - 0.5) * 24, z = p.z + (Math.random() - 0.5) * 24;
          const y = w.topY(Math.floor(x), Math.floor(z));
          if (y > 0) g.particles.spawn(x, y + 1.05, z, (Math.random() - 0.5) * 0.4, 1.5, (Math.random() - 0.5) * 0.4, 0.25, 0.05, 12, 0.7, 0.8, 1, 0.6, null, { coll: false });
        }
      }
    }
  }
  strike() {
    const g = this.g, p = g.player, w = g.world;
    const a = Math.random() * 6.28, d = 25 + Math.random() * 60;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    const y = w.topY(Math.floor(x), Math.floor(z)) + 1;
    const pts = [new THREE.Vector3(x, 170, z)];
    let cx = x, cz = z;
    for (let yy = 160; yy > y; yy -= 6 + Math.random() * 8) { cx += (Math.random() - 0.5) * 6; cz += (Math.random() - 0.5) * 6; pts.push(new THREE.Vector3(cx, yy, cz)); }
    pts.push(new THREE.Vector3(x, y, z));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, this.boltMat.clone());
    line.frustumCulled = false; g.scene.add(line);
    this.bolts.push({ line, t: 0.35 });
    g.flash = 1;
    const dist = Math.hypot(x - p.x, z - p.z);
    setTimeout(() => g.sfx?.play('thunder', { x, y: p.y, z }, 1.2), Math.min(2500, dist * 12));
    if (dist < 4) g.survival?.damage(5, 'молния', null, true);
  }
  serialize() { return { state: this.state, timer: this.timer, rain: this.g.rain, thunder: this.g.thunder }; }
  load(d) { if (d) { this.state = d.state; this.timer = d.timer; this.rainTarget = d.state === 'clear' ? 0 : 1; this.thunderTarget = d.state === 'thunder' ? 1 : 0; this.g.rain = d.rain || 0; this.g.thunder = d.thunder || 0; } }
  dispose() { for (const o of [this.rain, this.snow]) { this.g.scene.remove(o); o.geometry.dispose(); o.material.dispose(); } for (const b of this.bolts) this.g.scene.remove(b.line); }
}
function g_scene(game) { return game.scene; }
