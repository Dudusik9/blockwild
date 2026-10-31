// Городок спасателей: башня, площадь с фонтаном, домики, будки щенков, канал с мостом.
// Ставится «штампом» один раз на мир рядом со спавном, когда прогружены его чанки.
import { B, BLOCKS, SOLID, FAMILY } from './blocks.js';
import { BIOME } from './biomes.js';
import { SEA } from '../core/math.js';
import { mulberry32 } from '../core/noise.js';
import { FLOWERS } from '../render/tilenames.js';
import { newChest } from '../game/furnace.js';
import { I } from '../game/items.js';

// габариты относительно центра площади
const X0 = -22, X1 = 22, Z0 = -22, Z1 = 24, MARGIN = 3;
const TOWER = { x: 0, z: -13 };

// лапка 9×9 (X — синяя шерсть)
const PAW9 = ['..XX.XX..', '..XX.XX..', 'XX.....XX', 'XX.....XX', '...XXX...', '..XXXXX..', '.XXXXXXX.', '.XXXXXXX.', '..XX.XX..'];
const PAW5 = ['.X.X.', 'X...X', '.....', '.XXX.', '.XXX.'];

const HOUSES = [ // x0, z0 (угол 7×7), цвет стен, сторона двери
  { x: -16, z: -4, wool: 'wool_yellow', door: 'east' }, { x: -16, z: 5, wool: 'wool_green', door: 'east' },
  { x: -16, z: -14, wool: 'wool_purple', door: 'east' },
  { x: 10, z: -4, wool: 'wool_orange', door: 'west' }, { x: 10, z: 5, wool: 'wool_blue', door: 'west' },
];
const DOGHOUSES = [{ x: 8, wool: 'wool_red' }, { x: 12, wool: 'wool_blue' }, { x: 16, wool: 'wool_yellow' }]; // z: -15..-13, вход на юг

const isTreeOrPlant = (id) => { if (!id) return true; const b = BLOCKS[id]; return !b.solid || b.name.startsWith('leaves_') || b.name.startsWith('log_') || b.name === 'snow'; };

export class Town {
  constructor(g) { this.g = g; this.site = null; this.t = 0; }

  // мир без городка — выбрать место и построить, когда прогрузится
  update(dt) {
    const g = this.g, m = g.meta;
    if (!m || m.townBuilt || m.noTown || g.state !== 'playing') return;
    this.t -= dt; if (this.t > 0) return; this.t = 1;
    if (!this.site) {
      this.site = m.townSite || this.findSite(); if (!this.site) { m.noTown = true; return; }
      m.townSite = this.site;
      g.onTownSite?.(this.site); // стрелка ведёт к месту — городок появится, когда игрок подойдёт
    }
    if (!this.chunksReady(this.site.x, this.site.z)) return;
    this.build(this.site.x, this.site.z);
  }

  footprintChunks(cx, cz) {
    const out = [];
    for (let x = (cx + X0 - MARGIN) >> 4; x <= (cx + X1 + MARGIN) >> 4; x++) for (let z = (cz + Z0 - MARGIN) >> 4; z <= (cz + Z1 + MARGIN) >> 4; z++) out.push([x, z]);
    return out;
  }
  chunksReady(cx, cz) { return this.footprintChunks(cx, cz).every(([x, z]) => { const c = this.g.world.getChunk(x, z); return c && c.ready && c.blocks; }); }

