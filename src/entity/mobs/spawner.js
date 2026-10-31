// Спавн/деспавн мобов по свету и биому
import { Mob, MOB_KINDS } from './mobs.js';
import { B, SOLID, OPAQUE, isLiquid } from '../../world/blocks.js';
import { BIOME } from '../../world/biomes.js';
import { hash2 } from '../../core/noise.js';

const PASSIVE = { ram: [BIOME.MEADOW, BIOME.BIRCH, BIOME.MOUNTAINS, BIOME.TAIGA], hen: [BIOME.MEADOW, BIOME.SAVANNA, BIOME.BIRCH], boar: [BIOME.TAIGA, BIOME.BIRCH, BIOME.SWAMP, BIOME.MEADOW],
  kitten: [BIOME.MEADOW, BIOME.BIRCH], puppy: [BIOME.MEADOW, BIOME.TAIGA, BIOME.SAVANNA] };
const hostile = (e) => e.def.ai !== 'passive' && e.def.ai !== 'pet';
const HOSTILE = { swamper: [BIOME.SWAMP, BIOME.BIRCH, BIOME.TAIGA, BIOME.MEADOW, BIOME.TUNDRA], archer: [BIOME.MEADOW, BIOME.DESERT, BIOME.SAVANNA, BIOME.MOUNTAINS, BIOME.TUNDRA, BIOME.TAIGA], bomber: null };

