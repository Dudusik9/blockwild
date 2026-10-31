// Реестр блоков Blockwild. Работает и в воркерах (без DOM).
import { TILE_INDEX, WOODS, WOODS_RU, WOOLS, WOOLS_RU, FLOWERS } from '../render/tilenames.js';

export const SHAPE = { CUBE: 0, CROSS: 1, BOX: 2, LIQUID: 3, PANE: 4, CROP: 5 };
export const LAYER = { OPAQUE: 0, CUTOUT: 1, TRANS: 2 };
export const TINT = { NONE: 0, GRASS: 1, FOLIAGE: 2, WATER: 3 };
export const BLOCKS = [];
export const B = {};
const FACE_FRONT = [5, 0, 4, 1]; // facing 0=-z,1=+x,2=+z,3=-x -> индекс грани (+x,-x,+y,-y,+z,-z)

function tl(n) { const t = TILE_INDEX[n]; if (t === undefined) throw new Error('tile ' + n); return t; }

function def(name, title, o = {}) {
  const id = BLOCKS.length;
  const b = Object.assign({
    id, name, title, item: name, shape: SHAPE.CUBE, solid: true, opaque: true, opac: 15, emit: 0,
    hardness: 1, tool: null, tier: 0, needsTool: false, drops: 'self', sound: 'stone', layer: LAYER.OPAQUE,
    replaceable: false, tint: TINT.NONE, anim: 0, boxes: null, facing: -1, creative: true, support: null,
    selectable: true, fall: false, liquid: null, family: null,
  }, o);
  const t = o.t;
  const ft = new Uint8Array(6);
  if (typeof t === 'string') ft.fill(tl(t));
  else if (t) {
    const side = t.side !== undefined ? t.side : t.top;
    for (let f = 0; f < 6; f++) ft[f] = tl(f === 2 ? (t.top || side) : f === 3 ? (t.bottom || t.top || side) : side);
    if (t.front && b.facing >= 0) ft[FACE_FRONT[b.facing]] = tl(t.front);
  }
  b.faceTiles = ft;
  b.tile = ft[2];
  BLOCKS.push(b); B[name] = id;
  return b;
}

const PLANKS_RU = { oak: 'Дубовые доски', birch: 'Берёзовые доски', spruce: 'Еловые доски', acacia: 'Акациевые доски', willow: 'Ивовые доски' };
const PLANT = { shape: SHAPE.CROSS, solid: false, opaque: false, opac: 0, hardness: 0, sound: 'grass', layer: LAYER.CUTOUT, anim: 3 };

