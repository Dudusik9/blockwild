// Тики мира: проверки опоры, падение песка/гравия, опадание листвы, случайные тики (рост, трава)
import { B, BLOCKS, SOLID, OPAQUE, FAMILY, isLiquid, isWater } from './blocks.js';
import { placeTree } from './structures.js';
import { mulberry32 } from '../core/noise.js';

const SOIL = new Set([B.grass, B.dirt, B.podzol]);
const DRY = new Set([B.grass, B.dirt, B.podzol, B.sand, B.sandstone, B.clay]);
const LOGS = new Set(['oak', 'birch', 'spruce', 'acacia', 'willow'].map((w) => B['log_' + w]));
const LEAVES = new Set(['oak', 'birch', 'spruce', 'acacia', 'willow'].map((w) => B['leaves_' + w]));

export function canExist(world, id, x, y, z) {
  const b = BLOCKS[id];
  if (!b.support) return true;
  const below = world.getBlock(x, y - 1, z);
  switch (b.support) {
    case 'soil': return SOIL.has(below) || below === B.farmland && false;
    case 'sand': return below === B.sand || (below === B.cactus);
    case 'drysoil': return DRY.has(below);
    case 'farmland': return below === B.farmland;
    case 'solid': { const bb = BLOCKS[below]; return !!bb && bb.solid && (bb.opaque || bb.shape === 2 && bb.boxes && bb.boxes[0][4] === 16) && !bb.family; }
    case 'doorTop': return BLOCKS[below].name.startsWith('door_lo');
    case 'reedbase': {
      if (below === B.reed) return true;
      if (!(below === B.sand || SOIL.has(below) || below === B.clay)) return false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isWater(world.getBlock(x + dx, y - 1, z + dz))) return true;
      return false;
    }
  }
  return true;
}
export const wood = { oak: 'oak', birch: 'birch', spruce: 'spruce', acacia: 'acacia', willow: 'willow' };

export function growTree(world, x, y, z, w, setBlock) {
  // проверка места
  const h = w === 'spruce' ? 7 : 5;
  for (let i = 1; i < h; i++) { const b = world.getBlock(x, y + i, z); if (b !== 0 && !LEAVES.has(b) && !BLOCKS[b].replaceable) return false; }
  const rnd = mulberry32((x * 73856093) ^ (z * 19349663) ^ y);
  const adapter = { get: (a, b, c) => world.getBlock(a, b, c), set: (a, b, c, id) => setBlock(a, b, c, id) };
  setBlock(x, y, z, 0);
  placeTree(adapter, w === 'oak' && rnd() < 0.08 ? 'bigoak' : w, x, y, z, rnd);
  return true;
}

