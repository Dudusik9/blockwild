// Предметы: блоки-предметы (id = id блока) и обычные предметы (id >= 1000)
import { BLOCKS, B, SHAPE } from '../world/blocks.js';
import { TIERS, TOOLS, ARMOR_MATS, ARMOR_PARTS } from '../render/tilenames.js';

export const ITEMS = new Map();   // id -> item
export const I = {};              // name -> id
export const ITEM_LIST = [];

function reg(it) { ITEMS.set(it.id, it); I[it.name] = it.id; ITEM_LIST.push(it); return it; }

// ---- блоки как предметы
for (const b of BLOCKS) {
  if (b.id === 0 || b.family) continue;
  if (b.shape === SHAPE.CROP) continue;
  const canonical = b.item === b.name || b.name === 'door_lo_0_0' || (b.creative && b.item !== b.name && !I[b.item]);
  if (!canonical || I[b.item] !== undefined) continue;
  const fuel = /^(log_|planks_|workbench|chest|slab_planks|stairs_planks)/.test(b.item) ? 15 : /^sapling_/.test(b.item) ? 5 : b.item === 'block_coal' ? 800 : 0;
  reg({ id: b.id, name: b.item, title: b.title, stack: 64, block: b.id, fuel, tile: b.tile, isBlock: true });
}

// ---- обычные предметы
const TIER_RU = { wood: 'Деревянная', stone: 'Каменная', iron: 'Железная', crystal: 'Кристальная' };
const TOOL_RU = { pickaxe: ['кирка', 'f'], axe: ['топор', 'm'], shovel: ['лопата', 'f'], sword: ['меч', 'm'], hoe: ['мотыга', 'f'] };
let nid = 1000;
function item(name, title, o = {}) {
  return reg(Object.assign({ id: nid++, name, title, stack: 64, fuel: 0, tile: 'i_' + name, isBlock: false }, o));
}
item('stick', 'Палка', { fuel: 5 });
item('coal', 'Уголь', { fuel: 80 });
item('charcoal', 'Древесный уголь', { fuel: 80 });
item('copper_ingot', 'Медный слиток');
item('iron_ingot', 'Железный слиток');
item('gold_ingot', 'Золотой слиток');
item('crystal', 'Синевик');
item('clay_ball', 'Комок глины');
item('brick_item', 'Кирпич', { tile: 'i_brick' });
item('apple', 'Яблоко', { food: { hunger: 4, sat: 2.4 } });
item('bread', 'Хлеб', { food: { hunger: 5, sat: 6 } });
item('wheat', 'Пшеница');
item('seeds', 'Семена', { place: 'wheat_0', plantSoil: true });
item('raw_mutton', 'Сырая баранина', { food: { hunger: 2, sat: 1.2 } });
item('cooked_mutton', 'Жареная баранина', { food: { hunger: 6, sat: 12.8 } });
item('raw_chicken', 'Сырая курятина', { food: { hunger: 2, sat: 1.2 } });
item('cooked_chicken', 'Жареная курица', { food: { hunger: 6, sat: 7.2 } });
item('raw_pork', 'Сырая свинина', { food: { hunger: 3, sat: 1.8 } });
item('cooked_pork', 'Жареная свинина', { food: { hunger: 8, sat: 12.8 } });
item('egg', 'Яйцо', { stack: 16 });
item('feather', 'Перо');
item('hide', 'Шкура');
item('bone', 'Кость');
item('powder', 'Порох');
item('arrow', 'Стрела');
item('shears', 'Ножницы', { stack: 1, dur: 238, tool: { kind: 'shears', tier: 1, speed: 5 } });
item('flint_steel', 'Огниво', { stack: 1, dur: 64 });

const T = {
  wood: { tier: 0, speed: 2, dur: 59, dmg: 0 }, stone: { tier: 1, speed: 4, dur: 131, dmg: 1 },
  iron: { tier: 2, speed: 6, dur: 250, dmg: 2 }, crystal: { tier: 3, speed: 9, dur: 900, dmg: 3 },
};
const DMG = { sword: 4, axe: 3, pickaxe: 2, shovel: 1.5, hoe: 1 };
for (const t of TIERS) for (const k of TOOLS) {
  const [nm, g] = TOOL_RU[k];
  const adj = TIER_RU[t].slice(0, -2) + (g === 'f' ? 'ая' : 'ый');
  item(t + '_' + k, adj + ' ' + nm, { stack: 1, dur: T[t].dur, tool: { kind: k, tier: T[t].tier, speed: T[t].speed }, damage: DMG[k] + T[t].dmg, fuel: t === 'wood' ? 10 : 0 });
}
const AM = { hide: { n: 'Кожаный', d: [1, 3, 2, 1], dur: 80, ru: ['шлем', 'нагрудник', 'поножи', 'сапоги'] }, iron: { n: 'Железный', d: [2, 6, 5, 2], dur: 240 }, crystal: { n: 'Кристальный', d: [3, 8, 6, 3], dur: 500 } };
const PART_RU = ['шлем', 'нагрудник', 'поножи', 'сапоги'];
ARMOR_MATS.forEach((m) => ARMOR_PARTS.forEach((p, i) => {
  const adj = i === 1 ? AM[m].n : i === 3 ? AM[m].n + 'ые' : AM[m].n + (i === 2 ? 'ые' : '');
  const title = (i === 0 ? AM[m].n + ' ' : i === 1 ? AM[m].n + ' ' : AM[m].n.slice(0, -2) + 'ые ') + PART_RU[i];
  item(m + '_' + p, title, { stack: 1, dur: AM[m].dur, armor: { slot: i, defense: AM[m].d[i] } });
}));
// питомцы и машинка (новые предметы — только в конец, чтобы не сдвинуть id в старых сохранениях)
item('fish', 'Рыбка', { food: { hunger: 2, sat: 1.2 } });
item('dog_treat', 'Косточка-печенька');
item('spawn_kitten', 'Котёнок', { spawn: 'kitten' });
item('spawn_puppy', 'Щенок-спасатель', { spawn: 'puppy' });
item('car_key', 'Машинка-робот', { stack: 1, spawn: 'carbot' });

export const getItem = (id) => ITEMS.get(id);
export const maxStack = (id) => { const it = ITEMS.get(id); return it ? it.stack : 64; };
export const itemTitle = (id) => { const it = ITEMS.get(id); return it ? it.title : '?'; };
// Блок, в который превращается предмет при установке (по умолчанию — блок-предмет)
export function placeBlockOf(id) {
  const it = ITEMS.get(id);
  if (!it) return 0;
  if (it.block) return it.block;
  if (it.place) return B[it.place];
  return 0;
}
