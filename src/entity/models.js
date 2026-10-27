// Геометрия предметов/блоков для сущностей, руки и иконок: куб с UV из атласа, выдавленный спрайт
import * as THREE from 'three';
import { BLOCKS, SHAPE, B } from '../world/blocks.js';
import { ITEMS } from '../game/items.js';
import { TILE_INDEX } from '../render/tilenames.js';
import { tilePixels } from '../render/textures.js';

const cache = new Map();
const GRASS = [0.47, 0.75, 0.35], FOLIAGE = [0.35, 0.68, 0.19];

function faceUV(tile) {
  const tx = (tile & 15) * 16, ty = (tile >> 4) * 16, e = 0.02;
  return [(tx + e) / 256, (ty + e) / 256, (tx + 16 - e) / 256, (ty + 16 - e) / 256];
}
// куб единичного размера с центром в (0,0,0)
const FACES = [
  { n: [1, 0, 0], v: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]], f: 0 },
  { n: [-1, 0, 0], v: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]], f: 1 },
  { n: [0, 1, 0], v: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]], f: 2 },
  { n: [0, -1, 0], v: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]], f: 3 },
  { n: [0, 0, 1], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]], f: 4 },
  { n: [0, 0, -1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]], f: 5 },
];
const SHADE = [0.8, 0.8, 1.0, 0.5, 0.65, 0.65];

export function cubeGeometry(block, sy = 1) {
  const pos = [], uv = [], col = [], idx = [];
  for (const F of FACES) {
    const tile = block.faceTiles[F.f]; const u = faceUV(tile);
    let c = [1, 1, 1];
    if (block.tint === 1 && F.f === 2) c = GRASS; else if (block.tint === 2) c = FOLIAGE;
    const s = SHADE[F.f];
    const base = pos.length / 3;
    const uvs = [[u[0], u[3]], [u[2], u[3]], [u[2], u[1]], [u[0], u[1]]];
    for (let k = 0; k < 4; k++) { pos.push(F.v[k][0], F.v[k][1] * sy, F.v[k][2]); uv.push(uvs[k][0], uvs[k][1]); col.push(c[0] * s, c[1] * s, c[2] * s); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
// плоский спрайт с толщиной по пикселям тайла
export function spriteGeometry(tile, thick = 1 / 16, tint) {
  const px = tilePixels(tile);
  const A = (x, y) => (x < 0 || y < 0 || x > 15 || y > 15 ? 0 : px[(y * 16 + x) * 4 + 3]);
  const pos = [], uv = [], col = [], idx = [];
  const u = faceUV(tile);
  const tc = tint || [1, 1, 1];
  const quad = (p, uvs, c) => { const b = pos.length / 3; for (let k = 0; k < 4; k++) { pos.push(p[k][0], p[k][1], p[k][2]); uv.push(uvs[k][0], uvs[k][1]); col.push(c[0], c[1], c[2]); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const h = thick / 2;
  // лицо
  quad([[-0.5, -0.5, h], [0.5, -0.5, h], [0.5, 0.5, h], [-0.5, 0.5, h]], [[u[0], u[3]], [u[2], u[3]], [u[2], u[1]], [u[0], u[1]]], [tc[0], tc[1], tc[2]]);
  quad([[0.5, -0.5, -h], [-0.5, -0.5, -h], [-0.5, 0.5, -h], [0.5, 0.5, -h]], [[u[2], u[3]], [u[0], u[3]], [u[0], u[1]], [u[2], u[1]]], [tc[0] * 0.8, tc[1] * 0.8, tc[2] * 0.8]);
  // рёбра
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (A(x, y) < 128) continue;
    const x0 = x / 16 - 0.5, x1 = (x + 1) / 16 - 0.5, y0 = 0.5 - (y + 1) / 16, y1 = 0.5 - y / 16;
    const pu = (px0) => (tile & 15) * 16 + px0, pv = () => (tile >> 4) * 16;
    const cu = ((tile & 15) * 16 + x + 0.5) / 256, cv = ((tile >> 4) * 16 + y + 0.5) / 256;
    const c = [tc[0] * 0.7, tc[1] * 0.7, tc[2] * 0.7];
    const U = [[cu, cv], [cu, cv], [cu, cv], [cu, cv]];
    if (A(x - 1, y) < 128) quad([[x0, y0, -h], [x0, y0, h], [x0, y1, h], [x0, y1, -h]], U, c);
    if (A(x + 1, y) < 128) quad([[x1, y0, h], [x1, y0, -h], [x1, y1, -h], [x1, y1, h]], U, c);
    if (A(x, y - 1) < 128) quad([[x0, y1, h], [x1, y1, h], [x1, y1, -h], [x0, y1, -h]], U, c);
    if (A(x, y + 1) < 128) quad([[x0, y0, -h], [x1, y0, -h], [x1, y0, h], [x0, y0, h]], U, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}

// Геометрия для предмета по id: {geo, flat}
export function itemModel(itemId) {
  if (cache.has(itemId)) return cache.get(itemId);
  const it = ITEMS.get(itemId);
  let res;
  if (it && it.isBlock) {
    const b = BLOCKS[it.block];
    if (b.shape === SHAPE.CROSS || b.id === B.torch || b.shape === SHAPE.PANE || b.name === 'door_lo_0_0') {
      const tile = b.name === 'door_lo_0_0' ? TILE_INDEX.door_bottom : b.id === B.torch ? TILE_INDEX.torch : b.shape === SHAPE.PANE ? TILE_INDEX.glass : b.tile;
      res = { geo: spriteGeometry(tile, 1 / 16, b.tint === 1 ? GRASS : undefined), flat: true };
    } else {
      const sy = b.shape === SHAPE.BOX && b.boxes && b.boxes.length === 1 && b.boxes[0][4] - b.boxes[0][1] <= 8 ? 0.5 : 1;
      res = { geo: cubeGeometry(b, sy), flat: false };
    }
  } else if (it) {
    res = { geo: spriteGeometry(TILE_INDEX[it.tile], 1 / 16), flat: true };
  } else res = { geo: cubeGeometry(BLOCKS[1]), flat: false };
  cache.set(itemId, res);
  return res;
}