export class Ticker {
  constructor(game) {
    this.g = game; this.q = []; this.randT = 0; this.set = new Set();
  }
  schedule(x, y, z, delay, kind) {
    const k = kind + ':' + x + ',' + y + ',' + z;
    if (this.set.has(k)) return;
    this.set.add(k);
    this.q.push({ t: this.g.clock + delay, x, y, z, kind, k });
  }
  onBlockChange(x, y, z, old, nu) {
    const w = this.g.world;
    this.schedule(x, y + 1, z, 0.05, 'support');
    if (BLOCKS[nu].fall) this.schedule(x, y, z, 0.1, 'fall');
    if (BLOCKS[old].fall || nu === 0) this.schedule(x, y + 1, z, 0.1, 'fall');
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      if (BLOCKS[w.getBlock(x + dx, y + dy, z + dz)].fall) this.schedule(x + dx, y + dy, z + dz, 0.1, 'fall');
    }
    if (LOGS.has(old) && !LOGS.has(nu)) {
      for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
        if (LEAVES.has(w.getBlock(x + dx, y + dy, z + dz))) this.schedule(x + dx, y + dy, z + dz, 0.4 + Math.random() * 3, 'leaf');
      }
    }
    // дверь: верх/низ
    if (this.g.fluids) this.g.fluids.notify(x, y, z);
  }
  update(dt) {
    const g = this.g, w = g.world, now = g.clock;
    let n = 0;
    for (let i = 0; i < this.q.length && n < 200;) {
      const e = this.q[i];
      if (e.t > now) { i++; continue; }
      this.q[i] = this.q[this.q.length - 1]; this.q.pop(); this.set.delete(e.k); n++;
      if (!w.isLoaded(e.x, e.z)) continue;
      this.run(e);
    }
    this.randT -= dt;
    if (this.randT <= 0 && g.player) {
      this.randT = 0.25;
      this.randomTicks();
    }
  }
  run(e) {
    const g = this.g, w = g.world;
    const id = w.getBlock(e.x, e.y, e.z);
    switch (e.kind) {
      case 'support':
        if (id !== 0 && BLOCKS[id].support && !canExist(w, id, e.x, e.y, e.z)) g.breakBlock(e.x, e.y, e.z, { natural: true });
        break;
      case 'fall': {
        if (!BLOCKS[id].fall) break;
        const below = w.getBlock(e.x, e.y - 1, e.z);
        if (e.y > 0 && (below === 0 || BLOCKS[below].replaceable || isLiquid(below))) {
          g.setBlock(e.x, e.y, e.z, 0);
          g.spawnFalling(e.x, e.y, e.z, id);
        }
        break;
      }
      case 'leaf': {
        if (!LEAVES.has(id)) break;
        if (!this.leafAlive(e.x, e.y, e.z)) g.breakBlock(e.x, e.y, e.z, { natural: true });
        break;
      }
    }
  }
  leafAlive(x, y, z) {
    const w = this.g.world;
    const seen = new Set([x + ',' + y + ',' + z]);
    let frontier = [[x, y, z]];
    for (let d = 0; d < 5; d++) {
      const next = [];
      for (const [cx, cy, cz] of frontier) {
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
          const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = nx + ',' + ny + ',' + nz;
          if (seen.has(k)) continue; seen.add(k);
          const b = w.getBlock(nx, ny, nz);
          if (LOGS.has(b)) return true;
          if (LEAVES.has(b)) next.push([nx, ny, nz]);
        }
      }
      frontier = next;
    }
    return false;
  }
  randomTicks() {
    const g = this.g, w = g.world, p = g.player;
    const pcx = Math.floor(p.x) >> 4, pcz = Math.floor(p.z) >> 4;
    const R = 4;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const c = w.getChunk(pcx + dx, pcz + dz);
      if (!c || !c.ready || c.meshState !== 2) continue;
      for (let s = 0; s < 18; s++) {
        const lx = (Math.random() * 16) | 0, lz = (Math.random() * 16) | 0;
        const h = c.heights[(lz << 4) | lx];
        const y = h + ((Math.random() * 4) | 0) - 1;
        if (y < 1 || y > 254) continue;
        const id = c.blocks[(y << 8) | (lz << 4) | lx];
        if (id === 0) continue;
        this.randomTick(c.cx * 16 + lx, y, c.cz * 16 + lz, id);
      }
    }
  }
  randomTick(x, y, z, id) {
    const g = this.g, w = g.world;
    if (id === B.grass) {
      const above = w.getBlock(x, y + 1, z);
      if (OPAQUE[above] || isLiquid(above)) { if (Math.random() < 0.25) g.setBlock(x, y, z, B.dirt); return; }
      if (Math.random() < 0.1) { // распространение на соседнюю землю
        const dx = ((Math.random() * 3) | 0) - 1, dz = ((Math.random() * 3) | 0) - 1, dy = ((Math.random() * 3) | 0) - 1;
        if (w.getBlock(x + dx, y + dy, z + dz) === B.dirt) {
          const a = w.getBlock(x + dx, y + dy + 1, z + dz);
          if (!OPAQUE[a] && !isLiquid(a) && (w.getLight(x + dx, y + dy + 1, z + dz) >> 4) >= 9) g.setBlock(x + dx, y + dy, z + dz, B.grass);
        }
      }
      return;
    }
    if (id >= B.wheat_0 && id < B.wheat_7) {
      if (!canExist(w, id, x, y, z)) return;
      const l = w.getLight(x, y, z);
      if (Math.max(l >> 4, l & 15) >= 9 && Math.random() < 0.1) g.setBlock(x, y, z, id + 1);
      return;
    }
    if (id === B.farmland) {
      const above = w.getBlock(x, y + 1, z);
      if (OPAQUE[above] || (BLOCKS[above].solid)) g.setBlock(x, y, z, B.dirt);
      return;
    }
    const sap = ['oak', 'birch', 'spruce', 'acacia', 'willow'].find((n) => B['sapling_' + n] === id);
    if (sap) {
      const l = w.getLight(x, y, z);
      if ((l >> 4) >= 9 && Math.random() < 0.025) growTree(w, x, y, z, sap, (a, b, c, i) => g.setBlock(a, b, c, i));
      return;
    }
    if (id === B.reed || id === B.cactus) {
      if (Math.random() > 0.1) return;
      let h = 1; while (w.getBlock(x, y - h, z) === id) h++;
      if (h < 3 && w.getBlock(x, y + 1, z) === 0 && canExist(w, id, x, y + 1, z)) g.setBlock(x, y + 1, z, id);
      return;
    }
    if (id === B.snow) return;
  }
}
