// AABB-физика по осям: общая для игрока, мобов, предметов и падающих блоков
import { collisionBoxes } from '../world/shapes.js';

const MAXB = 4096;
const boxes = new Float64Array(MAXB * 6);
let nb = 0;

function gather(world, x0, y0, z0, x1, y1, z1) {
  nb = 0;
  const ix0 = Math.floor(x0), ix1 = Math.floor(x1), iy0 = Math.max(0, Math.floor(y0)), iy1 = Math.min(255, Math.floor(y1)), iz0 = Math.floor(z0), iz1 = Math.floor(z1);
  for (let z = iz0; z <= iz1; z++) for (let x = ix0; x <= ix1; x++) {
    const ch = world.getChunk(x >> 4, z >> 4);
    if (!ch || !ch.ready) { // неподгруженная область — стена
      if (nb < MAXB) { const o = nb * 6; boxes[o] = x; boxes[o + 1] = -64; boxes[o + 2] = z; boxes[o + 3] = x + 1; boxes[o + 4] = 400; boxes[o + 5] = z + 1; nb++; }
      continue;
    }
    for (let y = iy0; y <= iy1; y++) {
      const id = ch.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
      if (id === 0) continue;
      const bx = collisionBoxes(world, id, x, y, z);
      if (!bx) continue;
      for (let k = 0; k < bx.length && nb < MAXB; k++) {
        const q = bx[k], o = nb * 6;
        boxes[o] = x + q[0]; boxes[o + 1] = y + q[1]; boxes[o + 2] = z + q[2]; boxes[o + 3] = x + q[3]; boxes[o + 4] = y + q[4]; boxes[o + 5] = z + q[5]; nb++;
      }
    }
  }
  // дно мира
  if (iy0 <= 0 && y0 < 0.0 && nb < MAXB) { const o = nb * 6; boxes[o] = x0 - 1; boxes[o + 1] = -10; boxes[o + 2] = z0 - 1; boxes[o + 3] = x1 + 1; boxes[o + 4] = 0; boxes[o + 5] = z1 + 1; nb++; }
}

