// DDA-рейкаст по блокам с проверкой точных боксов
import { selectBoxes } from '../world/shapes.js';
import { isLiquid } from '../world/blocks.js';

const res = { hit: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, id: 0, dist: 0, boxes: null, _axis: -1 };

// пересечение луча с боксом; возвращает t или -1, ось входа в res._axis
function rayBox(ox, oy, oz, dx, dy, dz, b, bx, by, bz, maxT) {
  let tmin = 0, tmax = maxT, n = -1;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [bx + b[0], by + b[1], bz + b[2]], hi = [bx + b[3], by + b[4], bz + b[5]];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < lo[a] || o[a] > hi[a]) return -1; continue; }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) { tmin = t1; n = a; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  res._axis = n;
  return tmin;
}

export function raycast(world, ox, oy, oz, dx, dy, dz, maxDist, liquids) {
  maxDist = maxDist || 5;
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
  let tmx = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tdx) : 1e30;
  let tmy = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tdy) : 1e30;
  let tmz = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tdz) : 1e30;
  let ax = -1, t = 0;
  res.hit = false;
  const setN = (a) => { res.nx = a === 0 ? -sx : 0; res.ny = a === 1 ? -sy : 0; res.nz = a === 2 ? -sz : 0; };
  for (let i = 0; i < 200; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== 0) {
      if (liquids && isLiquid(id)) { res.hit = true; res.x = x; res.y = y; res.z = z; res.id = id; res.dist = t; res.boxes = null; setN(ax); return res; }
      const bs = selectBoxes(world, id, x, y, z);
      if (bs) {
        let best = 1e30, bestAx = ax;
        for (const b of bs) {
          const tt = rayBox(ox, oy, oz, dx, dy, dz, b, x, y, z, maxDist);
          if (tt >= 0 && tt < best) { best = tt; bestAx = (tt === 0 && ax >= 0) ? ax : res._axis; }
        }
        if (best <= maxDist && best < 1e29) {
          res.hit = true; res.x = x; res.y = y; res.z = z; res.id = id; res.dist = best; res.boxes = bs;
          setN(bestAx);
          return res;
        }
      }
    }
    if (tmx < tmy && tmx < tmz) { t = tmx; if (t > maxDist) break; x += sx; tmx += tdx; ax = 0; }
    else if (tmy < tmz) { t = tmy; if (t > maxDist) break; y += sy; tmy += tdy; ax = 1; }
    else { t = tmz; if (t > maxDist) break; z += sz; tmz += tdz; ax = 2; }
    if (y < -2 || y > 300) break;
  }
  return res;
}
