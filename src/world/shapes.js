// Коллизионные и выделяемые боксы блоков (в долях блока)
import { BLOCKS, SHAPE, B, OPAQUE } from './blocks.js';

const FULL = [[0, 0, 0, 1, 1, 1]];
const cache = new Array(BLOCKS.length);
for (const b of BLOCKS) {
  if (b.shape === SHAPE.BOX && b.boxes) cache[b.id] = b.boxes.map((q) => q.map((v) => v / 16));
  else if (b.shape === SHAPE.CUBE) cache[b.id] = FULL;
  else cache[b.id] = null;
}
const PLANT_SEL = [[0.2, 0, 0.2, 0.8, 0.8, 0.8]];
const CROP_SEL = [[0, 0, 0, 1, 0.3, 1]];
const TORCH_SEL = [[0.4, 0, 0.4, 0.6, 0.65, 0.6]];

export function collisionBoxes(world, id, x, y, z) {
  const b = BLOCKS[id];
  if (!b.solid) return null;
  if (b.shape === SHAPE.PANE) return paneBoxes(world, x, y, z);
  return cache[id];
}
export function selectBoxes(world, id, x, y, z) {
  const b = BLOCKS[id];
  if (!b.selectable) return null;
  if (b.shape === SHAPE.PANE) return paneBoxes(world, x, y, z);
  if (b.shape === SHAPE.CROSS) return PLANT_SEL;
  if (b.shape === SHAPE.CROP) return CROP_SEL;
  if (id === B.torch) return TORCH_SEL;
  return cache[id] || FULL;
}
function paneBoxes(world, x, y, z) {
  const out = [[7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16]];
  const c = (nx, nz) => { const n = world.getBlock(nx, y, nz); return n === B.glass_pane || OPAQUE[n] || n === B.glass; };
  if (c(x, z - 1)) out.push([7 / 16, 0, 0, 9 / 16, 1, 7 / 16]);
  if (c(x, z + 1)) out.push([7 / 16, 0, 9 / 16, 9 / 16, 1, 1]);
  if (c(x - 1, z)) out.push([0, 0, 7 / 16, 7 / 16, 1, 9 / 16]);
  if (c(x + 1, z)) out.push([9 / 16, 0, 7 / 16, 1, 1, 9 / 16]);
  return out;
}
