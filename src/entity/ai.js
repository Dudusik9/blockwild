// ИИ: A* по сетке (до 16 блоков), проверка видимости
import { SOLID, FAMILY, BLOCKS } from '../world/blocks.js';

const free = (w, x, y, z) => { const b = w.getBlock(x, y, z); return !SOLID[b] || b === 0; };
const floorOk = (w, x, y, z) => { const b = w.getBlock(x, y, z); return SOLID[b] === 1 || FAMILY[b] === 1; };

// возвращает массив точек [{x,y,z}] (центры клеток) или null
export function findPath(w, sx, sy, sz, gx, gy, gz, maxNodes = 500) {
  sx = Math.floor(sx); sy = Math.floor(sy); sz = Math.floor(sz); gx = Math.floor(gx); gy = Math.floor(gy); gz = Math.floor(gz);
  const key = (x, y, z) => ((x + 4096) * 8192 + (z + 4096)) * 512 + y;
  const open = [{ x: sx, y: sy, z: sz, g: 0, f: 0, p: null }];
  const best = new Map([[key(sx, sy, sz), 0]]);
  let nodes = 0, bestNode = open[0], bestH = 1e9;
  const H = (x, y, z) => Math.abs(x - gx) + Math.abs(z - gz) + Math.abs(y - gy);
  while (open.length && nodes < maxNodes) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const n = open[bi]; open[bi] = open[open.length - 1]; open.pop(); nodes++;
    const h = H(n.x, n.y, n.z);
    if (h < bestH) { bestH = h; bestNode = n; }
    if (Math.abs(n.x - gx) + Math.abs(n.z - gz) <= 1 && Math.abs(n.y - gy) <= 1) { bestNode = n; break; }
    if (Math.abs(n.x - sx) > 16 || Math.abs(n.z - sz) > 16) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = n.x + dx, z = n.z + dz;
      for (const dy of [0, 1, -1, -2, -3]) {
        const y = n.y + dy;
        if (y < 1) continue;
        if (!free(w, x, y, z) || !free(w, x, y + 1, z) || FAMILY[w.getBlock(x, y, z)] === 2) continue;
        if (dy === 1 && !free(w, n.x, n.y + 2, n.z)) continue;
        if (dy < 0 && !(free(w, x, n.y + 1, z))) continue;
        if (!floorOk(w, x, y - 1, z)) { if (dy === 0 || dy === 1) continue; else continue; }
        const g = n.g + 1 + (dy !== 0 ? 0.5 : 0);
        const k = key(x, y, z);
        if (best.has(k) && best.get(k) <= g) continue;
        best.set(k, g);
        open.push({ x, y, z, g, f: g + H(x, y, z), p: n });
        break;
      }
    }
  }
  if (bestNode === open[0] && bestH > 1e8) return null;
  const path = []; for (let n = bestNode; n; n = n.p) path.push({ x: n.x + 0.5, y: n.y, z: n.z + 0.5 });
  path.reverse(); path.shift();
  return path.length ? path : null;
}

export function canSee(w, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz), n = Math.ceil(d * 2);
  for (let i = 1; i < n; i++) {
    const t = i / n, id = w.getBlock(Math.floor(ax + dx * t), Math.floor(ay + dy * t), Math.floor(az + dz * t));
    if (id && SOLID[id] && BLOCKS[id].opaque) return false;
  }
  return true;
}
