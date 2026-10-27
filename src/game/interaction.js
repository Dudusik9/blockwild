// Взаимодействие игрока с миром: ломание, установка, использование, атака
import { B, BLOCKS, SHAPE, isLiquid, FAMILY, SOLID } from '../world/blocks.js';
import { I, ITEMS, getItem, placeBlockOf } from './items.js';
import { boxIntersects } from '../player/physics.js';
import { canExist } from '../world/tick.js';
import { raycast } from '../player/raycast.js';
import { selectBoxes } from '../world/shapes.js';
import { newChest, newFurnace } from './furnace.js';
import { TILE_INDEX } from '../render/tilenames.js';

const SOILS = new Set([B.grass, B.dirt, B.podzol]);

export class Interaction {
  constructor(game) {
    this.g = game;
    this.mining = null; this.progress = 0; this.hitT = 0; this.cool = 0; this.placeCool = 0; this.eatT = 0; this.attackCool = 0;
    this.swingT = 0;
  }
  reset() { this.mining = null; this.progress = 0; this.eatT = 0; this.g.selection.setCrack(0); }
  held() { const g = this.g; return g.inventory.slots[g.inventory.selected]; }

  breakTimeFor(b, stack) {
    if (b.hardness < 0) return Infinity;
    if (b.hardness === 0) return 0;
    const it = stack ? getItem(stack.id) : null;
    const td = it && it.tool ? it.tool : null;
    const right = td && td.kind === b.tool;
    const harvest = !b.needsTool || (right && td.tier >= b.tier);
    let speed = right ? td.speed : 1;
    return b.hardness * (harvest ? 1.5 : 5) / speed;
  }

