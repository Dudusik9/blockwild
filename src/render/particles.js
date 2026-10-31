// Частицы: единый инстансинг-пул, билборды (осколки блоков, дым, капли, пузыри, взрыв, пламя)
import * as THREE from 'three';
import { BLOCKS, SOLID } from '../world/blocks.js';
import { TILE_INDEX } from './tilenames.js';

const MAX = 3500;
const VERT = /* glsl */`
attribute vec3 iPos; attribute float iSize; attribute vec4 iUV; attribute vec4 iCol;
varying vec2 vUv; varying vec4 vCol; varying vec4 vUVR; varying float vD;
void main() {
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  mv.xy += position.xy * iSize;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy + 0.5; vUVR = iUV; vCol = iCol; vD = length(mv.xyz);
}`;
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uAtlas; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
varying vec2 vUv; varying vec4 vCol; varying vec4 vUVR; varying float vD;
void main() {
  vec4 c = vCol;
  if (vUVR.z >= 0.0) {
    vec2 uv = mix(vUVR.xy, vUVR.zw, vec2(vUv.x, 1.0 - vUv.y));
    vec4 t = texture2D(uAtlas, uv);
    if (t.a < 0.5) discard;
    c.rgb *= t.rgb;
  } else {
    // мягкая круглая частица
    float d = length(vUv - 0.5) * 2.0;
    c.a *= smoothstep(1.0, 0.45, d);
    if (c.a < 0.02) discard;
  }
  float fog = smoothstep(uFogNear, uFogFar, vD);
  c.rgb = mix(c.rgb, uFogColor, fog);
  gl_FragColor = c;
}`;

export class Particles {
  constructor(scene, atlas, world, uniforms) {
    this.world = world; this.n = 0;
    this.px = new Float32Array(MAX * 3); this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX); this.maxLife = new Float32Array(MAX); this.size = new Float32Array(MAX); this.grow = new Float32Array(MAX);
    this.grav = new Float32Array(MAX); this.drag = new Float32Array(MAX); this.uv = new Float32Array(MAX * 4); this.col = new Float32Array(MAX * 4);
    this.fade = new Uint8Array(MAX); this.coll = new Uint8Array(MAX);
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.aUV = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    for (const a of [this.aPos, this.aSize, this.aUV, this.aCol]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize); g.setAttribute('iUV', this.aUV); g.setAttribute('iCol', this.aCol);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms: { uAtlas: { value: atlas }, uFogColor: uniforms.uFogColor, uFogNear: uniforms.uFogNear, uFogFar: uniforms.uFogFar } });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.geo = g; this.enabled = true; this.density = 1;
  }
  spawn(x, y, z, vx, vy, vz, life, size, grav, r, g, b, a, uvr, o = {}) {
    if (!this.enabled) return;
    if (this.density < 1 && Math.random() > this.density) return;
    if (this.n >= MAX) return;
    const i = this.n++;
    this.px[i * 3] = x; this.px[i * 3 + 1] = y; this.px[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grow[i] = o.grow || 0; this.grav[i] = grav; this.drag[i] = o.drag === undefined ? 0.5 : o.drag;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    if (uvr) { this.uv[i * 4] = uvr[0]; this.uv[i * 4 + 1] = uvr[1]; this.uv[i * 4 + 2] = uvr[2]; this.uv[i * 4 + 3] = uvr[3]; }
    else { this.uv[i * 4] = 0; this.uv[i * 4 + 1] = 0; this.uv[i * 4 + 2] = -1; this.uv[i * 4 + 3] = 0; }
    this.fade[i] = o.fade === undefined ? 1 : o.fade; this.coll[i] = o.coll ? 1 : 0;
  }
  uvOfTile(tile, rnd) {
    const tx = tile & 15, ty = tile >> 4;
    const s = 4 + (Math.random() * 3 | 0), ox = (Math.random() * (16 - s)) | 0, oy = (Math.random() * (16 - s)) | 0;
    const u0 = (tx * 16 + ox + 0.5) / 256, v0 = (ty * 16 + oy + 0.5) / 256, u1 = (tx * 16 + ox + s - 0.5) / 256, v1 = (ty * 16 + oy + s - 0.5) / 256;
    return [u0, v0, u1, v1];
  }
  breakBlock(x, y, z, id, bright = 1, tintRGB) {
    if (!this.enabled) return;
    const b = BLOCKS[id]; if (!b) return;
    const n = b.shape === 1 ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const f = [0, 1, 2, 4, 5][(Math.random() * 5) | 0];
      const tile = b.faceTiles[f];
      const col = tintRGB && (f === 2 || b.tint === 2) ? tintRGB : [1, 1, 1];
      this.spawn(x + 0.15 + Math.random() * 0.7, y + 0.1 + Math.random() * 0.8, z + 0.15 + Math.random() * 0.7,
        (Math.random() - 0.5) * 3.2, Math.random() * 3 + 0.5, (Math.random() - 0.5) * 3.2, 0.6 + Math.random() * 0.7, 0.07 + Math.random() * 0.09, 17,
        col[0] * bright, col[1] * bright, col[2] * bright, 1, this.uvOfTile(tile), { coll: true, fade: 0, drag: 0.1 });
    }
  }
  hitBlock(x, y, z, nx, ny, nz, id, bright = 1) {
    const b = BLOCKS[id]; if (!b) return;
    for (let i = 0; i < 2; i++) {
      const tile = b.faceTiles[2];
      this.spawn(x + 0.5 + nx * 0.55 + (Math.random() - 0.5) * (nx ? 0 : 0.9), y + 0.5 + ny * 0.55 + (Math.random() - 0.5) * (ny ? 0 : 0.9), z + 0.5 + nz * 0.55 + (Math.random() - 0.5) * (nz ? 0 : 0.9),
        nx * 1.5 + (Math.random() - 0.5), ny * 1.5 + Math.random() * 1.2, nz * 1.5 + (Math.random() - 0.5), 0.4 + Math.random() * 0.3, 0.06, 15, bright, bright, bright, 1, this.uvOfTile(tile), { coll: true, fade: 0 });
    }
  }
  crumbs(x, y, z, tile, n = 3) {
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.5, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 1.5, 0.5, 0.06, 14, 1, 1, 1, 1, this.uvOfTile(tile), { fade: 0 });
  }
  smoke(x, y, z, v = 0.5, size = 0.22, life = 1.4) {
    this.spawn(x, y, z, (Math.random() - 0.5) * 0.25, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25, life, size, -0.05, v, v, v, 0.55, null, { grow: 0.18, drag: 0.4 });
  }
  flame(x, y, z) {
    this.spawn(x + (Math.random() - 0.5) * 0.06, y, z + (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.1, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.1, 0.4 + Math.random() * 0.25, 0.08, 0, 1, 0.65 + Math.random() * 0.25, 0.15, 0.9, null, { drag: 0.3 });
  }
  splash(x, y, z, n = 10, up = 3) {
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2.5, up * (0.4 + Math.random()), (Math.random() - 0.5) * 2.5, 0.6 + Math.random() * 0.4, 0.07, 14, 0.55, 0.75, 1, 0.85, null, { fade: 1 });
  }
  bubble(x, y, z) {
    this.spawn(x, y, z, (Math.random() - 0.5) * 0.2, 0.9 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2, 1.6, 0.07, 0, 0.8, 0.92, 1, 0.8, null, { drag: 0.2 });
  }
  drip(x, y, z) { this.spawn(x, y, z, 0, 0, 0, 1.0, 0.05, 12, 0.5, 0.7, 1, 0.9, null, { coll: true }); }
  hurt(x, y, z, n = 8) { for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 0.5, y + Math.random() * 1.2, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.5, 0.08, 10, 0.8, 0.1, 0.1, 1, null, { fade: 1 }); }
  fullTile(tile) { const tx = tile & 15, ty = tile >> 4; return [(tx * 16 + 0.5) / 256, (ty * 16 + 0.5) / 256, (tx * 16 + 15.5) / 256, (ty * 16 + 15.5) / 256]; }
  hearts(x, y, z, n = 6) {
    const uv = this.fullTile(TILE_INDEX.fx_heart);
    for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 0.7, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.5, 0.9 + Math.random() * 0.7, (Math.random() - 0.5) * 0.5, 1.1 + Math.random() * 0.6, 0.16 + Math.random() * 0.06, -0.4, 1, 0.35, 0.55, 1, uv, { fade: 1, drag: 0.6 });
  }
  // праздничный салют из звёздочек
  confetti(x, y, z, n = 40) {
    const uv = this.fullTile(TILE_INDEX.fx_star), C = [[1, 0.85, 0.2], [1, 0.4, 0.4], [0.4, 0.8, 1], [0.5, 1, 0.5], [1, 0.55, 1]];
    for (let i = 0; i < n; i++) {
      const c = C[i % C.length], a = Math.random() * 6.283, s = 1 + Math.random() * 2.5;
      this.spawn(x, y, z, Math.cos(a) * s, 4 + Math.random() * 4, Math.sin(a) * s, 1.6 + Math.random() * 0.8, 0.14 + Math.random() * 0.08, 6, c[0], c[1], c[2], 1, uv, { fade: 1, drag: 0.8 });
    }
  }
  // маяк над целью миссии: звёздочки поднимаются столбиком
  beacon(x, y, z) {
    this.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, 0, 1.6, 0, 1.6, 0.22, -0.3, 1, 0.9, 0.25, 1, this.fullTile(TILE_INDEX.fx_star), { fade: 1, drag: 0.2 });
  }
  poof(x, y, z, n = 10) { for (let i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.9, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5, 0.7 + Math.random() * 0.5, 0.2, -0.2, 0.92, 0.92, 0.92, 0.7, null, { grow: 0.15 }); }
  explosion(x, y, z, power) {
    const n = Math.floor(30 + power * 12);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, e = (Math.random() - 0.3) * 2, sp = (2 + Math.random() * 6) * (0.5 + power * 0.2);
      this.spawn(x, y, z, Math.cos(a) * sp, e * sp * 0.5 + 1, Math.sin(a) * sp, 0.6 + Math.random() * 0.8, 0.5 + Math.random() * 0.6, 0, 1, 0.7 + Math.random() * 0.3, 0.2, 0.9, null, { grow: 0.8, drag: 1.2 });
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = (1 + Math.random() * 4) * (0.5 + power * 0.2);
      this.spawn(x, y, z, Math.cos(a) * sp, Math.random() * 3, Math.sin(a) * sp, 1.2 + Math.random() * 1.2, 0.6 + Math.random() * 0.7, -0.4, 0.3, 0.3, 0.3, 0.75, null, { grow: 0.6, drag: 0.8 });
    }
  }
  update(dt, cam) {
    const w = this.world; let j = 0;
    for (let i = 0; i < this.n; i++) {
      let l = this.life[i] - dt;
      if (l <= 0) continue;
      const i3 = i * 3, i4 = i * 4;
      let vx = this.vel[i3], vy = this.vel[i3 + 1], vz = this.vel[i3 + 2];
      vy -= this.grav[i] * dt;
      const d = Math.max(0, 1 - this.drag[i] * dt); vx *= d; vz *= d; if (this.grav[i] <= 0) vy *= d;
      let x = this.px[i3] + vx * dt, y = this.px[i3 + 1] + vy * dt, z = this.px[i3 + 2] + vz * dt;
      if (this.coll[i] && w) {
        const id = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        if (id && SOLID[id]) { x = this.px[i3]; y = this.px[i3 + 1]; z = this.px[i3 + 2]; vx *= 0.3; vz *= 0.3; vy = vy < 0 ? 0 : -vy * 0.3; }
      }
      // сжатие массива
      if (j !== i) {
        this.life[j] = l; this.maxLife[j] = this.maxLife[i]; this.size[j] = this.size[i]; this.grow[j] = this.grow[i]; this.grav[j] = this.grav[i]; this.drag[j] = this.drag[i];
        this.fade[j] = this.fade[i]; this.coll[j] = this.coll[i];
        for (let k = 0; k < 4; k++) { this.uv[j * 4 + k] = this.uv[i4 + k]; this.col[j * 4 + k] = this.col[i4 + k]; }
      } else this.life[j] = l;
      this.px[j * 3] = x; this.px[j * 3 + 1] = y; this.px[j * 3 + 2] = z; this.vel[j * 3] = vx; this.vel[j * 3 + 1] = vy; this.vel[j * 3 + 2] = vz;
      this.size[j] += this.grow[j] * dt;
      // выход в атрибуты
      this.aPos.array[j * 3] = x; this.aPos.array[j * 3 + 1] = y; this.aPos.array[j * 3 + 2] = z;
      this.aSize.array[j] = this.size[j];
      for (let k = 0; k < 4; k++) this.aUV.array[j * 4 + k] = this.uv[j * 4 + k];
      const a = this.col[j * 4 + 3] * (this.fade[j] ? Math.min(1, l / (this.maxLife[j] * 0.6)) : 1);
      this.aCol.array[j * 4] = this.col[j * 4]; this.aCol.array[j * 4 + 1] = this.col[j * 4 + 1]; this.aCol.array[j * 4 + 2] = this.col[j * 4 + 2]; this.aCol.array[j * 4 + 3] = a;
      j++;
    }
    this.n = j;
    this.geo.instanceCount = j;
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aUV.needsUpdate = this.aCol.needsUpdate = true;
  }
}
