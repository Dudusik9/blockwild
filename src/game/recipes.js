// Рецепты крафта (собственный набор) и переплавки
import { I, ITEMS } from './items.js';
import { WOODS, TIERS, TOOLS, ARMOR_MATS, ARMOR_PARTS } from '../render/tilenames.js';

export const RECIPES = [];
const TAGS = {
  planks: WOODS.map((w) => 'planks_' + w),
  logs: WOODS.map((w) => 'log_' + w),
  fuelcoal: ['coal', 'charcoal'],
};
export const tagMatches = (tag, name) => (TAGS[tag] ? TAGS[tag].includes(name) : tag === name);

// shaped: rows — строки паттерна, key — символ -> имя предмета или #тег
function shaped(out, n, rows, key, extra) { RECIPES.push({ out, n, rows: rows.map((r) => r.split('')), key, w: rows[0].length, h: rows.length, ...extra }); }
function shapeless(out, n, list) { RECIPES.push({ out, n, list }); }

// --- дерево
for (const w of WOODS) shapeless('planks_' + w, 4, ['log_' + w]);
shaped('stick', 4, ['P', 'P'], { P: '#planks' });
shaped('workbench', 1, ['PP', 'PP'], { P: '#planks' });
shaped('chest', 1, ['PPP', 'P.P', 'PPP'], { P: '#planks' });
shaped('furnace', 1, ['CCC', 'C.C', 'CCC'], { C: 'cobble' });
shaped('torch', 4, ['C', 'S'], { C: 'coal', S: 'stick' });
shaped('torch', 4, ['C', 'S'], { C: 'charcoal', S: 'stick' });
shaped('door', 3, ['PP', 'PP', 'PP'], { P: '#planks' });
shaped('lumen', 1, ['TT', 'TT'], { T: 'torch' });
// --- инструменты
const MATK = { wood: '#planks', stone: 'cobble', iron: 'iron_ingot', crystal: 'crystal' };
for (const t of TIERS) {
  const k = { M: MATK[t], S: 'stick' };
  shaped(t + '_pickaxe', 1, ['MMM', '.S.', '.S.'], k);
  shaped(t + '_axe', 1, ['MM', 'MS', '.S'], k);
  shaped(t + '_shovel', 1, ['M', 'S', 'S'], k);
  shaped(t + '_sword', 1, ['M', 'M', 'S'], k);
  shaped(t + '_hoe', 1, ['MM', '.S', '.S'], k);
}
// --- броня
const ARM = { hide: 'hide', iron: 'iron_ingot', crystal: 'crystal' };
for (const m of ARMOR_MATS) {
  const k = { M: ARM[m] };
  shaped(m + '_helmet', 1, ['MMM', 'M.M'], k);
  shaped(m + '_chest', 1, ['M.M', 'MMM', 'MMM'], k);
  shaped(m + '_legs', 1, ['MMM', 'M.M', 'M.M'], k);
  shaped(m + '_boots', 1, ['M.M', 'M.M'], k);
}
// --- еда и материалы
shaped('bread', 1, ['WWW'], { W: 'wheat' });
shaped('brick', 1, ['BB', 'BB'], { B: 'brick_item' });
shaped('stone_brick', 4, ['SS', 'SS'], { S: 'stone' });
shaped('sandstone', 1, ['SS', 'SS'], { S: 'sand' });
shaped('glass_pane', 16, ['GGG', 'GGG'], { G: 'glass' });
shaped('keg', 1, ['PSP', 'SPS', 'PSP'], { P: 'powder', S: 'sand' });
shaped('shears', 1, ['.I', 'I.'], { I: 'iron_ingot' });
shapeless('flint_steel', 1, ['iron_ingot', 'coal']);
shapeless('mossy_cobble', 1, ['cobble', 'fern']);
shapeless('dog_treat', 2, ['wheat', 'bone']);
shaped('car_key', 1, ['.W.', 'WIW', 'C.C'], { W: 'wool_red', I: 'iron_ingot', C: 'coal' });
// --- полублоки и лестницы
for (const base of ['planks_oak', 'cobble', 'stone_brick', 'sandstone', 'planks_spruce', 'brick']) shaped('slab_' + base, 6, ['BBB'], { B: base });
for (const base of ['planks_oak', 'cobble', 'stone_brick', 'sandstone']) shaped('stairs_' + base, 4, ['B..', 'BB.', 'BBB'], { B: base });
// --- блоки руд
const ORE = { coal: 'coal', copper: 'copper_ingot', iron: 'iron_ingot', gold: 'gold_ingot', crystal: 'crystal' };
for (const m in ORE) {
  shaped('block_' + m, 1, ['III', 'III', 'III'], { I: ORE[m] });
  RECIPES.push({ out: ORE[m], n: 9, list: ['block_' + m] });
}

// разрешение имён в id
for (const r of RECIPES) {
  const res = (v) => (v[0] === '#' ? v : v);
  if (I[r.out] === undefined) throw new Error('Рецепт: нет предмета ' + r.out);
  r.outId = I[r.out];
  if (r.key) for (const s in r.key) { const nm = r.key[s].replace('#', ''); if (!TAGS[nm] && I[nm] === undefined) throw new Error('Рецепт: нет ' + nm); }
  if (r.list) for (const nm of r.list) if (I[nm] === undefined && !TAGS[nm]) throw new Error('Рецепт: нет ' + nm);
}

// ---- переплавка
export const SMELT = {
  cobble: 'stone', sand: 'glass', clay_ball: 'brick_item', ore_iron: 'iron_ingot', ore_copper: 'copper_ingot', ore_gold: 'gold_ingot',
  raw_mutton: 'cooked_mutton', raw_chicken: 'cooked_chicken', raw_pork: 'cooked_pork', clay: 'brick', cactus: 'dead_bush',
};
for (const w of WOODS) SMELT['log_' + w] = 'charcoal';
export function smeltResult(itemId) {
  const it = ITEMS.get(itemId);
  if (!it) return null;
  const out = SMELT[it.name];
  return out ? I[out] : null;
}
export const fuelTime = (itemId) => { const it = ITEMS.get(itemId); return it ? it.fuel : 0; };

export function recipeText(r) {
  const nm = (n) => (n[0] === '#' ? { planks: 'любые доски', logs: 'любое бревно' }[n.slice(1)] || n : (ITEMS.get(I[n]) || {}).title || n);
  if (r.list) return r.list.map(nm).join(' + ');
  const used = new Set(r.rows.flat()); used.delete('.');
  return [...used].map((s) => nm(r.key[s])).join(' + ');
}