// e: {x,y,z (ноги, центр), w, h}; результат в e.hitX/hitY/hitZ/onGround
export function moveEntity(world, e, dx, dy, dz, opts) {
  opts = opts || {};
  const hw = e.w / 2;
  const oy = dy;
  const step = opts.step || 0;
  gather(world, e.x - hw + Math.min(0, dx) - 0.001, e.y + Math.min(0, dy) - 0.001, e.z - hw + Math.min(0, dz) - 0.001, e.x + hw + Math.max(0, dx) + 0.001, e.y + e.h + Math.max(0, dy) + 0.001, e.z + hw + Math.max(0, dz) + 0.001);
  // Y
  for (let i = 0; i < nb; i++) {
    const o = i * 6;
    if (e.x + hw <= boxes[o] + 1e-9 || e.x - hw >= boxes[o + 3] - 1e-9 || e.z + hw <= boxes[o + 2] + 1e-9 || e.z - hw >= boxes[o + 5] - 1e-9) continue;
    if (dy > 0 && boxes[o + 1] >= e.y + e.h - 1e-7) dy = Math.min(dy, boxes[o + 1] - (e.y + e.h));
    else if (dy < 0 && boxes[o + 4] <= e.y + 1e-7) dy = Math.max(dy, boxes[o + 4] - e.y);
  }
  e.y += dy;
  const hitY = dy !== oy;
  const wasGround = !!e.onGround;
  const slide = (axis, d) => {
    for (let i = 0; i < nb; i++) {
      const o = i * 6;
      if (e.y + e.h <= boxes[o + 1] + 1e-9 || e.y >= boxes[o + 4] - 1e-9) continue;
      if (axis === 0) {
        if (e.z + hw <= boxes[o + 2] + 1e-9 || e.z - hw >= boxes[o + 5] - 1e-9) continue;
        if (d > 0 && boxes[o] >= e.x + hw - 1e-7) d = Math.min(d, boxes[o] - (e.x + hw));
        else if (d < 0 && boxes[o + 3] <= e.x - hw + 1e-7) d = Math.max(d, boxes[o + 3] - (e.x - hw));
      } else {
        if (e.x + hw <= boxes[o] + 1e-9 || e.x - hw >= boxes[o + 3] - 1e-9) continue;
        if (d > 0 && boxes[o + 2] >= e.z + hw - 1e-7) d = Math.min(d, boxes[o + 2] - (e.z + hw));
        else if (d < 0 && boxes[o + 5] <= e.z - hw + 1e-7) d = Math.max(d, boxes[o + 5] - (e.z - hw));
      }
    }
    return d;
  };
  if (opts.sneakEdge && (wasGround || hitY)) {
    const supported = (tx, tz) => {
      gather(world, tx - hw, e.y - 0.6, tz - hw, tx + hw, e.y + 0.01, tz + hw);
      for (let i = 0; i < nb; i++) { const o = i * 6; if (boxes[o + 4] <= e.y + 1e-6 && boxes[o + 4] >= e.y - 0.6) return true; }
      return false;
    };
    while (dx !== 0 && !supported(e.x + dx, e.z)) dx = Math.abs(dx) < 0.05 ? 0 : dx - Math.sign(dx) * 0.05;
    while (dz !== 0 && !supported(e.x, e.z + dz)) dz = Math.abs(dz) < 0.05 ? 0 : dz - Math.sign(dz) * 0.05;
    gather(world, e.x - hw + Math.min(0, dx) - 0.001, e.y - 0.001, e.z - hw + Math.min(0, dz) - 0.001, e.x + hw + Math.max(0, dx) + 0.001, e.y + e.h + step + 0.001, e.z + hw + Math.max(0, dz) + 0.001);
  }
  const sx = e.x, sz = e.z;
  let mx = slide(0, dx); e.x += mx;
  let mz = slide(1, dz); e.z += mz;
  let hitX = mx !== dx, hitZ = mz !== dz;
  if (step > 0 && (wasGround || (hitY && oy < 0)) && (hitX || hitZ)) {
    const bx = e.x, bz = e.z, by = e.y;
    e.x = sx; e.z = sz;
    gather(world, e.x - hw - 0.001 + Math.min(0, dx), e.y, e.z - hw - 0.001 + Math.min(0, dz), e.x + hw + 0.001 + Math.max(0, dx), e.y + e.h + step + 0.001, e.z + hw + 0.001 + Math.max(0, dz));
    let up = step;
    for (let i = 0; i < nb; i++) {
      const o = i * 6;
      if (e.x + hw <= boxes[o] + 1e-9 || e.x - hw >= boxes[o + 3] - 1e-9 || e.z + hw <= boxes[o + 2] + 1e-9 || e.z - hw >= boxes[o + 5] - 1e-9) continue;
      if (boxes[o + 1] >= e.y + e.h - 1e-7) up = Math.min(up, boxes[o + 1] - (e.y + e.h));
    }
    e.y += up;
    const mx2 = slide(0, dx); e.x += mx2;
    const mz2 = slide(1, dz); e.z += mz2;
    let down = -up;
    for (let i = 0; i < nb; i++) {
      const o = i * 6;
      if (e.x + hw <= boxes[o] + 1e-9 || e.x - hw >= boxes[o + 3] - 1e-9 || e.z + hw <= boxes[o + 2] + 1e-9 || e.z - hw >= boxes[o + 5] - 1e-9) continue;
      if (boxes[o + 4] <= e.y + 1e-7) down = Math.max(down, boxes[o + 4] - e.y);
    }
    e.y += down;
    if (mx2 * mx2 + mz2 * mz2 > mx * mx + mz * mz + 1e-9) { mx = mx2; mz = mz2; hitX = mx !== dx; hitZ = mz !== dz; }
    else { e.x = bx; e.z = bz; e.y = by; }
  }
  e.hitX = hitX; e.hitZ = hitZ; e.hitY = hitY;
  e.onGround = hitY && oy < 0;
  e.hitCeil = hitY && oy > 0;
  return e;
}

export function boxIntersects(world, x, y, z, w, h) {
  const hw = w / 2;
  gather(world, x - hw, y, z - hw, x + hw, y + h, z + hw);
  for (let i = 0; i < nb; i++) {
    const o = i * 6;
    if (x + hw > boxes[o] + 1e-6 && x - hw < boxes[o + 3] - 1e-6 && y + h > boxes[o + 1] + 1e-6 && y < boxes[o + 4] - 1e-6 && z + hw > boxes[o + 2] + 1e-6 && z - hw < boxes[o + 5] - 1e-6) return true;
  }
  return false;
}
