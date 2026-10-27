// Базовая сущность и менеджер сущностей
import * as THREE from 'three';

export class Entity {
  constructor(type) {
    this.type = type; this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0;
    this.w = 0.6; this.h = 1.8; this.dead = false; this.mesh = null; this.onGround = false; this.age = 0;
    this.id = Entity.nextId++;
  }
  update(dt, g) {}
  dispose(g) { if (this.mesh) { g.entities.group.remove(this.mesh); this.mesh.traverse?.((o) => { if (o.geometry && o.userData.own) o.geometry.dispose(); }); } }
}
Entity.nextId = 1;

export class EntityManager {
  constructor(game) {
    this.g = game; this.list = []; this.group = new THREE.Group(); game.scene.add(this.group);
  }
  add(e) { this.list.push(e); if (e.mesh) this.group.add(e.mesh); return e; }
  count() { return this.list.length; }
  mobCount() { let n = 0; for (const e of this.list) if (e.isMob) n++; return n; }
  update(dt) {
    const g = this.g;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      e.update(dt, g);
      if (e.dead) { e.dispose(g); this.list.splice(i, 1); }
    }
  }
  clear() { for (const e of this.list) e.dispose(this.g); this.list.length = 0; }
  // ближайший моб на луче: возвращает {e, t}
  raycast(ox, oy, oz, dx, dy, dz, maxD, filter) {
    let best = null, bt = maxD;
    for (const e of this.list) {
      if (!e.isMob || e.dead || (filter && !filter(e))) continue;
      const hw = e.w / 2 + 0.05;
      const lo = [e.x - hw, e.y, e.z - hw], hi = [e.x + hw, e.y + e.h, e.z + hw], o = [ox, oy, oz], d = [dx, dy, dz];
      let tmin = 0, tmax = bt, ok = true;
      for (let a = 0; a < 3 && ok; a++) {
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) ok = false; continue; }
        let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
        if (tmin > tmax) ok = false;
      }
      if (ok && tmin < bt) { bt = tmin; best = e; }
    }
    return best ? { e: best, t: bt } : null;
  }
  inRadius(x, y, z, r, pred) {
    const out = [], r2 = r * r;
    for (const e of this.list) { if (e.dead) continue; if (pred && !pred(e)) continue; const dx = e.x - x, dy = e.y + e.h / 2 - y, dz = e.z - z; if (dx * dx + dy * dy + dz * dz <= r2) out.push(e); }
    return out;
  }
}
