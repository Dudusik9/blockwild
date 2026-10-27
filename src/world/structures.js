// Структуры: деревья, кактусы, валуны, руины. Работают через адаптер w = {get(x,y,z), set(x,y,z,id)}
import { B, BLOCKS, SOLID } from './blocks.js';
import { I } from '../game/items.js';

const AIR = 0;
const isSoft = (id) => id === AIR || BLOCKS[id].replaceable || BLOCKS[id].name.startsWith('leaves_') || (BLOCKS[id].shape === 1 && !BLOCKS[id].solid);
function log(w, x, y, z, t) { const c = w.get(x, y, z); if (isSoft(c) || c === B.water_0 && false) w.set(x, y, z, B['log_' + t]); }
function leaf(w, x, y, z, t) { const c = w.get(x, y, z); if (c === AIR || BLOCKS[c].replaceable && !BLOCKS[c].family) w.set(x, y, z, B['leaves_' + t]); }

export function placeTree(w, type, x, y, z, rnd) {
  // y — уровень первой клетки ствола (над землёй)
  switch (type) {
    case 'oak': case 'birch': {
      const t = type;
      const h = type === 'oak' ? 4 + ((rnd() * 3) | 0) : 5 + ((rnd() * 3) | 0);
      for (let i = 0; i < h; i++) log(w, x, y + i, z, t);
      const top = y + h - 1;
      for (let dy = -2; dy <= 1; dy++) {
        const r = dy >= 0 ? 1 : 2;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 1 && dy === 1 || rnd() < 0.5)) continue;
          if (dx === 0 && dz === 0 && dy < 0) continue;
          leaf(w, x + dx, top + dy, z + dz, t);
        }
      }
      return;
    }
    case 'bigoak': {
      const h = 8 + ((rnd() * 4) | 0);
      for (let i = 0; i < h; i++) log(w, x, y + i, z, 'oak');
      const cy = y + h - 2;
      // ветви
      for (let b = 0; b < 4; b++) {
        const a = rnd() * 6.283, len = 2 + ((rnd() * 2) | 0), by = y + h - 4 + ((rnd() * 2) | 0);
        for (let k = 1; k <= len; k++) log(w, x + Math.round(Math.cos(a) * k), by + (k > 1 ? 1 : 0), z + Math.round(Math.sin(a) * k), 'oak');
        blob(w, x + Math.round(Math.cos(a) * len), by + 1, z + Math.round(Math.sin(a) * len), 2.6, 'oak', rnd);
      }
      blob(w, x, cy + 1, z, 3.4, 'oak', rnd);
      return;
    }
    case 'spruce': {
      const h = 6 + ((rnd() * 5) | 0);
      for (let i = 0; i < h; i++) log(w, x, y + i, z, 'spruce');
      let r = 0, maxr = 2 + ((rnd() * 2) | 0);
      for (let dy = h; dy >= 2; dy--) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > r + (r > 1 ? 1 : 0) && !(r === 0)) continue;
          if (dx === 0 && dz === 0 && dy < h) continue;
          leaf(w, x + dx, y + dy, z + dz, 'spruce');
        }
        r++; if (r > maxr) r = (dy % 2 === 0) ? 1 : 0;
      }
      leaf(w, x, y + h, z, 'spruce'); leaf(w, x, y + h + 1, z, 'spruce');
      return;
    }
    case 'acacia': {
      const h = 3 + ((rnd() * 2) | 0);
      const dir = (rnd() * 4) | 0, dx = [1, 0, -1, 0][dir], dz = [0, 1, 0, -1][dir];
      let cx = x, cz = z, cy = y;
      for (let i = 0; i < h; i++) { log(w, cx, cy, cz, 'acacia'); cy++; }
      cx += dx; cz += dz; log(w, cx, cy, cz, 'acacia'); cy++;
      log(w, cx + dx, cy, cz + dz, 'acacia'); // второй изгиб
      flat(w, cx, cy, cz, 2, 'acacia', rnd); flat(w, cx, cy + 1, cz, 1, 'acacia', rnd);
      if (rnd() < 0.6) { // боковая ветка
        const bx = x - dx, bz = z - dz;
        log(w, bx, y + h - 1, bz, 'acacia'); log(w, bx - dx, y + h, bz - dz, 'acacia');
        flat(w, bx - dx, y + h + 1, bz - dz, 1, 'acacia', rnd); leaf(w, bx - dx, y + h, bz - dz + 1, 'acacia');
      }
      return;
    }
    case 'willow': {
      const h = 4 + ((rnd() * 2) | 0);
      for (let i = 0; i < h; i++) log(w, x, y + i, z, 'willow');
      const top = y + h - 1;
      for (let dy = -1; dy <= 1; dy++) {
        const r = dy === 1 ? 2 : 3;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dz * dz > r * r + 1) continue;
          if (rnd() < 0.12) continue;
          leaf(w, x + dx, top + dy, z + dz, 'willow');
          if (dy === -1 && Math.abs(dx) + Math.abs(dz) >= r && rnd() < 0.7) {
            const l = 1 + ((rnd() * 3) | 0);
            for (let k = 1; k <= l; k++) leaf(w, x + dx, top + dy - k, z + dz, 'willow');
          }
        }
      }
      return;
    }
  }
}
function blob(w, cx, cy, cz, r, t, rnd) {
  const ri = Math.ceil(r);
  for (let dx = -ri; dx <= ri; dx++) for (let dy = -ri; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) {
    const d = dx * dx + dy * dy * 1.3 + dz * dz;
    if (d <= r * r - (rnd() < 0.3 ? 1.5 : 0)) leaf(w, cx + dx, cy + dy, cz + dz, t);
  }
}
function flat(w, cx, cy, cz, r, t, rnd) {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.abs(dx) === r && Math.abs(dz) === r && r > 1) continue;
    if (rnd() < 0.08) continue;
    leaf(w, cx + dx, cy, cz + dz, t);
  }
}

