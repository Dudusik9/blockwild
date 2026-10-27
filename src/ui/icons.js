// Иконки предметов/блоков для интерфейса (изометрический куб или спрайт) — генерируются из атласа
import { ITEMS } from '../game/items.js';
import { BLOCKS, SHAPE, B } from '../world/blocks.js';
import { TILE_INDEX } from '../render/tilenames.js';
import { tilePixels } from '../render/textures.js';

const cache = new Map();
const GRASS = [124, 192, 90], FOLIAGE = [89, 174, 48];

function tileCanvas(tile, tint, mulv = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d');
  const px = tilePixels(tile);
  if (tint || mulv !== 1) for (let i = 0; i < px.length; i += 4) {
    const t = tint || [255, 255, 255];
    px[i] = px[i] * t[0] / 255 * mulv; px[i + 1] = px[i + 1] * t[1] / 255 * mulv; px[i + 2] = px[i + 2] * t[2] / 255 * mulv;
  }
  x.putImageData(new ImageData(px, 16, 16), 0, 0);
  return c;
}
function cubeIcon(b) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const tint = b.tint === 1 ? GRASS : b.tint === 2 ? FOLIAGE : null;
  const top = tileCanvas(b.faceTiles[2], b.tint ? tint : null);
  const left = tileCanvas(b.faceTiles[4], b.tint === 2 ? FOLIAGE : null);
  const right = tileCanvas(b.faceTiles[0], b.tint === 2 ? FOLIAGE : null);
  x.setTransform(1, 0.5, -1, 0.5, 16, 0); x.drawImage(top, 0, 0);
  x.setTransform(1, 0.5, 0, 1, 0, 8); x.drawImage(left, 0, 0); x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(0, 0, 16, 16);
  x.setTransform(1, -0.5, 0, 1, 16, 16); x.drawImage(right, 0, 0); x.fillStyle = 'rgba(0,0,0,0.38)'; x.fillRect(0, 0, 16, 16);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}
function spriteIcon(tile, tint) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(tileCanvas(tile, tint), 0, 0, 32, 32);
  return c;
}

export function itemIconCanvas(id) {
  if (cache.has(id)) return cache.get(id);
  const it = ITEMS.get(id);
  let c;
  if (!it) c = document.createElement('canvas');
  else if (it.isBlock) {
    const b = BLOCKS[it.block];
    if (b.shape === SHAPE.CROSS || b.id === B.torch || b.shape === SHAPE.PANE || b.name === 'door_lo_0_0') {
      const tile = b.name === 'door_lo_0_0' ? TILE_INDEX.door_bottom : b.shape === SHAPE.PANE ? TILE_INDEX.glass : b.tile;
      c = spriteIcon(tile, b.tint === 1 ? GRASS : null);
    } else c = cubeIcon(b);
  } else c = spriteIcon(TILE_INDEX[it.tile]);
  cache.set(id, c);
  return c;
}
const urlCache = new Map();
export function itemIconUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const u = itemIconCanvas(id).toDataURL();
  urlCache.set(id, u); return u;
}
