// Box-модели мобов с процедурно рисуемыми текстурами и анимацией конечностей
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

// прямоугольники граней на развёртке (u,v — начало бокса)
export function faceRects(u, v, w, h, d) {
  return {
    front: [u + d, v + d, w, h], back: [u + 2 * d + w, v + d, w, h], right: [u, v + d, d, h], left: [u + d + w, v + d, d, h],
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
  };
}
const FACES = [
  { k: 'front', c: (w, h, d) => [[-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]], n: [0, 0, 1] },
  { k: 'back', c: (w, h, d) => [[w, -h, -d], [-w, -h, -d], [-w, h, -d], [w, h, -d]], n: [0, 0, -1] },
  { k: 'left', c: (w, h, d) => [[w, -h, d], [w, -h, -d], [w, h, -d], [w, h, d]], n: [1, 0, 0] },
  { k: 'right', c: (w, h, d) => [[-w, -h, -d], [-w, -h, d], [-w, h, d], [-w, h, -d]], n: [-1, 0, 0] },
  { k: 'top', c: (w, h, d) => [[-w, h, d], [w, h, d], [w, h, -d], [-w, h, -d]], n: [0, 1, 0] },
  { k: 'bottom', c: (w, h, d) => [[w, -h, d], [-w, -h, d], [-w, -h, -d], [w, -h, -d]], n: [0, -1, 0] },
];
const SHADE = { front: 0.85, back: 0.85, left: 0.72, right: 0.72, top: 1.0, bottom: 0.5 };

export function boxGeo(w, h, d, u, v, tw, th, off, infl = 0) {
  const R = faceRects(u, v, w, h, d);
  const pos = [], uv = [], col = [], idx = [], nrm = [];
  const hw = (w + infl * 2) / 32, hh = (h + infl * 2) / 32, hd = (d + infl * 2) / 32;
  for (const F of FACES) {
    const r = R[F.k]; const b = pos.length / 3;
    const cs = F.c(hw, hh, hd);
    const uvs = [[r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]], [r[0] + r[2], r[1]], [r[0], r[1]]];
    for (let k = 0; k < 4; k++) {
      pos.push(cs[k][0] + off[0] / 16, cs[k][1] + off[1] / 16, cs[k][2] + off[2] / 16);
      uv.push(uvs[k][0] / tw, uvs[k][1] / th); const s = SHADE[F.k]; col.push(s, s, s); nrm.push(...F.n);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}

// Рисование текстур
export class Paint {
  constructor(w, h, seed) { this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.x = this.c.getContext('2d'); this.w = w; this.h = h; this.r = mulberry32(seed); }
  rect(x, y, w, h, col) { this.x.fillStyle = col; this.x.fillRect(x, y, w, h); }
  px(x, y, col) { this.x.fillStyle = col; this.x.fillRect(x, y, 1, 1); }
  shade(col, f) { const m = /^#(..)(..)(..)$/.exec(col); const c = [1, 2, 3].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(m[i], 16) * f)))); return `rgb(${c[0]},${c[1]},${c[2]})`; }
  noiseRect(x, y, w, h, col, amp = 0.12) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, this.shade(col, 1 + (this.r() - 0.5) * 2 * amp)); }
  box(u, v, w, h, d, col, amp = 0.12) { const R = faceRects(u, v, w, h, d); for (const k in R) { const r = R[k]; this.noiseRect(r[0], r[1], r[2], r[3], col, amp); } return R; }
  tex() { const t = new THREE.CanvasTexture(this.c); t.magFilter = t.minFilter = THREE.NearestFilter; t.flipY = false; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; return t; }
}

// Модель: def = {tw,th, parts:[{n,size,uv,pivot,off,infl}], paint(P)}
export class MobModel {
  constructor(def, texture) {
    this.def = def; this.group = new THREE.Group(); this.parts = {};
    this.mat = new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, alphaTest: 0.5, side: THREE.FrontSide });
    for (const p of def.parts) {
      const geo = boxGeo(p.size[0], p.size[1], p.size[2], p.uv[0], p.uv[1], def.tw, def.th, p.off || [0, -p.size[1] / 2, 0], p.infl || 0);
      const m = new THREE.Mesh(geo, this.mat);
      m.position.set(p.pivot[0] / 16, p.pivot[1] / 16, p.pivot[2] / 16);
      m.userData.own = true;
      this.group.add(m); this.parts[p.n] = m;
    }
  }
}
