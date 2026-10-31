// Действия над миром (подмешиваются в Game): установка/ломание блоков, выпадение предметов, взрывы
import { B, BLOCKS, SHAPE, isLiquid, FAMILY, OPAQUE } from '../world/blocks.js';
import { I, ITEMS, getItem } from './items.js';
import { newChest, newFurnace } from './furnace.js';
import { ItemDrop, FallingBlock } from '../entity/items-drop.js';
import { PrimedKeg } from '../entity/primed.js';
import { BIOMES } from '../world/biomes.js';

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export const actions = {
  setBlock(x, y, z, id, opts) { return this.world.setBlock(x, y, z, id, opts || {}); },

  onBlockChange(x, y, z, old, nu, opts) {
    if (this.ticker) this.ticker.onBlockChange(x, y, z, old, nu);
    const k = x + ',' + y + ',' + z;
    const nb = BLOCKS[nu].name;
    if (nb.startsWith('furnace') && !this.world.be.has(k)) this.world.be.set(k, newFurnace(x, y, z));
    else if (nb.startsWith('chest') && !this.world.be.has(k)) this.world.be.set(k, newChest(x, y, z));
  },

  computeDrops(b, tool) {
    const out = [];
    const tdef = tool ? getItem(tool.id) : null;
    const td = tdef && tdef.tool ? tdef.tool : null;
    const harvest = !b.needsTool || (td && td.kind === b.tool && td.tier >= b.tier);
    if (!harvest) return out;
    if (b.tool === 'shears' && td && td.kind === 'shears') { out.push({ id: I[b.item], count: 1 }); return out; }
    const d = b.drops;
    const push = (name, n) => { if (I[name] !== undefined && n > 0) out.push({ id: I[name], count: n }); };
    if (d === null || d === undefined) return out;
    if (d === 'self') push(b.item, 1);
    else if (typeof d === 'string') push(d, 1);
    else if (Array.isArray(d)) { for (const e of d) if (Math.random() < (e.chance === undefined ? 1 : e.chance)) push(e.item, rand(e.min || 1, e.max || e.min || 1)); }
    else push(d.item, rand(d.min || 1, d.max || 1));
    return out;
  },

  // Ломание блока (с выпадением, частицами, звуком)
  breakBlock(x, y, z, o) {
    o = o || {};
    const w = this.world; const id = w.getBlock(x, y, z);
    if (!id) return false;
    const b = BLOCKS[id];
    if (FAMILY[id]) return false;
    const key = x + ',' + y + ',' + z;
    const be = w.be.get(key);
    let drops = [];
    const creativeBreak = this.player && this.player.creative && o.byPlayer;
    if (o.noDrops) { /* без выпадения */ }
    else if (creativeBreak) { if (I[b.item] !== undefined && b.selectable && b.hardness >= 0) drops = [{ id: I[b.item], count: 1 }]; }
    else drops = this.computeDrops(b, o.tool);
    if (o.dropChance !== undefined) drops = drops.filter(() => Math.random() < o.dropChance);
    // содержимое сундука/печи
    if (be) { for (const s of be.slots) if (s && !(this.player && this.player.creative && o.byPlayer && false)) drops.push({ id: s.id, count: s.count, dmg: s.dmg || 0 }); w.be.delete(key); }
    // дверь: убрать вторую половину
    if (b.name.startsWith('door_')) {
      const other = b.name.startsWith('door_lo') ? w.getBlock(x, y + 1, z) : w.getBlock(x, y - 1, z);
      if (BLOCKS[other].name.startsWith('door_')) this.setBlock(x, b.name.startsWith('door_lo') ? y + 1 : y - 1, z, 0);
    }
    this.setBlock(x, y, z, 0);
    if (!o.silent) {
      let tint; if (b.tint) { const bi = BIOMES[w.getBiome(x, z)]; const c = b.tint === 2 ? bi.foliage : b.tint === 1 ? bi.grass : null; if (c) tint = [c[0] / 255, c[1] / 255, c[2] / 255]; }
      this.particles?.breakBlock(x, y, z, id, Math.max(0.35, this.lightAt(x, y, z)), tint);
      this.sfx?.play('break:' + b.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, 1);
    }
    for (const d of drops) this.dropItem(x + 0.5, y + 0.3, z + 0.5, d);
    return true;
  },
  lightAt(x, y, z) { const l = this.world.getLight(x, y, z); return Math.max(((l >> 4) / 15) * this.sky.daylight, (l & 15) / 15); },

  dropItem(x, y, z, stack, vel) {
    if (!stack || stack.count <= 0) return null;
    const e = new ItemDrop(this, x, y, z, { id: stack.id, count: stack.count, dmg: stack.dmg || 0 }, vel);
    this.entities.add(e); return e;
  },
  dropFromPlayer(stack) {
    const p = this.player, d = { x: 0, y: 0, z: 0 }; p.dirVec(d);
    const e = this.dropItem(p.x + d.x * 0.4, p.y + p.eye - 0.3, p.z + d.z * 0.4, stack, [d.x * 5 + p.vx * 0.3, d.y * 5 + 1.5, d.z * 5 + p.vz * 0.3]);
    if (e) e.delay = 1.4;
  },
  spawnFalling(x, y, z, id) { this.entities.add(new FallingBlock(this, x, y, z, id)); },
  soundUnder() {
    const p = this.player; const b = this.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z));
    return b ? BLOCKS[b].sound : 'stone';
  },

  ignite(x, y, z) {
    this.setBlock(x, y, z, 0);
    this.entities.add(new PrimedKeg(this, x + 0.5, y, z + 0.5, 3.0));
  },

  explode(x, y, z, power, source) {
    const w = this.world, r = power, ri = Math.ceil(r);
    this.particles?.explosion(x, y, z, power);
    this.sfx?.play('explode', { x, y, z }, 1.2);
    this.shake = Math.max(this.shake || 0, Math.min(1, power / 5) * Math.max(0, 1 - Math.hypot(x - this.player.x, y - this.player.y, z - this.player.z) / 30));
    for (let dx = -ri; dx <= ri; dx++) for (let dy = -ri; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > r) continue;
      const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
      if (by < 1) continue;
      const id = w.getBlock(bx, by, bz);
      if (!id || FAMILY[id]) continue;
      const b = BLOCKS[id];
      if (b.hardness < 0 || b.hardness > 20) continue;
      if (d > r * (0.55 + Math.random() * 0.45) - b.hardness * 0.04) continue;
      if (id === B.keg) { this.setBlock(bx, by, bz, 0); const k = new PrimedKeg(this, bx + 0.5, by, bz + 0.5, 0.3 + Math.random() * 0.8); k.vx = (Math.random() - 0.5) * 3; k.vz = (Math.random() - 0.5) * 3; this.entities.add(k); continue; }
      this.breakBlock(bx, by, bz, { silent: true, dropChance: 0.28, noParticles: true });
    }
    // урон существам
    const hit = this.entities.inRadius(x, y, z, r * 2, (e) => e.isMob || e.type === 'item');
    for (const e of hit) {
      const dx = e.x - x, dy = e.y + e.h / 2 - y, dz = e.z - z, d = Math.hypot(dx, dy, dz) || 1;
      const f = Math.max(0, 1 - d / (r * 2));
      if (e.isMob) e.hurt(Math.ceil(f * power * 7), { x: dx / d, z: dz / d }, 'explosion');
      else { e.vx += dx / d * f * 14; e.vy += 6 * f; e.vz += dz / d * f * 14; }
    }
    const p = this.player; const dx = p.x - x, dy = p.y + 0.9 - y, dz = p.z - z, d = Math.hypot(dx, dy, dz) || 1;
    if (d < r * 2) {
      const f = 1 - d / (r * 2);
      if (!p.creative) this.survival.damage(Math.ceil(f * power * 7), 'взрыв', { x: dx / d, z: dz / d });
      p.vx += dx / d * f * 12; p.vy += f * 8; p.vz += dz / d * f * 12;
    }
  },

  setGameMode(m) {
    const p = this.player; p.mode = m; p.flying = false;
    if (this.meta) this.meta.mode = m;
    if (m === 'creative') { this.survival.health = 20; this.survival.food = 20; this.survival.dead = false; }
    this.hud?.update(0);
    if (this.hud) this.hud.statSig = '';
  },
};