// ---- базовые
def('air', 'Воздух', { solid: false, opaque: false, opac: 0, hardness: 0, replaceable: true, selectable: false, creative: false, drops: null, t: null });
def('grass', 'Дёрн', { t: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', sound: 'grass', drops: 'dirt', tint: TINT.GRASS });
def('dirt', 'Земля', { t: 'dirt', hardness: 0.5, tool: 'shovel', sound: 'gravel' });
def('podzol', 'Лесная подзола', { t: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' }, hardness: 0.6, tool: 'shovel', sound: 'gravel', drops: 'dirt' });
def('stone', 'Камень', { t: 'stone', hardness: 1.5, tool: 'pickaxe', needsTool: true, drops: 'cobble' });
def('cobble', 'Булыжник', { t: 'cobble', hardness: 2, tool: 'pickaxe', needsTool: true });
def('mossy_cobble', 'Мшистый булыжник', { t: 'mossy_cobble', hardness: 2, tool: 'pickaxe', needsTool: true });
def('gravel', 'Гравий', { t: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel', fall: true });
def('sand', 'Песок', { t: 'sand', hardness: 0.5, tool: 'shovel', sound: 'sand', fall: true });
def('sandstone', 'Песчаник', { t: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' }, hardness: 0.8, tool: 'pickaxe', needsTool: true });
def('clay', 'Глина', { t: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel', drops: { item: 'clay_ball', min: 4, max: 4 } });
def('snow', 'Снег', { t: 'snow', hardness: 0.3, tool: 'shovel', sound: 'snow' });
def('ice', 'Лёд', { t: 'ice', hardness: 0.5, tool: 'pickaxe', sound: 'glass', layer: LAYER.TRANS, opaque: false, opac: 1, drops: null });
def('basalt', 'Базальтовое дно', { t: 'basalt', hardness: -1, drops: null });
def('stone_brick', 'Каменный кирпич', { t: 'stone_brick', hardness: 2, tool: 'pickaxe', needsTool: true });
def('brick', 'Кирпичи', { t: 'brick', hardness: 2, tool: 'pickaxe', needsTool: true });
def('volcanic', 'Вулканическое стекло', { t: 'volcanic', hardness: 25, tool: 'pickaxe', needsTool: true, tier: 3 });
def('glass', 'Стекло', { t: 'glass', hardness: 0.3, sound: 'glass', layer: LAYER.TRANS, opaque: false, opac: 0, drops: null });
// дерево
for (const w of WOODS) {
  def('log_' + w, WOODS_RU[w] + ' ствол', { t: { top: 'log_' + w + '_top', bottom: 'log_' + w + '_top', side: 'log_' + w + '_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
}
for (const w of WOODS) def('planks_' + w, PLANKS_RU[w], { t: 'planks_' + w, hardness: 2, tool: 'axe', sound: 'wood' });
for (const w of WOODS) {
  const drops = [{ item: 'sapling_' + w, chance: 0.06 }, { item: 'stick', chance: 0.08, min: 1, max: 2 }];
  if (w === 'oak' || w === 'willow') drops.push({ item: 'apple', chance: 0.025 });
  def('leaves_' + w, 'Листва (' + WOODS_RU[w].toLowerCase() + ')', { t: 'leaves_' + w, hardness: 0.2, tool: 'shears', sound: 'grass', layer: LAYER.CUTOUT, opaque: false, opac: 1, tint: TINT.FOLIAGE, anim: 3, drops });
}
for (const w of WOODS) def('sapling_' + w, 'Саженец (' + WOODS_RU[w].toLowerCase() + ')', { ...PLANT, t: 'sapling_' + w, support: 'soil' });
// руды
def('ore_coal', 'Угольная руда', { t: 'ore_coal', hardness: 3, tool: 'pickaxe', needsTool: true, drops: 'coal' });
def('ore_copper', 'Медная руда', { t: 'ore_copper', hardness: 3, tool: 'pickaxe', needsTool: true, tier: 1 });
def('ore_iron', 'Железная руда', { t: 'ore_iron', hardness: 3, tool: 'pickaxe', needsTool: true, tier: 1 });
def('ore_gold', 'Золотая руда', { t: 'ore_gold', hardness: 3, tool: 'pickaxe', needsTool: true, tier: 2 });
def('ore_crystal', 'Руда синевика', { t: 'ore_crystal', hardness: 3.5, tool: 'pickaxe', needsTool: true, tier: 2, drops: { item: 'crystal', min: 1, max: 3 } });
const BLK_RU = { coal: 'Блок угля', copper: 'Медный блок', iron: 'Железный блок', gold: 'Золотой блок', crystal: 'Блок синевика' };
for (const m of ['coal', 'copper', 'iron', 'gold', 'crystal']) def('block_' + m, BLK_RU[m], { t: 'block_' + m, hardness: 4, tool: 'pickaxe', needsTool: true, tier: m === 'coal' ? 0 : 1 });
// функциональные
def('workbench', 'Верстак', { t: { top: 'workbench_top', bottom: 'planks_oak', side: 'workbench_side' }, hardness: 2.5, tool: 'axe', sound: 'wood' });
for (let f = 0; f < 4; f++) def('furnace_' + f, 'Печь', { t: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, facing: f, item: 'furnace', hardness: 3.5, tool: 'pickaxe', needsTool: true, creative: f === 0, drops: 'furnace' });
for (let f = 0; f < 4; f++) def('furnace_lit_' + f, 'Печь', { t: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_on' }, facing: f, item: 'furnace', hardness: 3.5, tool: 'pickaxe', needsTool: true, emit: 13, creative: false, drops: 'furnace' });
for (let f = 0; f < 4; f++) def('chest_' + f, 'Сундук', { t: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, facing: f, item: 'chest', shape: SHAPE.BOX, boxes: [[1, 0, 1, 15, 14, 15]], opaque: false, opac: 0, hardness: 2.5, tool: 'axe', sound: 'wood', creative: f === 0, drops: 'chest' });
def('torch', 'Факел', { t: 'torch', shape: SHAPE.BOX, boxes: [[7, 0, 7, 9, 10, 9]], solid: false, opaque: false, opac: 0, emit: 14, hardness: 0, sound: 'wood', layer: LAYER.CUTOUT, support: 'solid' });
def('lumen', 'Светокамень', { t: 'lumen', emit: 15, hardness: 0.6, sound: 'glass' });
def('keg', 'Пороховой бочонок', { t: { top: 'keg_top', bottom: 'keg_bottom', side: 'keg_side' }, hardness: 0.3, sound: 'wood' });
for (const c of WOOLS) def('wool_' + c, 'Шерсть (' + WOOLS_RU[c] + ')', { t: 'wool_' + c, hardness: 0.8, sound: 'cloth' });
// растительность / природа
def('cactus', 'Кактус', { t: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, shape: SHAPE.BOX, boxes: [[1, 0, 1, 15, 16, 15]], opaque: false, opac: 0, hardness: 0.4, sound: 'cloth', support: 'sand' });
def('reed', 'Тростник', { ...PLANT, t: 'reed', tint: TINT.GRASS, support: 'reedbase' });
def('tall_grass', 'Высокая трава', { ...PLANT, t: 'tall_grass', tint: TINT.GRASS, replaceable: true, support: 'soil', drops: [{ item: 'seeds', chance: 0.15 }] });
def('fern', 'Папоротник', { ...PLANT, t: 'fern', tint: TINT.GRASS, replaceable: true, support: 'soil', drops: [{ item: 'seeds', chance: 0.1 }] });
def('dead_bush', 'Сухой куст', { ...PLANT, t: 'dead_bush', replaceable: true, support: 'drysoil', anim: 0, drops: [{ item: 'stick', chance: 0.7, min: 1, max: 2 }] });
const FL_RU = { poppy: 'Рдянка', dandelion: 'Золотник', cornflower: 'Васильница', lilac: 'Сирень полевая' };
for (const f of FLOWERS) def('flower_' + f, FL_RU[f], { ...PLANT, t: 'flower_' + f, support: 'soil' });
def('farmland', 'Грядка', { t: { top: 'farmland_top', bottom: 'dirt', side: 'dirt' }, shape: SHAPE.BOX, boxes: [[0, 0, 0, 16, 15, 16]], opaque: false, opac: 0, hardness: 0.6, tool: 'shovel', sound: 'gravel', drops: 'dirt' });
for (let i = 0; i < 8; i++) def('wheat_' + i, 'Пшеница', { t: 'wheat_' + i, shape: SHAPE.CROP, solid: false, opaque: false, opac: 0, hardness: 0, sound: 'grass', layer: LAYER.CUTOUT, support: 'farmland', creative: i === 7, drops: i === 7 ? [{ item: 'wheat', min: 1, max: 1 }, { item: 'seeds', min: 0, max: 3 }] : [{ item: 'seeds', min: 1, max: 1 }] });
// полублоки и ступени
const SL = [['planks_oak', 'Дубовая плита', 'wood'], ['cobble', 'Булыжная плита', 'stone'], ['stone_brick', 'Плита каменного кирпича', 'stone'], ['sandstone', 'Песчаниковая плита', 'stone'], ['planks_spruce', 'Еловая плита', 'wood'], ['brick', 'Кирпичная плита', 'stone']];
for (const [base, title, snd] of SL) {
  const src = BLOCKS[B[base]];
  const mk = (nm, top, boxes) => {
    const b = def(nm, title, { shape: SHAPE.BOX, boxes, opaque: false, opac: 0, hardness: src.hardness, tool: src.tool, needsTool: src.needsTool, sound: snd, item: 'slab_' + base, drops: 'slab_' + base, creative: !top });
    b.faceTiles = src.faceTiles.slice(); b.tile = src.tile; return b;
  };
  mk('slab_' + base, false, [[0, 0, 0, 16, 8, 16]]);
  mk('slabtop_' + base, true, [[0, 8, 0, 16, 16, 16]]);
}
const ST = [['planks_oak', 'Дубовая лестница', 'wood'], ['cobble', 'Булыжная лестница', 'stone'], ['stone_brick', 'Лестница из каменного кирпича', 'stone'], ['sandstone', 'Песчаниковая лестница', 'stone']];
const STB = [ // facing 0..3: верхняя часть у -z, +x, +z, -x
  [[0, 0, 0, 16, 8, 16], [0, 8, 0, 16, 16, 8]], [[0, 0, 0, 16, 8, 16], [8, 8, 0, 16, 16, 16]],
  [[0, 0, 0, 16, 8, 16], [0, 8, 8, 16, 16, 16]], [[0, 0, 0, 16, 8, 16], [0, 8, 0, 8, 16, 16]]];
for (const [base, title, snd] of ST) {
  const src = BLOCKS[B[base]];
  for (let f = 0; f < 4; f++) {
    const b = def('stairs_' + base + '_' + f, title, { shape: SHAPE.BOX, boxes: STB[f], opaque: false, opac: 0, hardness: src.hardness, tool: src.tool, needsTool: src.needsTool, sound: snd, item: 'stairs_' + base, drops: 'stairs_' + base, facing: f, creative: f === 0 });
    b.faceTiles = src.faceTiles.slice(); b.tile = src.tile;
  }
}
// двери: lo/hi × ориентация(0/1) × open
for (let h = 0; h < 2; h++) for (let pl = 0; pl < 2; pl++) for (let op = 0; op < 2; op++) {
  const plane = pl ^ op;
  def(`door_${h ? 'hi' : 'lo'}_${pl}_${op}`, 'Дубовая дверь', { t: h ? 'door_top' : 'door_bottom', shape: SHAPE.BOX, boxes: [plane === 0 ? [0, 0, 0, 16, 16, 3] : [0, 0, 0, 3, 16, 16]], opaque: false, opac: 0, hardness: 2, tool: 'axe', sound: 'wood', layer: LAYER.CUTOUT, item: 'door', drops: h ? null : 'door', creative: false, support: h ? 'doorTop' : 'solid' });
}
def('glass_pane', 'Стеклянная панель', { t: 'glass', shape: SHAPE.PANE, opaque: false, opac: 0, hardness: 0.3, sound: 'glass', layer: LAYER.TRANS, drops: null });
// жидкости: 0=источник, 1..7 течение, 8=падающая
for (const fam of ['water', 'lava']) {
  for (let l = 0; l <= 8; l++) {
    def(fam + '_' + l, fam === 'water' ? 'Вода' : 'Лава', {
      t: fam + '_0', shape: SHAPE.LIQUID, solid: false, opaque: false, opac: fam === 'water' ? 2 : 0, emit: fam === 'lava' ? 15 : 0, hardness: -1, sound: 'water',
      layer: fam === 'water' ? LAYER.TRANS : LAYER.OPAQUE, tint: fam === 'water' ? TINT.WATER : TINT.NONE, anim: fam === 'water' ? 1 : 2,
      replaceable: true, selectable: false, creative: false, drops: null, family: fam, liquid: l, item: fam,
    });
  }
}
B.water = B.water_0; B.lava = B.lava_0;
// новые блоки — только в конец, чтобы не сдвинуть id в сохранённых мирах
def('shop_counter', 'Касса автосалона', { t: { top: 'shop_top', side: 'shop_side' }, hardness: -1, sound: 'wood', drops: null, emit: 6 });

export const N_BLOCKS = BLOCKS.length;
export const OPAQUE = new Uint8Array(N_BLOCKS), OPAC = new Uint8Array(N_BLOCKS), EMIT = new Uint8Array(N_BLOCKS), SOLID = new Uint8Array(N_BLOCKS);
export const LAYERS = new Uint8Array(N_BLOCKS), SHAPES = new Uint8Array(N_BLOCKS), TINTS = new Uint8Array(N_BLOCKS), ANIMS = new Uint8Array(N_BLOCKS), FAMILY = new Uint8Array(N_BLOCKS), LIQ = new Uint8Array(N_BLOCKS);
export const FACE_TILES = new Uint8Array(N_BLOCKS * 6);
for (const b of BLOCKS) {
  OPAQUE[b.id] = b.opaque ? 1 : 0; OPAC[b.id] = b.opac; EMIT[b.id] = b.emit; SOLID[b.id] = b.solid ? 1 : 0;
  LAYERS[b.id] = b.layer; SHAPES[b.id] = b.shape; TINTS[b.id] = b.tint; ANIMS[b.id] = b.anim;
  FAMILY[b.id] = b.family === 'water' ? 1 : b.family === 'lava' ? 2 : 0; LIQ[b.id] = b.liquid === null ? 0 : b.liquid;
  FACE_TILES.set(b.faceTiles, b.id * 6);
}
export const isWater = (id) => FAMILY[id] === 1;
export const isLava = (id) => FAMILY[id] === 2;
export const isLiquid = (id) => FAMILY[id] !== 0;
export const WATER0 = B.water_0, LAVA0 = B.lava_0;
export const blockByName = (n) => BLOCKS[B[n]];