export function placeCactus(w, x, y, z, h) {
  for (let i = 0; i < h; i++) w.set(x, y + i, z, B.cactus);
}
export function placeBoulder(w, x, y, z, r, rnd) {
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    if (dx * dx + dy * dy + dz * dz > r * r + 0.5 - (rnd() < 0.3 ? 1 : 0)) continue;
    const ty = y + dy;
    if (ty < y - 1) continue;
    const c = w.get(x + dx, ty, z + dz);
    if (c === AIR || BLOCKS[c].replaceable) w.set(x + dx, ty, z + dz, rnd() < 0.35 ? B.mossy_cobble : B.cobble);
  }
}

// ---- сундук-лут
const LOOT = [
  ['stick', 4, 1, 5], ['coal', 5, 1, 6], ['bread', 4, 1, 3], ['apple', 4, 1, 3], ['iron_ingot', 3, 1, 3], ['copper_ingot', 4, 1, 4],
  ['gold_ingot', 2, 1, 2], ['torch', 5, 2, 8], ['seeds', 4, 2, 6], ['hide', 3, 1, 3], ['powder', 2, 1, 3], ['crystal', 1, 1, 2],
  ['iron_pickaxe', 1, 1, 1], ['stone_sword', 2, 1, 1], ['bone', 3, 1, 3], ['planks_oak', 4, 3, 10], ['flint_steel', 1, 1, 1], ['cooked_pork', 2, 1, 2],
];
export function makeLoot(rnd) {
  const slots = new Array(27).fill(null);
  const total = LOOT.reduce((s, l) => s + l[1], 0);
  const n = 4 + ((rnd() * 5) | 0);
  for (let i = 0; i < n; i++) {
    let r = rnd() * total, pick = LOOT[0];
    for (const l of LOOT) { r -= l[1]; if (r <= 0) { pick = l; break; } }
    const id = I[pick[0]];
    if (id === undefined) continue;
    const count = pick[2] + ((rnd() * (pick[3] - pick[2] + 1)) | 0);
    const slot = (rnd() * 27) | 0;
    if (!slots[slot]) slots[slot] = { id, count, dmg: 0 };
  }
  return slots;
}

// Руины: footprint 7x7, ground y; возвращает BE-список
export function placeRuin(w, x0, z0, gy, rnd, bes) {
  const S = 7;
  const wallB = () => (rnd() < 0.3 ? B.mossy_cobble : rnd() < 0.15 ? B.cobble : B.stone_brick);
  for (let dx = 0; dx < S; dx++) for (let dz = 0; dz < S; dz++) {
    const x = x0 + dx, z = z0 + dz;
    // фундамент вниз до земли и очистка сверху
    for (let y = gy - 4; y <= gy; y++) { const c = w.get(x, y, z); if (!SOLID[c]) w.set(x, y, z, B.cobble); }
    w.set(x, gy, z, rnd() < 0.25 ? B.mossy_cobble : B.stone_brick);
    for (let y = gy + 1; y <= gy + 8; y++) w.set(x, y, z, AIR);
    const edge = dx === 0 || dz === 0 || dx === S - 1 || dz === S - 1;
    if (edge) {
      const corner = (dx === 0 || dx === S - 1) && (dz === 0 || dz === S - 1);
      const hgt = corner ? 4 : 2 + ((rnd() * 3) | 0);
      const door = dz === 0 && dx === 3;
      for (let y = 1; y <= hgt; y++) {
        if (door && y <= 2) continue;
        if (!corner && rnd() < 0.08) continue;
        w.set(x, gy + y, z, wallB());
      }
    }
  }
  // сундук в углу
  const cx = x0 + S - 2, cz = z0 + S - 2;
  w.set(cx, gy + 1, cz, B.chest_0 + 0);
  bes.push({ x: cx, y: gy + 1, z: cz, type: 'chest', slots: makeLoot(rnd) });
  w.set(x0 + 1, gy + 1, z0 + S - 2, B.torch);
  if (rnd() < 0.5) w.set(x0 + S - 2, gy + 1, z0 + 1, B.mossy_cobble);
}
