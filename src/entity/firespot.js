// Очаг пожара для миссии «Пожар!»: огонь и дым из частиц, тушится тапами (пожарной машинкой — сразу)
import { Entity } from './entity.js';

export class FireSpot extends Entity {
  constructor(g, x, y, z, questId) {
    super('fire');
    this.clickable = true; this.x = x; this.y = y; this.z = z; this.w = 1.4; this.h = 1.4;
    this.hp = 3; this.questId = questId; this.pt = 0; this.st = 0;
  }
  // тап / удар — полить водой
  douse(g) {
    const fireCar = g.entities.list.some((e) => e.type === 'carbot' && !e.dead && e.style === 'fire' && Math.hypot(e.x - this.x, e.z - this.z) < 10);
    this.hp -= fireCar ? 3 : 1;
    g.particles?.splash(this.x, this.y + 0.8, this.z, 16, 4);
    g.sfx?.play('splash', { x: this.x, y: this.y, z: this.z }, 1);
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      for (let i = 0; i < 14; i++) g.particles?.smoke(this.x + (Math.random() - 0.5), this.y + Math.random(), this.z + (Math.random() - 0.5), 0.95, 0.35, 2.2);
      g.sfx?.play('fuse', { x: this.x, y: this.y, z: this.z }, 0.8);
      g.onFireOut?.(this);
    }
    return true;
  }
  interact(g) { return this.douse(g); }
  hurt() { this.douse(this.g); }
  update(dt, g) {
    this.g = g;
    const s = this.hp / 3;
    this.pt -= dt;
    if (this.pt <= 0) {
      this.pt = 0.03;
      // крупные языки пламени: снизу жёлто-оранжевые, гаснут красными
      const n = 1 + Math.round(2 * s);
      for (let k = 0; k < n; k++) {
        const r = Math.random();
        g.particles?.spawn(this.x + (Math.random() - 0.5) * 1.6, this.y + 0.1 + Math.random() * 0.3, this.z + (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 0.4, 1.8 + Math.random() * 1.6, (Math.random() - 0.5) * 0.4, 0.55 + Math.random() * 0.35, (0.45 + Math.random() * 0.4) * (0.5 + 0.5 * s), -1.5,
          1, 0.35 + r * 0.5, 0.05 + r * 0.1, 0.95, null, { grow: -0.25, drag: 0.5 });
      }
      g.particles?.flame(this.x + (Math.random() - 0.5) * 1.4, this.y + Math.random() * 0.6, this.z + (Math.random() - 0.5) * 1.4);
    }
    this.st -= dt;
    if (this.st <= 0) { this.st = 0.12; g.particles?.smoke(this.x + (Math.random() - 0.5), this.y + 1.6, this.z + (Math.random() - 0.5), 0.2, 0.7, 3.5); }
    if (Math.random() < dt * 1.5) g.sfx?.play('fuse', { x: this.x, y: this.y, z: this.z }, 0.25);
  }
}
