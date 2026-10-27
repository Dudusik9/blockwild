// Жидкости: растекание воды/лавы (уровни 1–7, источники), вода+лава -> камень/обсидиан-аналог
import { B, BLOCKS, FAMILY, LIQ, SOLID, OPAQUE } from './blocks.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Fluids {
  constructor(game) {
    this.g = game; this.q = [new Set(), new Set(), new Set()]; this.t = [0, 0, 0];
  }
  notify(x, y, z) {
    const w = this.g.world;
    const add = (a, b, c) => { const f = FAMILY[w.getBlock(a, b, c)]; if (f) this.q[f].add(a + ',' + b + ',' + c); };
    add(x, y, z); add(x + 1, y, z); add(x - 1, y, z); add(x, y, z + 1); add(x, y, z - 1); add(x, y + 1, z); add(x, y - 1, z);
  }
  update(dt) {
    for (let f = 1; f <= 2; f++) {
      this.t[f] -= dt;
      if (this.t[f] > 0) continue;
      this.t[f] = f === 1 ? 0.22 : 1.2;
      const q = this.q[f]; if (!q.size) continue;
      const list = [...q]; q.clear();
      let n = 0;
      for (const k of list) {
        if (n++ > 500) { q.add(k); continue; }
        const [x, y, z] = k.split(',').map(Number);
        if (!this.g.world.isLoaded(x, z)) continue;
        this.tickCell(x, y, z);
      }
    }
  }
  repl(id, fam) { return id === 0 || (BLOCKS[id].replaceable && !FAMILY[id]); }
  set(x, y, z, fam, lvl) {
    const w = this.g.world;
    const old = w.getBlock(x, y, z);
    if (this.repl(old, fam) || (FAMILY[old] === fam)) { if (old && !FAMILY[old]) this.g.particles?.breakBlock(x, y, z, old); this.g.setBlock(x, y, z, (fam === 1 ? B.water_0 : B.lava_0) + lvl, { fluid: true }); return true; }
    return false;
  }
  react(x, y, z, lavaId) { // лава встретила воду
    const lvl = LIQ[lavaId];
    this.g.setBlock(x, y, z, lvl === 0 ? B.volcanic : B.cobble, { fluid: true });
    this.g.sfx?.play('fuse', { x, y, z }, 0.8);
    this.g.particles?.smoke(x + 0.5, y + 1, z + 0.5, 0.6);
  }
  tickCell(x, y, z) {
    const g = this.g, w = g.world;
    const id = w.getBlock(x, y, z); const fam = FAMILY[id];
    if (!fam) return;
    let lvl = LIQ[id];
    const base = fam === 1 ? B.water_0 : B.lava_0;
    const maxSpread = fam === 1 ? 7 : 3;
    // лава рядом с водой
    if (fam === 2) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
        if (FAMILY[w.getBlock(x + dx, y + dy, z + dz)] === 1) { this.react(x, y, z, id); return; }
      }
    }
    if (lvl !== 0) {
      const above = w.getBlock(x, y + 1, z);
      let nl = null;
      if (FAMILY[above] === fam) nl = 8;
      else {
        let best = 99, src = 0;
        for (const [dx, dz] of DIRS) {
          const nid = w.getBlock(x + dx, y, z + dz);
          if (FAMILY[nid] !== fam) continue;
          const l = LIQ[nid];
          const nb = w.getBlock(x + dx, y - 1, z + dz);
          const feeds = l === 0 || !(this.repl(nb, fam));
          if (!feeds) continue;
          const eff = l === 8 ? 0 : l;
          if (eff + 1 < best) best = eff + 1;
          if (l === 0) src++;
        }
        if (best <= maxSpread) nl = best;
        if (fam === 1 && src >= 2) { const b = w.getBlock(x, y - 1, z); if (SOLID[b] || (FAMILY[b] === 1 && LIQ[b] === 0)) nl = 0; }
      }
      if (nl === null) { g.setBlock(x, y, z, 0, { fluid: true }); return; }
      if (nl !== lvl) { g.setBlock(x, y, z, base + nl, { fluid: true }); lvl = nl; }
    }
    // вниз
    const below = w.getBlock(x, y - 1, z);
    if (y > 0) {
      if (FAMILY[below] && FAMILY[below] !== fam) {
        if (fam === 1) this.react(x, y - 1, z, below); else this.react(x, y - 1, z, id);
        return;
      }
      if (this.repl(below, fam)) { this.set(x, y - 1, z, fam, 8); return; }
      if (FAMILY[below] === fam && LIQ[below] !== 0 && LIQ[below] !== 8) { g.setBlock(x, y - 1, z, base + 8, { fluid: true }); }
      if (FAMILY[below] === fam && LIQ[below] === 8) { /* поток уже идёт */ }
    }
    const solidBelow = !(this.repl(below, fam) || (FAMILY[below] === fam && LIQ[below] === 8));
    if (!solidBelow) return;
    const eff = lvl === 8 ? 0 : lvl;
    if (eff >= maxSpread) return;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz, nid = w.getBlock(nx, y, nz);
      if (FAMILY[nid] && FAMILY[nid] !== fam) {
        // встреча жидкостей
        if (fam === 1) this.react(nx, y, nz, nid); else this.react(x, y, z, id);
        continue;
      }
      if (this.repl(nid, fam)) this.set(nx, y, nz, fam, eff + 1);
      else if (FAMILY[nid] === fam && LIQ[nid] > eff + 1 && LIQ[nid] !== 8) g.setBlock(nx, y, nz, base + eff + 1, { fluid: true });
    }
  }
}
