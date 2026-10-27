// Выживание: здоровье, голод/насыщение, кислород, урон, смерть
import { BLOCKS, B, isLava } from '../world/blocks.js';
import { getItem } from './items.js';
import { clamp } from '../core/math.js';

export class Survival {
  constructor(game) {
    this.g = game; this.reset();
  }
  reset() {
    this.health = 20; this.food = 20; this.sat = 5; this.exh = 0; this.air = 300; this.regenT = 0; this.starveT = 0;
    this.invuln = 0; this.hurtT = 0; this.burn = 0; this.dead = false; this.lavaT = 0; this.drownT = 0; this.cactusT = 0; this.voidT = 0;
    this.lastCause = '';
  }
  get armorPoints() { let a = 0; for (const s of this.g.inventory.armor) if (s) { const it = getItem(s.id); if (it && it.armor) a += it.armor.defense; } return a; }
  addExhaustion(v) { this.exh += v; }
  eat(food, sat) { this.food = Math.min(20, this.food + food); this.sat = Math.min(this.food, this.sat + sat); }
  heal(n) { this.health = Math.min(20, this.health + n); }
  // источник: строка; kb: {x,z} направление отбрасывания
  damage(amount, cause, kb, ignoreArmor) {
    const g = this.g, p = g.player;
    if (this.dead || p.creative || amount <= 0) return false;
    if (this.invuln > 0 && amount <= this.lastAmount) return false;
    let a = amount;
    if (!ignoreArmor) {
      a = amount * (1 - clamp(this.armorPoints, 0, 20) / 25);
      // износ брони
      g.inventory.armor.forEach((s, i) => { if (!s) return; const it = getItem(s.id); s.dmg = (s.dmg || 0) + 1; if (s.dmg >= it.dur) { g.inventory.armor[i] = null; g.sfx?.play('break_tool'); } });
    }
    this.lastAmount = amount;
    this.health -= a; this.invuln = 0.5; this.hurtT = 0.45; this.lastCause = cause || '';
    this.addExhaustion(0.3);
    g.sfx?.play('hurt', null, 1);
    if (kb) { p.vx += kb.x * 5; p.vz += kb.z * 5; p.vy = Math.max(p.vy, 4.5); p.onGround = false; }
    g.onHurt?.(a);
    if (this.health <= 0) { this.health = 0; this.die(cause); }
    return true;
  }
  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.g.onDeath?.(cause);
  }
  update(dt) {
    const g = this.g, p = g.player, w = g.world;
    p.food = this.food;
    if (this.dead) return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (p.creative) { this.health = 20; this.food = 20; this.air = 300; this.burn = 0; return; }
    // движение -> усталость
    if (p.onGround && p.moving) this.addExhaustion((p.sprinting ? 0.1 : 0.0) * Math.hypot(p.vx, p.vz) * dt * 0.5);
    if (p.jumped) { this.addExhaustion(p.sprinting ? 0.2 : 0.05); p.jumped = false; }
    if (this.exh >= 4) { this.exh -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else if (this.food > 0) this.food--; }
    // регенерация
    if (this.food >= 18 && this.health < 20) {
      this.regenT += dt;
      const need = (this.food >= 20 && this.sat > 0) ? 0.5 : 4;
      if (this.regenT >= need) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.addExhaustion(need < 1 ? 1.5 : 6); }
    } else this.regenT = 0;
    if (this.food <= 0) { this.starveT += dt; if (this.starveT >= 4) { this.starveT = 0; if (this.health > 1) this.damage(1, 'голод', null, true); } } else this.starveT = 0;
    // падение
    if (p.landed > 0) {
      if (p.landed > 3 && !p.inWater) { const dmg = Math.floor(p.landed - 3); if (dmg > 0) { this.damage(dmg, 'падение', null, true); g.sfx?.play('hurt'); } }
      else if (p.landed > 1.5 && !p.inWater) g.sfx?.play('step:' + g.soundUnder(), { x: p.x, y: p.y, z: p.z }, 1.2);
      p.landed = 0;
    }
    // кислород
    if (p.headInWater) {
      this.air -= dt * 20;
      if (this.air <= 0) { this.drownT += dt; if (this.drownT >= 1) { this.drownT = 0; this.damage(2, 'утонул', null, true); } }
    } else { this.air = Math.min(300, this.air + dt * 80); this.drownT = 0; }
    // лава и огонь
    if (p.inLava) { this.lavaT += dt; this.burn = 6; if (this.lavaT >= 0.5) { this.lavaT = 0; this.damage(3, 'лава', null, true); } }
    if (this.burn > 0) {
      if (p.inWater) this.burn = 0;
      else { this.burn -= dt; this.fireT = (this.fireT || 0) + dt; if (this.fireT >= 1) { this.fireT = 0; this.damage(1, 'огонь', null, true); } }
    }
    // кактус
    this.cactusT -= dt;
    if (this.cactusT <= 0) {
      for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) {
        for (const dy of [0.2, 1.0]) if (w.getBlock(Math.floor(p.x + dx), Math.floor(p.y + dy), Math.floor(p.z + dz)) === B.cactus) { this.cactusT = 0.5; this.damage(1, 'кактус', null, true); break; }
        if (this.cactusT > 0) break;
      }
    }
    if (p.voidDamage) { this.voidT += dt; if (this.voidT > 0.5) { this.voidT = 0; this.damage(4, 'пустота', null, true); } p.voidDamage = false; }
  }
  serialize() { return { health: this.health, food: this.food, sat: this.sat, exh: this.exh, air: this.air }; }
  load(d) { if (d) Object.assign(this, { health: d.health, food: d.food, sat: d.sat, exh: d.exh, air: d.air }); }
}
