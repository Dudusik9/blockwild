// Список имён тайлов атласа 16x16 (порядок = индекс). Рисуются в textures.js.
export const WOODS = ['oak', 'birch', 'spruce', 'acacia', 'willow'];
export const WOODS_RU = { oak: 'Дубовый', birch: 'Берёзовый', spruce: 'Еловый', acacia: 'Акациевый', willow: 'Ивовый' };
export const WOOLS = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black'];
export const WOOLS_RU = { white: 'белая', red: 'красная', orange: 'оранжевая', yellow: 'жёлтая', green: 'зелёная', blue: 'синяя', purple: 'фиолетовая', black: 'чёрная' };
export const TIERS = ['wood', 'stone', 'iron', 'crystal'];
export const TOOLS = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];
export const ARMOR_MATS = ['hide', 'iron', 'crystal'];
export const ARMOR_PARTS = ['helmet', 'chest', 'legs', 'boots'];
export const FLOWERS = ['poppy', 'dandelion', 'cornflower', 'lilac'];

const n = [];
n.push('grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'mossy_cobble', 'gravel', 'sand', 'sandstone_top', 'sandstone_side',
  'clay', 'snow', 'ice', 'basalt', 'stone_brick', 'brick', 'volcanic', 'glass', 'podzol_top', 'podzol_side');
for (const w of WOODS) n.push('log_' + w + '_side', 'log_' + w + '_top', 'planks_' + w, 'leaves_' + w, 'sapling_' + w);
n.push('ore_coal', 'ore_copper', 'ore_iron', 'ore_gold', 'ore_crystal',
  'block_coal', 'block_copper', 'block_iron', 'block_gold', 'block_crystal');
n.push('workbench_top', 'workbench_side', 'workbench_front', 'furnace_front', 'furnace_front_on', 'furnace_side', 'furnace_top',
  'chest_front', 'chest_side', 'chest_top', 'torch', 'lumen', 'keg_side', 'keg_top', 'keg_bottom');
for (const c of WOOLS) n.push('wool_' + c);
n.push('cactus_side', 'cactus_top', 'reed', 'tall_grass', 'fern', 'dead_bush', 'farmland_top', 'door_bottom', 'door_top', 'glass_pane_edge');
for (const f of FLOWERS) n.push('flower_' + f);
for (let i = 0; i < 8; i++) n.push('wheat_' + i);
// предметы
n.push('i_stick', 'i_coal', 'i_charcoal', 'i_copper_ingot', 'i_iron_ingot', 'i_gold_ingot', 'i_crystal', 'i_clay_ball', 'i_brick',
  'i_apple', 'i_bread', 'i_wheat', 'i_seeds', 'i_raw_mutton', 'i_cooked_mutton', 'i_raw_chicken', 'i_cooked_chicken', 'i_raw_pork', 'i_cooked_pork',
  'i_egg', 'i_feather', 'i_hide', 'i_bone', 'i_powder', 'i_shears', 'i_flint_steel', 'i_arrow');
// питомцы, машинка, эффекты
n.push('i_fish', 'i_dog_treat', 'i_spawn_kitten', 'i_spawn_puppy', 'i_car_key', 'fx_heart', 'fx_star');
for (const t of TIERS) for (const k of TOOLS) n.push('i_' + t + '_' + k);
for (const m of ARMOR_MATS) for (const p of ARMOR_PARTS) n.push('i_' + m + '_' + p);
export const WATER_BASE = 240, LAVA_BASE = 248;
export const TILE_NAMES = n;
export const TILE_INDEX = {};
n.forEach((nm, i) => { TILE_INDEX[nm] = i; });
for (let i = 0; i < 8; i++) { TILE_INDEX['water_' + i] = WATER_BASE + i; TILE_INDEX['lava_' + i] = LAVA_BASE + i; }
if (n.length > 240) throw new Error('Слишком много тайлов: ' + n.length);
export const tile = (name) => { const t = TILE_INDEX[name]; if (t === undefined) throw new Error('нет тайла ' + name); return t; };