export class MobManager {
  constructor(game) {
    this.g = game; this.t = 0; this.kinds = {}; for (const k of MOB_KINDS) this.kinds[k] = true;
    this.popDone = new Set(); this.enabled = true;
  }
  spawnMob(kind, x, y, z, variant) { const m = new Mob(this.g, kind, x, y, z, variant); this.g.entities.add(m); return m; }
  counts() { let pa = 0, ho = 0; for (const e of this.g.entities.list) if (e.isMob && !e.tamed) { if (hostile(e)) ho++; else pa++; } return { pa, ho }; }
  // начальное население при появлении чанка
  onChunk(c) {
    if (!this.enabled) return;
    const k = c.cx + ',' + c.cz; if (this.popDone.has(k)) return; this.popDone.add(k);
    if (hash2(c.cx, c.cz, this.g.meta.seed + 31) > 0.16) return;
    const lx = (hash2(c.cx, c.cz, 5) * 16) | 0, lz = (hash2(c.cx, c.cz, 6) * 16) | 0;
    const h = c.heights[(lz << 4) | lx], bi = c.biomes[(lz << 4) | lx];
    const kinds = Object.keys(PASSIVE).filter((q) => PASSIVE[q].includes(bi));
    if (!kinds.length) return;
    const kind = kinds[(hash2(c.cx, c.cz, 9) * kinds.length) | 0];
    const top = c.blocks[(h << 8) | (lz << 4) | lx];
    if (top !== B.grass && top !== B.snow && top !== B.podzol) return;
    const n = 2 + ((hash2(c.cx, c.cz, 11) * 3) | 0);
    for (let i = 0; i < n; i++) this.spawnMob(kind, c.cx * 16 + lx + 0.5 + (i % 2) * 1.2, h + 1.05, c.cz * 16 + lz + 0.5 + (i >> 1));
  }
  update(dt) {
    const g = this.g, p = g.player, w = g.world;
    g.pathBudget = 3;
    this.t -= dt;
    if (this.t > 0 || !this.enabled) { this.despawn(dt); return; }
    this.t = 1.2;
    const { pa, ho } = this.counts();
    for (let attempt = 0; attempt < 3; attempt++) {
      const a = Math.random() * 6.283, d = 22 + Math.random() * 26;
      const x = Math.floor(p.x + Math.cos(a) * d), z = Math.floor(p.z + Math.sin(a) * d);
      const c = w.getChunk(x >> 4, z >> 4); if (!c || c.meshState !== 2) continue;
      // для пещер — случайная высота под игроком, иначе поверхность
      let y;
      if (Math.random() < 0.45) { y = Math.floor(p.y) + ((Math.random() * 24) | 0) - 14; }
      else y = c.heights[((z & 15) << 4) | (x & 15)] + 1;
      if (y < 2) continue;
      // подобрать пол
      while (y > 2 && !SOLID[w.getBlock(x, y - 1, z)]) y--;
      if (w.getBlock(x, y, z) !== 0 || w.getBlock(x, y + 1, z) !== 0 || !SOLID[w.getBlock(x, y - 1, z)] || isLiquid(w.getBlock(x, y - 1, z))) continue;
      const l = w.getLight(x, y, z), sun = (l >> 4) * g.sky.daylight, eff = Math.max(sun, l & 15);
      const bi = w.getBiome(x, z), ground = w.getBlock(x, y - 1, z);
      if (Math.hypot(x - p.x, z - p.z) < 16 && Math.abs(y - p.y) < 8) continue;
      if (eff <= 7 && ho < 14) {
        const opts = Object.keys(HOSTILE).filter((k) => !HOSTILE[k] || HOSTILE[k].includes(bi));
        if (y < c.heights[((z & 15) << 4) | (x & 15)] - 4 || g.sky.daylight < 0.3 || Math.random() < 0.3) {
          const kind = opts[(Math.random() * opts.length) | 0];
          const n = kind === 'bomber' ? 1 : 1 + ((Math.random() * 2) | 0);
          for (let i = 0; i < n; i++) this.spawnMob(kind, x + 0.5 + i * 0.7, y + 0.05, z + 0.5);
          break;
        }
      } else if (eff >= 9 && pa < 14 && g.sky.daylight > 0.4 && (ground === B.grass || ground === B.snow || ground === B.podzol) && Math.random() < 0.25) {
        const opts = Object.keys(PASSIVE).filter((k) => PASSIVE[k].includes(bi));
        if (!opts.length) continue;
        const kind = opts[(Math.random() * opts.length) | 0], n = 2 + ((Math.random() * 2) | 0);
        for (let i = 0; i < n; i++) this.spawnMob(kind, x + 0.5 + i * 0.8, y + 0.05, z + 0.5);
        break;
      }
    }
    this.despawn(dt);
  }
  despawn(dt) {
    const g = this.g, p = g.player;
    for (const e of g.entities.list) {
      if (!e.isMob || e.dead || e.noDespawn) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > 90) { e.dead = true; continue; }
      if (hostile(e) && d > 36 && e.age > 20 && Math.random() < dt * 0.05) e.dead = true;
      if (hostile(e) && !e.def.burn && e.age > 40 && !e.target && g.sky.daylight > 0.9 && (g.world.getLight(Math.floor(e.x), Math.floor(e.y + 1), Math.floor(e.z)) >> 4) >= 14 && Math.random() < dt * 0.05) e.dead = true;
    }
  }
  serialize() {
    const g = this.g, p = g.player, out = [];
    for (const e of g.entities.list) {
      if (!e.isMob || e.dead || e.deathT !== 0 || (Math.hypot(e.x - p.x, e.z - p.z) >= 64 && !e.noDespawn)) continue;
      const m = { k: e.kind, x: e.x, y: e.y, z: e.z, hp: e.hp, sh: e.sheared, w: e.wool };
      if (e.def.variants) Object.assign(m, { v: e.variant, tm: e.tamed, st: e.sitting, lo: e.lost, nd: e.noDespawn, q: e.questId });
      out.push(m);
    }
    for (const e of g.entities.list) if (e.type === 'carbot' && !e.dead) out.push(e.serialize());
    return { mobs: out, pop: [...this.popDone] };
  }
  load(d) {
    if (!d) return;
    this.popDone = new Set(d.pop || []);
    for (const m of d.mobs || []) {
      if (m.k === 'carbot') { this.g.spawnCarbot(m.x, m.y, m.z, m.yaw, m.c, m.robot, m.kind || 'car'); continue; }
      if (!this.kinds[m.k]) continue;
      const e = this.spawnMob(m.k, m.x, m.y, m.z, m.v); e.hp = m.hp; e.sheared = !!m.sh; if (m.w) e.wool = m.w;
      if (m.tm) { e.tamed = true; e.noDespawn = true; } e.sitting = !!m.st; e.lost = !!m.lo; if (m.nd) e.noDespawn = true; if (m.q) e.questId = m.q;
    }
  }
}
