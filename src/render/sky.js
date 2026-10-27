// Небо: градиент-шейдер, закаты, звёзды, солнце и луна с фазами
import * as THREE from 'three';
import { smoothstep, clamp, lerp } from '../core/math.js';

const SKY_V = /* glsl */`
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`;
const SKY_F = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uTwi; uniform float uTwiAmt; uniform vec3 uSunDir; uniform float uStars; uniform float uTime; uniform float uFlash; uniform vec3 uFlashCol;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = pow(clamp(h, 0.0, 1.0), 0.55);
  vec3 col = mix(uHorizon, uTop, t);
  if (h < 0.0) col = mix(uHorizon, uHorizon * 0.8, clamp(-h * 3.0, 0.0, 1.0));
  // сумерки — тёплое свечение у горизонта в сторону солнца
  vec3 sh = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4);
  float az = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), sh), 0.0);
  float glow = pow(az, 3.0) * exp(-abs(h) * 5.0) * uTwiAmt;
  col = mix(col, uTwi, clamp(glow, 0.0, 1.0));
  col += uTwi * 0.25 * uTwiAmt * exp(-abs(h) * 9.0);
  // звёзды
  if (uStars > 0.01 && h > -0.05) {
    vec3 p = d * 90.0;
    vec3 f = floor(p);
    float r = hash(f);
    if (r > 0.9855) {
      vec3 c = f + 0.5 + (vec3(hash(f + 1.7), hash(f + 3.1), hash(f + 5.3)) - 0.5) * 0.6;
      float dist = length(p - c);
      float tw = 0.75 + 0.25 * sin(uTime * 2.0 + r * 80.0);
      float s = smoothstep(0.55, 0.0, dist) * tw * (0.4 + (r - 0.9855) * 40.0);
      col += vec3(0.9, 0.95, 1.0) * s * uStars * smoothstep(-0.05, 0.2, h);
    }
  }
  col += uFlashCol * uFlash;
  gl_FragColor = vec4(col, 1.0);
}`;

function sunTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const g = x.createRadialGradient(32, 32, 6, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,180,0.55)'); g.addColorStop(1, 'rgba(255,200,100,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff6c4'; x.fillRect(18, 18, 28, 28);
  x.fillStyle = '#ffe680'; x.fillRect(20, 20, 24, 24);
  x.fillStyle = '#fffbe0'; x.fillRect(24, 24, 16, 16);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; return t;
}
function moonTexture() { // 4x2 фазы
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  for (let ph = 0; ph < 8; ph++) {
    const ox = (ph % 4) * 32, oy = Math.floor(ph / 4) * 32;
    for (let yy = 0; yy < 32; yy++) for (let xx = 0; xx < 32; xx++) {
      const dx = (xx - 15.5) / 12, dy = (yy - 15.5) / 12;
      if (dx * dx + dy * dy > 1) continue;
      // освещённая часть: фаза 0 полная, 4 новая
      const ang = ph / 8 * Math.PI * 2; const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      const lit = dx * Math.sin(ang) + nz * Math.cos(ang) > 0.0;
      const crater = ((xx * 7 + yy * 13) % 11 === 0) || ((xx - 10) ** 2 + (yy - 12) ** 2 < 6) || ((xx - 20) ** 2 + (yy - 19) ** 2 < 9);
      const base = lit ? (crater ? 200 : 240) : 22;
      x.fillStyle = lit ? `rgb(${base},${base},${base - 8})` : `rgba(30,34,52,0.9)`;
      x.fillRect(ox + xx, oy + yy, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.uniforms = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uTwi: { value: new THREE.Color(1, 0.5, 0.2) }, uTwiAmt: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uStars: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(0.8, 0.85, 1) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, depthTest: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat); this.dome.renderOrder = -100; this.dome.frustumCulled = false;
    this.group.add(this.dome);
    this.sunMat = new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), this.sunMat); this.sun.renderOrder = -90; this.sun.frustumCulled = false; this.group.add(this.sun);
    this.moonTex = moonTexture(); this.moonTex.repeat.set(0.25, 0.5);
    this.moonMat = new THREE.MeshBasicMaterial({ map: this.moonTex, transparent: true, depthWrite: false, depthTest: false, fog: false });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), this.moonMat); this.moon.renderOrder = -89; this.moon.frustumCulled = false; this.group.add(this.moon);
    // выходные значения для остального рендера
    this.horizon = new THREE.Color(); this.top = new THREE.Color();
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.daylight = 1; this.sunLight = new THREE.Color(1, 1, 1);
    this.flash = 0;
    this._c = [new THREE.Color(), new THREE.Color()];
  }
  // t: тики 0..24000 (6000 — полдень), day: номер суток, rain: 0..1, thunder: 0..1
  update(camPos, t, day, rain, thunder, time, flash) {
    const th = ((t - 6000) / 24000) * Math.PI * 2;
    this.sunDir.set(Math.sin(th), Math.cos(th), 0.28).normalize();
    const e = this.sunDir.y;
    const d = smoothstep(-0.14, 0.22, e);
    this.daylight = d;
    const gray = 0.55 * rain;
    const topDay = [0.26, 0.5, 0.92], topNight = [0.012, 0.02, 0.06];
    const horDay = [0.68, 0.82, 0.98], horNight = [0.03, 0.045, 0.11];
    const top = [lerp(topNight[0], topDay[0], d), lerp(topNight[1], topDay[1], d), lerp(topNight[2], topDay[2], d)];
    const hor = [lerp(horNight[0], horDay[0], d), lerp(horNight[1], horDay[1], d), lerp(horNight[2], horDay[2], d)];
    const gl = (0.5 + 0.5 * d) * (1 - 0.25 * thunder);
    for (let i = 0; i < 3; i++) { top[i] = lerp(top[i], gl * 0.42 * (d + 0.05), gray); hor[i] = lerp(hor[i], gl * 0.55 * (d + 0.06), gray); }
    this.uniforms.uTop.value.setRGB(top[0], top[1], top[2]);
    this.uniforms.uHorizon.value.setRGB(hor[0], hor[1], hor[2]);
    this.top.setRGB(top[0], top[1], top[2]); this.horizon.setRGB(hor[0], hor[1], hor[2]);
    const tw = Math.pow(clamp(1 - Math.abs(e) / 0.3, 0, 1), 1.5) * (1 - 0.8 * rain);
    this.uniforms.uTwiAmt.value = tw; this.uniforms.uTwi.value.setRGB(1.0, 0.52 + 0.2 * (1 - tw), 0.22);
    this.uniforms.uSunDir.value.copy(this.sunDir);
    this.uniforms.uStars.value = (1 - smoothstep(-0.2, 0.1, e)) * (1 - rain);
    this.uniforms.uTime.value = time; this.uniforms.uFlash.value = flash; this.flash = flash;
    this.dome.position.copy(camPos);
    this.group.position.copy(camPos);
    // свет
    const sc = this.sunLight;
    const nightC = [0.17, 0.2, 0.36], dayC = [1, 1, 1];
    sc.setRGB(lerp(nightC[0], dayC[0], d), lerp(nightC[1], dayC[1], d), lerp(nightC[2], dayC[2], d));
    sc.r *= 1 + tw * 0.1; sc.g *= 1 - tw * 0.1; sc.b *= 1 - tw * 0.28;
    const dim = 1 - rain * 0.3 - thunder * 0.15;
    sc.multiplyScalar(dim);
    // солнце/луна
    const sd = this.sunDir;
    this.sun.position.set(sd.x * 300, sd.y * 300, sd.z * 300);
    this.sun.lookAt(camPos.x, camPos.y, camPos.z);
    // lookAt в мировых координатах — поправка на group.position
    this.sun.lookAt(this.group.position);
    this.moon.position.set(-sd.x * 300, -sd.y * 300, -sd.z * 300); this.moon.lookAt(this.group.position);
    const ph = ((day % 8) + 8) % 8;
    this.moonTex.offset.set((ph % 4) * 0.25, 0.5 - Math.floor(ph / 4) * 0.5);
    this.sunMat.opacity = (1 - rain * 0.9) * smoothstep(-0.25, 0.0, e);
    this.moonMat.opacity = (1 - rain * 0.9) * smoothstep(-0.25, 0.0, -e);
    this.sun.visible = this.sunMat.opacity > 0.01; this.moon.visible = this.moonMat.opacity > 0.01;
  }
}
