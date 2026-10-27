// Объёмные кубические облака: два слоя, движутся по ветру
import * as THREE from 'three';
import { Simplex } from '../core/noise.js';

const LAYERS = [
  { y: 132, cell: 12, thick: 5, speed: 1.6, scale: 0.11, thr: 0.12, off: 0 },
  { y: 168, cell: 20, thick: 3, speed: 2.6, scale: 0.09, thr: 0.22, off: 500 },
];
const N = 16; // радиус в клетках

export class Clouds {
  constructor(scene, seed) {
    this.noise = new Simplex(seed + 777);
    this.scene = scene;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.86, depthWrite: false, fog: true, side: THREE.FrontSide });
    this.layers = LAYERS.map((L) => ({ L, mesh: null, key: '', pos: 0 }));
    this.group = new THREE.Group(); scene.add(this.group);
    this.enabled = true;
    this.color = new THREE.Color(1, 1, 1);
  }
  density(L, ix, iz) {
    const n = this.noise;
    return n.noise2(ix * L.scale + L.off, iz * L.scale) * 0.75 + n.noise2(ix * L.scale * 2.7 + 40, iz * L.scale * 2.7 + L.off) * 0.25;
  }
  build(layer, pcx, pcz, wcell) {
    const L = layer.L, cs = L.cell;
    const pos = [], col = [], idx = [];
    let vi = 0;
    const has = (x, z) => this.density(L, x + pcx + wcell, z + pcz) > L.thr + (this.cover || 0);
    const face = (p, c) => { for (let k = 0; k < 4; k++) { pos.push(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]); col.push(c, c, c); } idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4; };
    const NN = this.low ? 9 : N;
    for (let z = -NN; z <= NN; z++) for (let x = -NN; x <= NN; x++) {
      if (!has(x, z)) continue;
      const x0 = x * cs, x1 = x0 + cs, z0 = z * cs, z1 = z0 + cs, y0 = 0, y1 = L.thick;
      face([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], 1.0);
      face([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], 0.62);
      if (!has(x + 1, z)) face([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], 0.82);
      if (!has(x - 1, z)) face([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], 0.82);
      if (!has(x, z + 1)) face([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], 0.72);
      if (!has(x, z - 1)) face([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], 0.72);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    if (layer.mesh) { this.group.remove(layer.mesh); layer.mesh.geometry.dispose(); }
    layer.mesh = new THREE.Mesh(g, this.mat); layer.mesh.frustumCulled = false; layer.mesh.renderOrder = 2;
    this.group.add(layer.mesh);
  }
  update(camPos, time, color, coverage) {
    this.group.visible = this.enabled;
    if (!this.enabled) return;
    this.mat.color.copy(color);
    this.cover = -coverage * 0.25;
    for (const layer of this.layers) {
      if (this.low && layer !== this.layers[0]) { if (layer.mesh) layer.mesh.visible = false; continue; }
      const L = layer.L, cs = L.cell;
      const wind = time * L.speed / cs; // в клетках
      const wcell = Math.floor(wind);
      const pcx = Math.floor(camPos.x / cs), pcz = Math.floor(camPos.z / cs);
      // ячейка паттерна: x-клетка паттерна = x_world_cell + wcell
      const key = wcell + ':' + pcx + ':' + pcz + ':' + this.cover.toFixed(2);
      if (key !== layer.key) { layer.key = key; this.build(layer, pcx, pcz, wcell); layer.base = pcx; }
      const frac = wind - wcell;
      layer.mesh.position.set(layer.base * cs - frac * cs, L.y, Math.floor(camPos.z / cs) * cs);
    }
  }
}