  update(dt) {
    const g = this.g, c = g.controls, p = g.player, inv = g.inventory;
    this.cool -= dt; this.placeCool -= dt; this.attackCool -= dt;
    const active = g.state === 'playing' && c.active() && !g.uiOpen;
    if (!active) { this.reset(); g.hand && (g.hand.eat = 0); return; }
    // хотбар
    if (c.wheel) { inv.selected = ((inv.selected + c.wheel) % 9 + 9) % 9; }
    for (let i = 0; i < 9; i++) if (c.wasPressed('Digit' + (i + 1))) inv.selected = i;
    if (c.wasPressed('KeyQ')) {
      const st = inv.slots[inv.selected];
      if (st) {
        const all = c.isDown('ControlLeft') || c.isDown('ShiftLeft');
        const n = all ? st.count : 1;
        g.dropFromPlayer({ id: st.id, count: n, dmg: st.dmg || 0 });
        st.count -= n; if (st.count <= 0) inv.slots[inv.selected] = null;
      }
    }
    const target = g.target;
    const stack = this.held();
    const ctl = { x: 0, y: 0, z: 0 };
    // ----- левая кнопка: атака / ломание -----
    const lDown = c.mouse[0], lPress = c.mousePressed[0];
    let hitMob = null;
    {
      const cam = g.camera; const d = g.dirVec; cam.getWorldDirection(d);
      const reach = p.creative ? 5 : 3.6;
      const e = g.entities.raycast(cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z, reach);
      if (e && (!target || e.t < target.dist + 0.01)) hitMob = e.e;
    }
    if (lDown && hitMob) {
      if ((lPress || this.attackCool <= 0)) this.attack(hitMob, stack);
      this.mining = null; this.progress = 0; g.selection.setCrack(0);
    } else if (lDown && target) {
      const b = BLOCKS[target.id];
      if (p.creative) {
        if (lPress || this.cool <= 0) { this.cool = 0.22; g.breakBlock(target.x, target.y, target.z, { byPlayer: true }); g.hand?.punch(); }
        this.progress = 0; g.selection.setCrack(0);
      } else {
        const m = this.mining;
        if (!m || m.x !== target.x || m.y !== target.y || m.z !== target.z) { this.mining = { x: target.x, y: target.y, z: target.z }; this.progress = 0; this.hitT = 0; }
        const T = this.breakTimeFor(b, stack);
        if (T === Infinity) { g.selection.setCrack(0); }
        else {
          this.progress += T === 0 ? 1 : dt / T;
          this.hitT -= dt;
          if (this.hitT <= 0) {
            this.hitT = 0.25; g.hand?.punch();
            g.sfx?.play('step:' + b.sound, { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 }, 0.9, 0.9);
            g.particles?.hitBlock(target.x, target.y, target.z, target.nx, target.ny, target.nz, target.id, Math.max(0.4, g.lightAt(target.x + target.nx, target.y + target.ny, target.z + target.nz)));
          }
          g.selection.setCrack(T === 0 ? 0 : this.progress);
          if (this.progress >= 1) {
            g.breakBlock(target.x, target.y, target.z, { byPlayer: true, tool: stack });
            this.afterBreak(b, stack);
            this.progress = 0; this.mining = null; g.selection.setCrack(0); this.cool = 0.12;
          }
        }
      }
    } else {
      if (this.mining) { this.mining = null; this.progress = 0; g.selection.setCrack(0); }
      if (lPress) g.hand?.punch();
    }
    // ----- правая кнопка -----
    const rDown = c.mouse[2], rPress = c.mousePressed[2];
    if (g.hand) g.hand.eat = 0;
    if (rDown) {
      // еда
      const it = stack ? getItem(stack.id) : null;
      if (it && it.food && (p.creative ? false : g.survival.food < 20)) {
        this.eatT += dt; if (g.hand) g.hand.eat = 1;
        if (Math.floor(this.eatT * 5) !== Math.floor((this.eatT - dt) * 5)) { g.sfx?.play('eat', null, 0.8); g.particles?.crumbs(p.x - Math.sin(p.yaw) * 0.5, p.y + p.eye - 0.3, p.z - Math.cos(p.yaw) * 0.5, TILE_INDEX[it.tile], 3); }
        if (this.eatT >= 1.6) {
          this.eatT = 0; g.survival.eat(it.food.hunger, it.food.sat); inv.decrementSelected(); g.sfx?.play('burp', null, 0.6);
        }
      } else this.eatT = 0;
      if (rPress || this.placeCool <= 0) {
        // существо под прицелом
        let used = false;
        if (hitMob && stack && getItem(stack.id).name === 'shears' && hitMob.shear) used = hitMob.shear(g, stack) || false;
        if (!used && hitMob && hitMob.interact) used = hitMob.interact(g, stack) || false;
        if (used) { this.placeCool = 0.3; g.hand?.punch(); }
        else if (target) {
          const sneak = c.isDown('ShiftLeft') || c.isDown('ShiftRight');
          if (!(sneak && stack) && this.useBlock(target, stack)) { this.placeCool = 0.25; g.hand?.punch(); }
          else if (stack && this.useItemOn(target, stack)) { this.placeCool = 0.2; g.hand?.punch(); }
        } else if (rPress && stack) this.useItemOn(null, stack);
      }
    } else this.eatT = 0;
    // средняя — pick block
    if (c.mousePressed[1] && target) {
      const id = target.id; const b = BLOCKS[id]; const nm = b.item; const iid = I[nm];
      if (iid !== undefined) {
        let found = -1;
        for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].id === iid) found = i;
        if (found >= 0) inv.selected = found;
        else if (p.creative) {
          let slot = inv.slots[inv.selected] ? -1 : inv.selected;
          if (slot < 0) for (let i = 0; i < 9; i++) if (!inv.slots[i]) { slot = i; break; }
          if (slot < 0) slot = inv.selected;
          inv.slots[slot] = { id: iid, count: 64, dmg: 0 }; inv.selected = slot;
        }
      }
    }
  }

  afterBreak(b, stack) {
    const g = this.g, p = g.player;
    if (!p.creative) {
      g.survival.addExhaustion(0.005);
      if (stack) { const it = getItem(stack.id); if (it && it.dur && b.hardness > 0) { if (g.inventory.damageSelected(it.tool && it.tool.kind === b.tool || it.tool?.kind === 'shears' ? 1 : 2)) g.sfx?.play('break_tool'); } }
    }
  }

  attack(mob, stack) {
    const g = this.g, p = g.player;
    this.attackCool = 0.5; g.hand?.punch();
    const it = stack ? getItem(stack.id) : null;
    let dmg = it && it.damage ? it.damage : 1;
    const crit = !p.onGround && p.vy < 0 && !p.inWater;
    if (crit) { dmg = Math.ceil(dmg * 1.5); g.particles?.hurt(mob.x, mob.y + mob.h * 0.6, mob.z, 6); }
    const dx = mob.x - p.x, dz = mob.z - p.z, d = Math.hypot(dx, dz) || 1;
    mob.hurt(dmg, { x: dx / d, z: dz / d }, 'player');
    g.sfx?.play('hit', { x: mob.x, y: mob.y, z: mob.z }, 1);
    if (!p.creative) {
      g.survival.addExhaustion(0.1);
      if (it && it.dur) if (g.inventory.damageSelected(it.damage && it.tool?.kind === 'sword' ? 1 : 2)) g.sfx?.play('break_tool');
    }
  }

  // Использование блока (интерфейс, дверь, бочонок). true — действие выполнено
  useBlock(t, stack) {
    const g = this.g, w = g.world;
    const id = t.id, b = BLOCKS[id], key = t.x + ',' + t.y + ',' + t.z;
    if (id === B.workbench) { g.openUI('workbench'); return true; }
    if (b.name.startsWith('furnace')) {
      let be = w.be.get(key); if (!be) { be = newFurnace(t.x, t.y, t.z); w.be.set(key, be); }
      g.openUI('furnace', be); return true;
    }
    if (b.name.startsWith('chest')) {
      let be = w.be.get(key); if (!be) { be = newChest(t.x, t.y, t.z); w.be.set(key, be); }
      g.openUI('chest', be); return true;
    }
    if (b.name.startsWith('door_')) { this.toggleDoor(t.x, t.y, t.z); return true; }
    if (id === B.keg && stack && getItem(stack.id).name === 'flint_steel') {
      g.ignite(t.x, t.y, t.z);
      if (!g.player.creative && g.inventory.damageSelected(1)) g.sfx?.play('break_tool');
      return true;
    }
    return false;
  }
  toggleDoor(x, y, z) {
    const g = this.g, w = g.world;
    const b = BLOCKS[w.getBlock(x, y, z)];
    const m = b.name.match(/^door_(lo|hi)_(\d)_(\d)$/); if (!m) return;
    const lo = m[1] === 'lo' ? y : y - 1;
    const op = 1 - parseInt(m[3], 10);
    g.setBlock(x, lo, z, B[`door_lo_${m[2]}_${op}`]);
    g.setBlock(x, lo + 1, z, B[`door_hi_${m[2]}_${op}`]);
    g.sfx?.play('door', { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, 1);
  }

  // использование предмета на блоке или в воздухе
  useItemOn(t, stack) {
    const g = this.g, w = g.world, p = g.player;
    const it = getItem(stack.id);
    if (!it) return false;
    const nm = it.name;
    if (t) {
      const tb = BLOCKS[t.id];
      if (nm.endsWith('_hoe') && (SOILS.has(t.id)) && w.getBlock(t.x, t.y + 1, t.z) === 0) {
        g.setBlock(t.x, t.y, t.z, B.farmland);
        g.sfx?.play('step:gravel', { x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 }, 1.2);
        if (!p.creative && g.inventory.damageSelected(1)) g.sfx?.play('break_tool');
        return true;
      }
      if (nm === 'flint_steel') return false;
    }
    if (it.food || it.tool || it.armor || nm === 'flint_steel') {
      // экипировка брони по ПКМ
      if (it.armor && !g.inventory.armor[it.armor.slot]) { g.inventory.armor[it.armor.slot] = Object.assign({}, stack); g.inventory.slots[g.inventory.selected] = null; g.sfx?.play('craft'); return true; }
      return false;
    }
    if (!t) return false;
    return this.place(t, stack);
  }

  // установка блока
  place(t, stack) {
    const g = this.g, w = g.world, p = g.player;
    let bid = placeBlockOf(stack.id);
    if (!bid) return false;
    let b = BLOCKS[bid];
    const tb = BLOCKS[t.id];
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    if (tb.replaceable || FAMILY[t.id]) { px = t.x; py = t.y; pz = t.z; }
    // направление взгляда: 0=-z,1=+x,2=+z,3=-x
    const dirIdx = ((Math.round(-p.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    const hitY = (() => { const cam = g.camera, d = g.dirVec; return cam.position.y + d.y * t.dist - t.y; })();
    const nm = b.name;
    if (nm.startsWith('slab_') && !nm.startsWith('slabtop_')) {
      // слияние в полный блок
      const base = nm.slice(5);
      if (t.id === bid && t.ny === 1 || (BLOCKS[t.id].name === 'slabtop_' + base && t.ny === -1)) {
        g.setBlock(t.x, t.y, t.z, B[base]); this.afterPlace(b, stack, t.x, t.y, t.z); return true;
      }
      const top = t.ny < 0 || (t.ny === 0 && hitY > 0.5);
      if (top) bid = B['slabtop_' + base];
    } else if (nm.startsWith('stairs_')) {
      bid = B[nm.replace(/_\d$/, '') + '_' + dirIdx];
    } else if (nm.startsWith('furnace_')) bid = B['furnace_' + ((dirIdx + 2) % 4)];
    else if (nm.startsWith('chest_')) bid = B['chest_' + ((dirIdx + 2) % 4)];
    b = BLOCKS[bid];
    const cur = w.getBlock(px, py, pz);
    if (!(cur === 0 || BLOCKS[cur].replaceable || FAMILY[cur])) return false;
    if (py < 1 || py > 254) return false;
    // двери
    let doorHi = 0;
    if (b.name.startsWith('door_')) {
      const above = w.getBlock(px, py + 1, pz);
      if (!(above === 0 || BLOCKS[above].replaceable)) return false;
      const pl = dirIdx % 2 === 0 ? 0 : 1;
      bid = B[`door_lo_${pl}_0`]; doorHi = B[`door_hi_${pl}_0`]; b = BLOCKS[bid];
    }
    if (!canExist(w, bid, px, py, pz)) return false;
    // не ставить внутрь игрока
    if (b.solid && this.overlapsPlayer(px, py, pz, b)) return false;
    g.setBlock(px, py, pz, bid);
    if (doorHi) g.setBlock(px, py + 1, pz, doorHi);
    this.afterPlace(b, stack, px, py, pz);
    return true;
  }
  overlapsPlayer(x, y, z, b) {
    const p = this.g.player, hw = p.w / 2;
    const boxes = b.boxes ? b.boxes.map((q) => q.map((v) => v / 16)) : [[0, 0, 0, 1, 1, 1]];
    for (const q of boxes) {
      if (p.x + hw > x + q[0] + 1e-4 && p.x - hw < x + q[3] - 1e-4 && p.y + p.h > y + q[1] + 1e-4 && p.y < y + q[4] - 1e-4 && p.z + hw > z + q[2] + 1e-4 && p.z - hw < z + q[5] - 1e-4) return true;
    }
    return false;
  }
  afterPlace(b, stack, x, y, z) {
    const g = this.g;
    g.sfx?.play('place:' + b.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, 1);
    g.hand?.punch();
    if (!g.player.creative) g.inventory.decrementSelected();
  }
}