  // ровное место у спавна, не задевающее чанки, где игрок уже что-то менял
  findSite() {
    const g = this.g, sp = g.spawn || { x: g.player.x, z: g.player.z }, o = { h: 0, biome: 0, t: 0, hum: 0 };
    const saved = g.world.savedKeys || new Set(), wid = g.meta.id;
    let best = null;
    for (const r of [30, 38, 46, 56, 66]) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, cx = Math.round(sp.x + Math.cos(a) * r), cz = Math.round(sp.z + Math.sin(a) * r);
      if (this.footprintChunks(cx, cz).some(([x, z]) => saved.has(wid + ':' + x + ',' + z))) continue;
      let lo = 999, hi = -1, bad = 0;
      for (let dx = X0; dx <= X1; dx += 4) for (let dz = Z0; dz <= Z1; dz += 4) {
        g.gen.sample(cx + dx, cz + dz, o);
        if (o.h <= SEA + 1) bad++;
        if (o.biome === BIOME.OCEAN) bad += 3;
        lo = Math.min(lo, o.h); hi = Math.max(hi, o.h);
      }
      const score = (hi - lo) + bad * 2 + r * 0.1;
      if (!best || score < best.score) best = { x: cx, z: cz, score };
    }
    this.lastScore = best && best.score;
    return best && best.score < 45 ? { x: best.x, z: best.z } : null;
  }

  groundY(x, z) {
    const w = this.g.world; let y = Math.min(250, w.topY(x, z) + 1);
    while (y > 1 && (isTreeOrPlant(w.getBlock(x, y, z)) || FAMILY[w.getBlock(x, y, z)])) y--;
    return y;
  }

  build(cx, cz) {
    const g = this.g, w = g.world, rnd = mulberry32((cx * 73856093) ^ (cz * 19349663));
    const set = (x, y, z, id) => w.setBlock(cx + x, y, cz + z, id, { silent: true });
    const get = (x, y, z) => w.getBlock(cx + x, y, cz + z);
    // высота площадки — медиана грунта
    const hs = [];
    for (let x = X0; x <= X1; x += 3) for (let z = Z0; z <= Z1; z += 3) hs.push(this.groundY(cx + x, cz + z));
    hs.sort((a, b) => a - b);
    const H = Math.max(SEA + 2, hs[hs.length >> 1]);
    // 1. выравнивание (с плавным краем)
    for (let x = X0 - MARGIN; x <= X1 + MARGIN; x++) for (let z = Z0 - MARGIN; z <= Z1 + MARGIN; z++) {
      const gy = this.groundY(cx + x, cz + z);
      const m = Math.max(X0 - x, x - X1, Z0 - z, z - Z1, 0);
      const t = m === 0 ? H : Math.round(H + (gy - H) * (m / (MARGIN + 1)));
      for (let y = t + 1; y <= Math.max(gy, t) + 24; y++) if (get(x, y, z)) set(x, y, z, 0);
      for (let y = Math.min(gy, t - 3); y < t; y++) { const id = get(x, y, z); if (!id || !SOLID[id] || FAMILY[id]) set(x, y, z, B.dirt); }
      set(x, t, z, B.grass);
    }
    const y0 = H + 1;
    // 2. площадь, фонтан, лапка
    for (let x = -7; x <= 7; x++) for (let z = -5; z <= 13; z++) set(x, H, z, B.stone_brick);
    for (let x = -5; x <= 5; x++) for (let z = 3; z <= 13; z++) if ((x * x) + (z - 8) * (z - 8) <= 27) set(x, H, z, B.wool_white);
    PAW9.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') set(i - 4, H, 4 + j, B.wool_blue); }));
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) === 2) set(x, y0, z, B.stone_brick);
      else { set(x, H - 1, z, B.stone_brick); set(x, H, z, B.water_0); }
    }
    for (let y = H; y <= H + 2; y++) set(0, y, 0, B.stone_brick);
    set(0, H + 3, 0, B.lumen);
    // 3. башня
    this.buildTower(set, TOWER.x, TOWER.z, y0, H);
    // сундуки у входа
    const chestAt = (x, z, items) => {
      set(x, y0, z, B.chest_2);
      const be = newChest(cx + x, y0, cz + z); items.forEach(([n, c], i) => { if (I[n] !== undefined) be.slots[i] = { id: I[n], count: c, dmg: 0 }; });
      w.be.set((cx + x) + ',' + y0 + ',' + (cz + z), be);
    };
    chestAt(TOWER.x - 3, TOWER.z + 6, [['fish', 16], ['dog_treat', 16], ['spawn_kitten', 2], ['spawn_puppy', 2], ['car_key', 1], ['apple', 8], ['bread', 8]]);
    chestAt(TOWER.x + 3, TOWER.z + 6, [['wool_red', 64], ['wool_blue', 64], ['wool_yellow', 64], ['wool_green', 64], ['wool_white', 64], ['glass', 64], ['planks_oak', 64], ['door', 4], ['lumen', 16], ['torch', 32]]);
    for (let z = TOWER.z + 6; z <= -6; z++) for (let x = -1; x <= 1; x++) set(x, H, z, B.gravel);
    // 4. домики и будки
    for (const h of HOUSES) this.buildHouse(set, h, y0, H);
    for (const d of DOGHOUSES) this.buildDoghouse(set, d.x, -15, y0, B[d.wool]);
    // 5. канал и мост
    for (let x = -18; x <= 18; x++) {
      for (let z = 16; z <= 20; z++) {
        if (z === 16 || z === 20) { set(x, H, z, B.stone_brick); continue; }
        set(x, H - 2, z, B.clay); set(x, H - 1, z, B.water_0); set(x, H, z, B.water_0);
      }
    }
    for (const x of [-19, 19]) for (let z = 16; z <= 20; z++) { set(x, H - 1, z, B.stone_brick); set(x, H, z, B.stone_brick); }
    for (let x = -2; x <= 2; x++) {
      for (let z = 16; z <= 20; z++) set(x, y0, z, B.planks_oak);
      set(x, y0, 15, B.slab_planks_oak); set(x, y0, 21, B.slab_planks_oak);
      for (const z of [14, 22, 23, 24]) set(x, H, z, B.gravel);
    }
    for (const x of [-3, 3]) {
      for (let z = 17; z <= 19; z++) { set(x, y0, z, B.planks_oak); set(x, y0 + 1, z, B.wool_red); }
      for (const z of [16, 20]) { set(x, y0, z, B.planks_oak); set(x, y0 + 1, z, B.log_oak); set(x, y0 + 2, z, B.lumen); }
    }
    // 6. фонари на углах площади
    for (const [x, z] of [[-8, -6], [8, -6], [-8, 14], [8, 14]]) { set(x, y0, z, B.log_birch); set(x, y0 + 1, z, B.log_birch); set(x, y0 + 2, z, B.lumen); }
    // 7. цветы
    for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
      if (get(x, H, z) === B.grass && !get(x, y0, z) && rnd() < 0.05) set(x, y0, z, B['flower_' + FLOWERS[(rnd() * FLOWERS.length) | 0]]);
    }
    // 8. щенки у будок и машинка у башни
    DOGHOUSES.forEach((d, i) => {
      const p = g.mobs.spawnMob('puppy', cx + d.x + 1.5, y0 + 0.05, cz - 11.5, i);
      p.tamed = true; p.noDespawn = true; p.sitting = true; p.yaw = 0;
    });
    g.spawnCarbot(cx - 7, y0 + 0.05, cz - 9.5, 0, 'red');
    const m = g.meta; m.townBuilt = true; m.town = { x: cx, z: cz, y: y0, tower: { x: cx + TOWER.x, y: y0, z: cz + TOWER.z } };
    g.chat?.log('Рядом появился Городок спасателей! 🐾', '#ffd75a');
    g.onTownBuilt?.(m.town);
    return m.town;
  }

  // башня: восьмиугольник, внутри винтовая лестница из полублоков вокруг светлой колонны
  buildTower(set, tx, tz, y0, H) {
    const ab = Math.abs, oct = (x, z, r, s) => Math.max(ab(x), ab(z)) <= r && ab(x) + ab(z) <= s;
    const TOP = y0 + 11; // уровень площадки
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
      if (!oct(x, z, 5, 7)) continue;
      set(tx + x, H, tz + z, B.stone_brick);
      const inside = Math.max(ab(x), ab(z)) <= 3;
      if (inside) continue;
      for (let y = y0; y < TOP; y++) {
        const k = y - y0;
        let id = k < 2 ? B.stone_brick : k === 2 ? B.wool_blue : B.wool_white;
        const face = (ab(x) <= 1 && ab(z) >= 4) || (ab(z) <= 1 && ab(x) >= 4);
        if (face && (k === 3 || k === 4 || k === 8 || k === 9) && !(z > 0 && ab(x) <= 2)) id = B.glass;
        set(tx + x, y, tz + z, id);
      }
    }
    // дверной проём на юг
    for (const z of [4, 5]) for (let y = y0; y <= y0 + 2; y++) set(tx, y, tz + z, 0); // 3 блока: сразу за дверью ступень
    set(tx, y0 + 3, tz + 5, B.wool_blue);
    // лапка на южной стене
    PAW5.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') set(tx + i - 2, y0 + 10 - j, tz + 5, B.wool_blue); }));
    // колонна со светокамнями
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) for (let y = y0; y < TOP; y++) {
      const edge = Math.max(ab(x), ab(z)) === 2 && (ab(x) === 0 || ab(z) === 0);
      set(tx + x, y, tz + z, edge && (y - y0) % 4 === 2 ? B.lumen : B.wool_white);
    }
    // ступени по периметру 7×7: от входа по часовой, полблока на клетку
    const ring = [];
    for (let x = 0; x >= -3; x--) ring.push([x, 3]);
    for (let z = 2; z >= -3; z--) ring.push([-3, z]);
    for (let x = -2; x <= 3; x++) ring.push([x, -3]);
    for (let z = -2; z <= 3; z++) ring.push([3, z]);
    for (let x = 2; x >= 1; x--) ring.push([x, 3]);
    ring.forEach(([x, z], k) => {
      const half = k + 1, full = (half >> 1);
      for (let y = y0; y < y0 + full; y++) set(tx + x, y, tz + z, B.planks_spruce);
      if (half & 1) set(tx + x, y0 + full, tz + z, B.slab_planks_spruce);
    });
    // площадка с проёмом над последними ступенями
    const hole = new Set(ring.slice(17, 23).map(([x, z]) => x + ',' + z)); // запас под голову на ступенях 17–22
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
      if (!oct(x, z, 6, 8) || hole.has(x + ',' + z)) continue;
      set(tx + x, TOP, tz + z, B.planks_spruce);
      if (!oct(x, z, 5, 7)) set(tx + x, TOP + 1, tz + z, B.glass_pane);
    }
    // смотровая кабина: стеклянные стены, проёмы на 4 стороны, красная крыша
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
      if (!oct(x, z, 4, 6) || oct(x, z, 3, 5) || hole.has(x + ',' + z)) continue;
      const gap = (x === 0 || z === 0);
      for (let y = TOP + 1; y <= TOP + 3; y++) set(tx + x, y, tz + z, gap && y <= TOP + 2 ? 0 : B.glass);
    }
    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
      if (oct(x, z, 5, 7)) set(tx + x, TOP + 4, tz + z, x === 0 && z === 0 ? B.lumen : B.wool_red);
      if (oct(x, z, 3, 4)) set(tx + x, TOP + 5, tz + z, B.wool_red);
      if (oct(x, z, 1, 1)) set(tx + x, TOP + 6, tz + z, B.wool_red);
    }
    for (let y = TOP + 7; y <= TOP + 10; y++) set(tx, y, tz, B.block_iron);
    set(tx, TOP + 11, tz, B.lumen);
    for (let y = TOP + 9; y <= TOP + 10; y++) for (let x = 1; x <= 3; x++) set(tx + x, y, tz, B.wool_red);
  }

  buildHouse(set, h, y0, H) {
    const { x: hx, z: hz } = h, wool = B[h.wool];
    for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) {
      set(hx + x, H, hz + z, B.planks_oak);
      const wall = x === 0 || x === 6 || z === 0 || z === 6, corner = (x === 0 || x === 6) && (z === 0 || z === 6);
      for (let y = y0; y < y0 + 3; y++) set(hx + x, y, hz + z, wall ? (corner ? B.log_oak : wool) : 0);
      // окна
      if (wall && !corner && (x === 2 || x === 4 || z === 2 || z === 4)) set(hx + x, y0 + 1, hz + z, B.glass_pane);
    }
    // ступенчатая кирпичная крыша
    for (let k = 0; k < 4; k++) for (let x = -1 + k; x <= 7 - k; x++) for (let z = -1 + k; z <= 7 - k; z++) set(hx + x, y0 + 3 + k, hz + z, B.brick);
    set(hx + 3, y0 + 3, hz + 3, B.lumen);
    // дверь к площади
    const dx = h.door === 'east' ? 6 : 0;
    set(hx + dx, y0, hz + 3, B.door_lo_1_0); set(hx + dx, y0 + 1, hz + 3, B.door_hi_1_0); set(hx + dx, y0 + 2, hz + 3, B.planks_oak);
    const step = h.door === 'east' ? 1 : -1;
    for (let x = hx + dx + step; Math.abs(x) >= 8; x += step) set(x, H, hz + 3, B.gravel);
    set(hx + 1, y0, hz + 1, B.workbench);
  }

  buildDoghouse(set, x0, z0, y0, wool) {
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
      const door = x === 1 && z === 2;
      for (let y = y0; y < y0 + 2; y++) set(x0 + x, y, z0 + z, (x === 1 && z === 1) || door ? 0 : wool);
      set(x0 + x, y0 + 2, z0 + z, B.slab_brick);
    }
    set(x0 + 1, y0 + 2, z0 + 2, B.wool_yellow);
  }
}
