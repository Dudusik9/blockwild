// Выпавшие предметы и падающие блоки
import * as THREE from 'three';
import { Entity } from './entity.js';
import { moveEntity } from '../player/physics.js';
import { itemModel, cubeGeometry } from './models.js';
import { ITEMS, I } from '../game/items.js';
import { BLOCKS, B, SOLID, isLiquid, isWater } from '../world/blocks.js';

export function lightBrightness(world, x, y, z, daylight) {
  const l = world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
  const s = (l >> 4) / 15 * daylight, b = (l & 15) / 15;
  return Math.max(0.18, Math.pow(Math.max(s, b), 1.2));
}

export class ItemDrop extends Entity {
  constructor(g, x, y, z, stack, vel) {
    super('item');
    this.w = 0.25; this.h = 0.25; this.x = x; this.y = y; this.z = z; this.stack = stack;
    this.vx = vel ? vel[0] : (Math.random() - 0.5) * 2.2; this.vy = vel ? vel[1] : 3 + Math.random() * 1.5; this.vz = vel ? vel[2] : (Math.random() - 0.5) * 2.2;
    this.delay = 0.6; this.phase = Math.random() * 6.28; this.lt = 0;
    const m = itemModel(stack.id);
    this.flat = m.flat;
    this.mat = new THREE.MeshBasicMaterial({ map: g.entityAtlas, vertexColors: true, alphaTest: 0.5 });
    this.mesh = new THREE.Mesh(m.geo, this.mat);
    const s = m.flat ? 0.42 : 0.3; this.mesh.scale.set(s, s, s);
    this.mesh.position.set(x, y, z);
    this.gather = 0;
  }
  update(dt, g) {
    const w = g.world, p = g.player;
    if (this.age > 300) { this.dead = true; return; }
    this.delay -= dt;
    // жидкость
    const inW = isLiquid(w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z)));
    this.vy -= (inW ? -3 : 22) * dt;
    if (inW) { this.vy *= 0.9; this.vx *= 0.9; this.vz *= 0.9; if (this.vy > 1.5) this.vy = 1.5; }
    // магнит
    if (p && g.state === 'playing' && this.delay <= 0) {
      const dx = p.x - this.x, dy = p.y + 0.9 - this.y, dz = p.z - this.z, d = Math.hypot(dx, dy, dz);
      if (d < 2.4 && g.inventory.canAdd(this.stack.id, 1)) {
        const f = (1 - d / 2.4) * 28 * dt; this.vx += dx / d * f; this.vy += dy / d * f; this.vz += dz / d * f;
        if (d < 0.9) {
          const left = g.inventory.add(this.stack.id, this.stack.count, this.stack.dmg || 0);
          g.sfx?.play('pop', { x: this.x, y: this.y, z: this.z }, 0.8);
          if (left <= 0) { this.dead = true; g.onPickup?.(this.stack); return; }
          this.stack.count = left;
        }
      }
    }
    const drag = this.onGround ? Math.pow(0.0008, dt) : 1;
    this.vx *= drag; this.vz *= drag;
    moveEntity(w, this, this.vx * dt, this.vy * dt, this.vz * dt, {});
    if (this.hitY) this.vy = this.vy < -3 ? -this.vy * 0.25 : 0;
    if (this.hitX) this.vx *= -0.3; if (this.hitZ) this.vz *= -0.3;
    if (this.y < -20) this.dead = true;
    // слияние
    this.gather -= dt;
    if (this.gather <= 0) {
      this.gather = 0.6;
      for (const e of g.entities.list) {
        if (e === this || e.dead || e.type !== 'item' || e.stack.id !== this.stack.id || (e.stack.dmg || 0) !== (this.stack.dmg || 0)) continue;
        if (Math.abs(e.x - this.x) < 0.7 && Math.abs(e.z - this.z) < 0.7 && Math.abs(e.y - this.y) < 0.7 && e.stack.count + this.stack.count <= 64 && ITEMS.get(this.stack.id).stack > 1) {
          e.stack.count += this.stack.count; e.age = Math.min(e.age, this.age); this.dead = true; return;
        }
      }
    }
    // отрисовка
    this.lt -= dt;
    if (this.lt <= 0) { this.lt = 0.4; this.bright = lightBrightness(w, this.x, this.y + 0.2, this.z, g.sky.daylight); this.mat.color.setScalar(this.bright); }
    const bob = Math.sin(this.age * 2.4 + this.phase) * 0.05 + 0.13;
    this.mesh.position.set(this.x, this.y + (this.onGround ? bob : 0.1), this.z);
    this.mesh.rotation.y = this.age * 1.6 + this.phase;
  }
}

export class FallingBlock extends Entity {
  constructor(g, x, y, z, blockId) {
    super('fall');
    this.w = 0.98; this.h = 0.98; this.x = x + 0.5; this.y = y; this.z = z + 0.5; this.blockId = blockId; this.vy = 0;
    const b = BLOCKS[blockId];
    this.mat = new THREE.MeshBasicMaterial({ map: g.entityAtlas, vertexColors: true });
    this.mesh = new THREE.Mesh(cubeGeometry(b), this.mat);
    this.mesh.userData.own = true;
    this.mesh.position.set(this.x, this.y + 0.5, this.z);
    this.mat.color.setScalar(Math.max(0.3, lightBrightness(g.world, this.x, this.y, this.z, g.sky.daylight)));
  }
  update(dt, g) {
    this.vy -= 30 * dt; if (this.vy < -50) this.vy = -50;
    moveEntity(g.world, this, 0, this.vy * dt, 0, {});
    this.mesh.position.set(this.x, this.y + 0.5, this.z);
    if (this.hitY || this.y < 0) {
      this.dead = true;
      const bx = Math.floor(this.x), by = Math.round(this.y), bz = Math.floor(this.z);
      const cur = g.world.getBlock(bx, by, bz);
      if (cur === 0 || BLOCKS[cur].replaceable || isLiquid(cur)) g.setBlock(bx, by, bz, this.blockId);
      else g.dropItem(bx + 0.5, by + 0.5, bz + 0.5, { id: I[BLOCKS[this.blockId].item], count: 1, dmg: 0 });
    }
  }
}
