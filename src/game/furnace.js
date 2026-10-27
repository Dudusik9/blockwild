// Печь: топливо + переплавка; работает при закрытом интерфейсе (тик блок-сущностей)
import { smeltResult, fuelTime } from './recipes.js';
import { maxStack } from './items.js';
import { B, BLOCKS } from '../world/blocks.js';

export const SMELT_TIME = 10;
export function newFurnace(x, y, z) { return { type: 'furnace', x, y, z, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 }; }
export function newChest(x, y, z) { return { type: 'chest', x, y, z, slots: new Array(27).fill(null) }; }

function canSmelt(be) {
  const inp = be.slots[0]; if (!inp) return null;
  const res = smeltResult(inp.id); if (res === null || res === undefined) return null;
  const out = be.slots[2];
  if (!out) return res;
  if (out.id === res && out.count < maxStack(res)) return res;
  return null;
}

// возвращает true, если изменилось состояние горения (нужно сменить блок)
export function tickFurnace(be, dt) {
  const wasLit = be.burn > 0;
  let res = canSmelt(be);
  if (be.burn > 0) be.burn -= dt;
  if (be.burn <= 0 && res !== null) {
    const f = be.slots[1];
    if (f && fuelTime(f.id) > 0) {
      be.burn = be.burnMax = fuelTime(f.id);
      f.count--; if (f.count <= 0) be.slots[1] = null;
    } else { be.burn = 0; }
  }
  if (be.burn > 0 && res !== null) {
    be.cook += dt;
    if (be.cook >= SMELT_TIME) {
      be.cook = 0;
      const inp = be.slots[0]; inp.count--; if (inp.count <= 0) be.slots[0] = null;
      if (be.slots[2]) be.slots[2].count++; else be.slots[2] = { id: res, count: 1, dmg: 0 };
    }
  } else if (be.cook > 0) be.cook = Math.max(0, be.cook - dt * 2);
  if (be.burn < 0) be.burn = 0;
  return (be.burn > 0) !== wasLit;
}
