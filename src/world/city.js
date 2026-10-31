// Бесконечный «Город спасателей»: плоская земля, кварталы с домами и парками, дороги, реки с мостами.
// Всё — чистая функция мировых координат и seed: каждый чанк заново строит пересекающие его кварталы
// и пишет только свои блоки, поэтому постройки на стыках чанков совпадают. Работает в воркере (без DOM).
import { B } from './blocks.js';
import { BIOME } from './biomes.js';
import { mulberry32, hash2 } from '../core/noise.js';
import { placeTree } from './structures.js';
import { FLOWERS } from '../render/tilenames.js';
import { buildTower, PAW9 } from './build.js';
import { I } from '../game/items.js';

export const CITY_G = 64;          // уровень земли
const S = 32, ROAD = 5;            // клетка квартала и ширина дороги
const mod = (a, n) => ((a % n) + n) % n;
const WALLS = ['wool_yellow', 'wool_green', 'wool_orange', 'wool_blue', 'wool_purple', 'wool_red', 'wool_white'];
// База спасателей (версия города 2): кварталы 0..2 × 0..2 — одна большая площадь внутри кольцевой дороги
export const BASE = {
  x0: ROAD, x1: 3 * S - 1, z0: ROAD, z1: 3 * S - 1, // площадь 5..95
  tower: { x: 50, z: 32, R: 9, s: 13, n: 5 },
  garages: [{ x: 10, z: 12, wool: 'wool_red' }, { x: 10, z: 28, wool: 'wool_blue' }, { x: 10, z: 44, wool: 'wool_yellow' }], // 9×9, ворота на восток
  heli: { x: 80, z: 30 },
  shop: { x0: 74, x1: 92, z0: 56, z1: 68 }, // вход на запад
  pad: { x: 67, z: 62 },
  spawn: { x: 50.5, z: 98.5 },
};
const inBase = (gen, x, z, m = 0) => gen.cityVer >= 2 && x >= BASE.x0 - m && x <= BASE.x1 + m && z >= BASE.z0 - m && z <= BASE.z1 + m;

export function cityRiver(gen, x, z) {
  if (inBase(gen, x, z, 14)) return false; // у базы рек нет
  return Math.abs(gen.sRiver.fbm2(x / 350, z / 350, 3)) < 0.03;
}

export function generateCity(gen, cx, cz) {
  const G = CITY_G, seed = gen.seed;
  const blocks = new Uint16Array(65536), biomes = new Uint8Array(256).fill(BIOME.MEADOW), heights = new Uint8Array(256);
  const ox = cx * 16, oz = cz * 16;
  const idx = (lx, y, lz) => (y << 8) | (lz << 4) | lx;
  const W = {
    get: (x, y, z) => { const lx = x - ox, lz = z - oz; return lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y > 255 ? 0 : blocks[idx(lx, y, lz)]; },
    set: (x, y, z, id) => { const lx = x - ox, lz = z - oz; if (lx >= 0 && lx <= 15 && lz >= 0 && lz <= 15 && y >= 0 && y <= 255) blocks[idx(lx, y, lz)] = id; },
  };
  // реки с рамкой в 1 блок — для берегов
  const riv = new Uint8Array(18 * 18);
  for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) riv[(z + 1) * 18 + x + 1] = cityRiver(gen, ox + x, oz + z) ? 1 : 0;
  const isRiv = (lx, lz) => riv[(lz + 1) * 18 + lx + 1] === 1;

  // ---- земля, дороги, тротуары, реки
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const wx = ox + x, wz = oz + z, lx = mod(wx, S), lz = mod(wz, S);
    blocks[idx(x, 0, z)] = B.basalt;
    for (let y = 1; y <= G - 4; y++) blocks[idx(x, y, z)] = B.stone;
    for (let y = G - 3; y < G; y++) blocks[idx(x, y, z)] = B.dirt;
    const roadX = lz < ROAD, roadZ = lx < ROAD, road = roadX || roadZ; // roadX — дорога вдоль x
    if (isRiv(x, z)) {
      blocks[idx(x, G - 2, z)] = B.clay; blocks[idx(x, G - 1, z)] = B.water_0;
      if (road) {
        blocks[idx(x, G, z)] = B.planks_oak; // мост вровень с дорогой
        const edge = (roadX && !roadZ && (lz === 0 || lz === ROAD - 1)) || (roadZ && !roadX && (lx === 0 || lx === ROAD - 1));
        if (edge) blocks[idx(x, G + 1, z)] = mod(roadX ? wx : wz, 4) === 0 ? B.planks_oak : B.wool_red;
      } else blocks[idx(x, G, z)] = B.water_0;
      continue;
    }
    let top = B.grass;
    if (inBase(gen, wx, wz)) top = B.stone_brick; // площадь базы
    else if (road) {
      top = B.stone;
      if (roadX && !roadZ && lz === 2 && mod(wx, 6) < 3) top = B.wool_white;
      if (roadZ && !roadX && lx === 2 && mod(wz, 6) < 3) top = B.wool_white;
    } else if (lx === ROAD || lx === S - 1 || lz === ROAD || lz === S - 1) top = B.stone_brick;
    else if (isRiv(x - 1, z) || isRiv(x + 1, z) || isRiv(x, z - 1) || isRiv(x, z + 1)) top = B.stone_brick; // берег
    blocks[idx(x, G, z)] = top;
  }

  // ---- кварталы, пересекающие чанк
  for (let ci = Math.floor(ox / S); ci <= Math.floor((ox + 15) / S); ci++) for (let cj = Math.floor(oz / S); cj <= Math.floor((oz + 15) / S); cj++) {
    if (gen.cityVer >= 2 && ci >= 0 && ci <= 2 && cj >= 0 && cj <= 2) continue; // кварталы базы
    buildLot(gen, W, ci, cj, seed);
  }
  const bes = [];
  if (gen.cityVer >= 2 && ox <= BASE.x1 + 12 && ox + 15 >= BASE.x0 - 12 && oz <= BASE.z1 + 12 && oz + 15 >= BASE.z0 - 12) buildBase(W, bes, ox, oz);

  // ---- руды в камне
  const rnd = mulberry32(hash2(cx, cz, seed ^ 0x5bd1e995) * 4294967296);
  const vein = (id, count, size, y0, y1) => {
    for (let n = 0; n < count; n++) {
      let x = (rnd() * 16) | 0, y = y0 + ((rnd() * (y1 - y0)) | 0), z = (rnd() * 16) | 0;
      const sz = 2 + ((rnd() * size) | 0);
      for (let k = 0; k < sz; k++) {
        if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 4 && y < G - 4 && blocks[idx(x, y, z)] === B.stone) blocks[idx(x, y, z)] = id;
        x += ((rnd() * 3) | 0) - 1; y += ((rnd() * 3) | 0) - 1; z += ((rnd() * 3) | 0) - 1;
      }
    }
  };
  vein(B.ore_coal, 20, 9, 5, 58); vein(B.ore_copper, 14, 7, 5, 58); vein(B.ore_iron, 12, 6, 5, 50); vein(B.ore_gold, 4, 5, 5, 32); vein(B.ore_crystal, 3, 4, 5, 18);

  return { blocks, biomes, heights, bes, maxY: 0 };
}

// ---------- база спасателей ----------
function buildBase(W, bes, ox, oz) {
  const G = CITY_G, y0 = G + 1, set = W.set;
  const inChunk = (x, z) => x >= ox && x < ox + 16 && z >= oz && z < oz + 16;
  // фонари по краю площади и клумбы
  for (let t = BASE.x0 + 5; t <= BASE.x1 - 5; t += 10) for (const [x, z] of [[t, BASE.z0 + 1], [t, BASE.z1 - 1], [BASE.x0 + 1, t], [BASE.x1 - 1, t]]) {
    if (z === BASE.z1 - 1 && x >= 43 && x <= 57) continue; // не загораживать арку
    set(x, y0, z, B.log_birch); set(x, y0 + 1, z, B.log_birch); set(x, y0 + 2, z, B.lumen);
  }
  for (const [cx, cz] of [[22, 88], [78, 88], [30, 60], [90, 44]]) { // клумбы с деревцем
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      set(cx + dx, G, cz + dz, Math.max(Math.abs(dx), Math.abs(dz)) === 2 ? B.stone_brick : B.grass);
      if (Math.max(Math.abs(dx), Math.abs(dz)) === 1) set(cx + dx, y0, cz + dz, B['flower_' + FLOWERS[(Math.abs(dx * 3 + dz)) % FLOWERS.length]]);
    }
    placeTree(W, 'oak', cx, y0, cz, mulberry32(cx * 31 + cz));
  }
  // большая лапка: белый круг и лапка ×2
  const px = 50, pz = 70;
  for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) if (dx * dx + dz * dz <= 132) set(px + dx, G, pz + dz, B.wool_white);
  PAW9.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) set(px - 9 + i * 2 + a, G, pz - 9 + j * 2 + b, B.wool_blue); }));
  // башня
  const T = BASE.tower; buildTower(set, T.x, T.z, y0, G, T);
  // сундуки у входа в башню
  const door = T.z + T.R + 2;
  const chest = (x, z, items) => {
    set(x, y0, z, B.chest_2);
    if (!inChunk(x, z)) return;
    const slots = new Array(27).fill(null); items.forEach(([n, c], i) => { if (I[n] !== undefined) slots[i] = { id: I[n], count: c, dmg: 0 }; });
    bes.push({ type: 'chest', x, y: y0, z, slots });
  };
  chest(T.x - 4, door, [['fish', 16], ['dog_treat', 16], ['spawn_kitten', 2], ['spawn_puppy', 2], ['apple', 8], ['bread', 8]]);
  chest(T.x + 4, door, [['wool_red', 64], ['wool_blue', 64], ['wool_yellow', 64], ['wool_green', 64], ['wool_white', 64], ['glass', 64], ['planks_oak', 64], ['door', 4], ['lumen', 16]]);
  // гаражи щенков: ворота на восток
  for (const g of BASE.garages) {
    const wool = B[g.wool];
    for (let x = 0; x < 9; x++) for (let z = 0; z < 9; z++) {
      const edge = x === 0 || x === 8 || z === 0 || z === 8;
      set(g.x + x, G, g.z + z, B.planks_oak);
      for (let y = y0; y < y0 + 4; y++) set(g.x + x, y, g.z + z, edge ? wool : 0);
      set(g.x + x, y0 + 4, g.z + z, edge ? B.wool_white : B.slab_brick);
    }
    for (let z = 2; z <= 6; z++) for (let y = y0; y < y0 + 3; y++) set(g.x + 8, y, g.z + z, 0); // ворота
    for (let z = 2; z <= 6; z++) set(g.x + 8, y0 + 3, g.z + z, B.wool_yellow);
    set(g.x + 4, y0 + 3, g.z + 4, B.lumen); set(g.x + 2, y0, g.z + 4, wool); // лежанка
  }
  // вертолётная площадка: белый круг с жёлтой «H»
  const Hh = BASE.heli;
  for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) {
    const d = dx * dx + dz * dz;
    if (d <= 52) set(Hh.x + dx, G, Hh.z + dz, d >= 38 ? B.wool_yellow : B.wool_white);
  }
  for (let dz = -3; dz <= 3; dz++) { set(Hh.x - 2, G, Hh.z + dz, B.wool_yellow); set(Hh.x + 2, G, Hh.z + dz, B.wool_yellow); }
  for (let dx = -1; dx <= 1; dx++) set(Hh.x + dx, G, Hh.z, B.wool_yellow);
  for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) set(Hh.x + dx, y0, Hh.z + dz, B.lumen);
  // магазин «Автосалон»: белые стены с синей полосой, стеклянная витрина на запад, красная крыша
  const Sh = BASE.shop;
  for (let x = Sh.x0; x <= Sh.x1; x++) for (let z = Sh.z0; z <= Sh.z1; z++) {
    const edge = x === Sh.x0 || x === Sh.x1 || z === Sh.z0 || z === Sh.z1, corner = (x === Sh.x0 || x === Sh.x1) && (z === Sh.z0 || z === Sh.z1);
    set(x, G, z, (x + z) % 2 ? B.wool_white : B.wool_black);
    for (let y = y0; y < y0 + 5; y++) {
      let id = 0;
      if (edge) id = corner ? B.wool_blue : y === y0 + 3 ? B.wool_blue : (x === Sh.x0 && y < y0 + 3) ? B.glass : B.wool_white;
      set(x, y, z, id);
    }
    set(x, y0 + 5, z, edge ? B.wool_red : B.wool_white);
  }
  for (let x = Sh.x0 - 1; x <= Sh.x1 + 1; x++) for (let z = Sh.z0 - 1; z <= Sh.z1 + 1; z++) set(x, y0 + 6, z, B.wool_red); // крыша с навесом
  const midZ = (Sh.z0 + Sh.z1) >> 1;
  for (let z = midZ - 1; z <= midZ + 1; z++) for (let y = y0; y < y0 + 3; y++) set(Sh.x0, y, z, 0); // вход
  for (let z = Sh.z0 + 2; z <= Sh.z1 - 2; z++) set(Sh.x0 + 11, y0, z, B.slab_planks_oak); // прилавок
  set(Sh.x0 + 11, y0, midZ, B.shop_counter);
  set(Sh.x0 + 11, y0 + 1, midZ, B.lumen);
  for (const z of [Sh.z0 + 3, Sh.z1 - 3]) set(Sh.x0 + 5, y0 + 4, z, B.lumen);
  // вывеска над входом: красная машинка на белом
  for (let dz = -3; dz <= 3; dz++) for (let dy = 0; dy < 3; dy++) set(Sh.x0 - 1, y0 + 3 + dy, midZ + dz, B.wool_white);
  for (let dz = -2; dz <= 2; dz++) set(Sh.x0 - 1, y0 + 4, midZ + dz, B.wool_red);
  set(Sh.x0 - 1, y0 + 5, midZ, B.wool_red); set(Sh.x0 - 1, y0 + 5, midZ - 1, B.wool_red);
  set(Sh.x0 - 1, y0 + 3, midZ - 2, B.wool_black); set(Sh.x0 - 1, y0 + 3, midZ + 2, B.wool_black);
  // площадка выдачи у магазина
  const P = BASE.pad;
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) set(P.x + dx, G, P.z + dz, Math.max(Math.abs(dx), Math.abs(dz)) === 3 ? ((dx + dz) % 2 ? B.wool_yellow : B.wool_black) : B.stone);
  // арка у южного входа на площадь
  for (const x of [44, 56]) for (let y = y0; y < y0 + 6; y++) set(x, y, BASE.z1 - 1, (y - y0) % 2 ? B.wool_white : B.wool_red);
  for (let x = 44; x <= 56; x++) set(x, y0 + 6, BASE.z1 - 1, x % 2 ? B.wool_blue : B.wool_red);
  set(50, y0 + 7, BASE.z1 - 1, B.lumen);
}

function lotKind(gen, ci, cj, seed) {
  const x0 = ci * S, z0 = cj * S;
  for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) if (cityRiver(gen, x0 + ROAD + 1 + a * 6, z0 + ROAD + 1 + b * 6)) return 'riverpark';
  const r = hash2(ci, cj, seed + 4242);
  return r < 0.45 ? 'houses' : r < 0.75 ? 'park' : r < 0.85 ? 'plaza' : 'station';
}

function buildLot(gen, W, ci, cj, seed) {
  const G = CITY_G, x0 = ci * S, z0 = cj * S, rnd = mulberry32((hash2(ci, cj, seed + 77) * 4294967296) | 0);
  const kind = lotKind(gen, ci, cj, seed);
  const X = (u) => x0 + u, Z = (v) => z0 + v; // u, v — координаты внутри квартала (6..30 — участок)
  const set = (u, y, v, id) => W.set(X(u), y, Z(v), id);
  const ground = (u, v) => W.get(X(u), G, Z(v));
  // фонари на углах тротуара
  for (const [u, v] of [[ROAD, ROAD], [S - 1, ROAD], [ROAD, S - 1], [S - 1, S - 1]]) {
    if (cityRiver(gen, X(u), Z(v))) continue;
    set(u, G + 1, v, B.log_birch); set(u, G + 2, v, B.log_birch); set(u, G + 3, v, B.lumen);
  }
  const flowers = (p) => {
    for (let u = ROAD + 1; u < S - 1; u++) for (let v = ROAD + 1; v < S - 1; v++) {
      const r = rnd(), f = rnd();
      if (r < p && ground(u, v) === B.grass && W.get(X(u), G + 1, Z(v)) === 0 && !cityRiver(gen, X(u), Z(v))) set(u, G + 1, v, B['flower_' + FLOWERS[(f * FLOWERS.length) | 0]]);
    }
  };
  if (kind === 'houses') {
    for (const [hu, hv, face] of [[8, 8, 'n'], [19, 8, 'n'], [8, 19, 's'], [19, 19, 's']]) buildHouse(set, hu, hv, face, rnd);
    flowers(0.05);
  } else if (kind === 'park' || kind === 'riverpark') {
    // занятые места — только по координатам (не по блокам), чтобы решение совпадало во всех чанках
    const busy = [];
    if (kind === 'park') {
      for (let t = ROAD + 1; t < S - 1; t++) for (const c of [17, 18, 19]) { set(c, G, t, B.gravel); set(t, G, c, B.gravel); }
      busy.push((u, v) => Math.abs(u - 18) <= 2 || Math.abs(v - 18) <= 2);
      // пруд в случайной четверти
      const pu = rnd() < 0.5 ? 10 : 26, pv = rnd() < 0.5 ? 10 : 26;
      for (let du = -2; du <= 2; du++) for (let dv = -3; dv <= 3; dv++) { set(pu + du, G - 2, pv + dv, B.sand); set(pu + du, G - 1, pv + dv, B.water_0); set(pu + du, G, pv + dv, B.water_0); }
      busy.push((u, v) => Math.abs(u - pu) <= 3 && Math.abs(v - pv) <= 4);
      // песочница в противоположной четверти
      const su = pu === 10 ? 26 : 10, sv = pv === 10 ? 26 : 10;
      for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) set(su + du, G, sv + dv, Math.max(Math.abs(du), Math.abs(dv)) === 2 ? B.planks_oak : B.sand);
      busy.push((u, v) => Math.abs(u - su) <= 3 && Math.abs(v - sv) <= 3);
      // скамейки у дорожек
      for (const [u, v, f] of [[16, 11, 1], [20, 24, 3]]) { set(u, G + 1, v, B['stairs_planks_oak_' + f]); set(u, G + 1, v + 1, B['stairs_planks_oak_' + f]); }
    }
    busy.push((u, v) => { for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) if (cityRiver(gen, X(u + du), Z(v + dv))) return true; return false; });
    const n = kind === 'park' ? 10 : 8;
    for (let k = 0; k < n; k++) {
      const u = 9 + ((rnd() * 19) | 0), v = 9 + ((rnd() * 19) | 0), ty = rnd(), tr = rnd();
      const type = ty < 0.5 ? 'oak' : ty < 0.85 ? 'birch' : 'bigoak';
      if (type === 'bigoak' && (u < 12 || u > 24 || v < 12 || v > 24)) continue;
      if (busy.some((f) => f(u, v))) continue;
      placeTree(W, type, X(u), G + 1, Z(v), mulberry32((tr * 4294967296) | 0));
    }
    flowers(kind === 'park' ? 0.07 : 0.05);
  } else if (kind === 'plaza') {
    for (let u = ROAD + 1; u < S - 1; u++) for (let v = ROAD + 1; v < S - 1; v++) set(u, G, v, B.stone_brick);
    for (let u = 13; u <= 23; u++) for (let v = 13; v <= 23; v++) if ((u - 18) ** 2 + (v - 18) ** 2 <= 27) set(u, G, v, B.wool_white);
    PAW9.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') set(14 + i, G, 14 + j, B.wool_blue); }));
    for (const [cu, cv] of [[10, 10], [26, 26]]) { // два фонтана
      for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) {
        if (Math.max(Math.abs(du), Math.abs(dv)) === 2) set(cu + du, G + 1, cv + dv, B.stone_brick);
        else { set(cu + du, G - 1, cv + dv, B.stone_brick); set(cu + du, G, cv + dv, B.water_0); }
      }
      for (let y = G; y <= G + 2; y++) set(cu, y, cv, B.stone_brick); set(cu, G + 3, cv, B.lumen);
    }
    for (const [u, v] of [[10, 26], [26, 10]]) { set(u, G + 1, v, B.log_birch); set(u, G + 2, v, B.log_birch); set(u, G + 3, v, B.lumen); }
  } else if (kind === 'station') buildStation(set, rnd);
}

// домик 9×9: дверь на север (n) или юг (s), к ближайшей дороге
function buildHouse(set, hu, hv, face, rnd) {
  const G = CITY_G, y0 = G + 1, wall = B[WALLS[(rnd() * WALLS.length) | 0]], roof = rnd() < 0.6 ? B.brick : B.planks_spruce, H = 3 + (rnd() < 0.3 ? 1 : 0);
  for (let x = 0; x < 9; x++) for (let z = 0; z < 9; z++) {
    set(hu + x, G, hv + z, B.planks_oak);
    const edge = x === 0 || x === 8 || z === 0 || z === 8, corner = (x === 0 || x === 8) && (z === 0 || z === 8);
    for (let y = y0; y < y0 + H; y++) set(hu + x, y, hv + z, edge ? (corner ? B.log_oak : wall) : 0);
    if (edge && !corner && (x === 2 || x === 6 || z === 2 || z === 6)) set(hu + x, y0 + 1, hv + z, B.glass_pane);
  }
  for (let k = 0; k < 5; k++) for (let x = -1 + k; x <= 9 - k; x++) for (let z = -1 + k; z <= 9 - k; z++) set(hu + x, y0 + H + k, hv + z, roof);
  set(hu + 4, y0 + H, hv + 4, B.lumen);
  const dz = face === 'n' ? 0 : 8, step = face === 'n' ? -1 : 1;
  set(hu + 4, y0, hv + dz, B.door_lo_0_0); set(hu + 4, y0 + 1, hv + dz, B.door_hi_0_0);
  for (let z = hv + dz + step; z > ROAD && z < S - 1; z += step) set(hu + 4, G, z, B.gravel);
  set(hu + 1, y0, hv + (face === 'n' ? 7 : 1), B.workbench);
}

// пожарная часть: двухэтажное кирпичное здание с широкими воротами на юг
function buildStation(set, rnd) {
  const G = CITY_G, y0 = G + 1, u0 = 10, v0 = 9, w = 17, d = 15, H = 8;
  for (let u = ROAD + 1; u < S - 1; u++) for (let v = ROAD + 1; v < S - 1; v++) set(u, G, v, B.stone_brick);
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
    for (let y = y0; y < y0 + H; y++) set(u0 + x, y, v0 + z, edge ? (y === y0 + 4 ? B.wool_white : B.brick) : (y === y0 + 4 ? B.planks_oak : 0));
    set(u0 + x, y0 + H, v0 + z, x === 0 || x === w - 1 || z === 0 || z === d - 1 ? B.wool_red : B.slab_brick);
    if (edge && (x % 3 === 1 || z % 3 === 1) && !(z === d - 1 && x >= 5 && x <= 11)) set(u0 + x, y0 + 6, v0 + z, B.glass_pane);
  }
  // ворота 5×4 и красная рамка
  for (let x = 6; x <= 10; x++) for (let y = y0; y < y0 + 4; y++) set(u0 + x, y, v0 + d - 1, 0);
  for (let x = 5; x <= 11; x++) set(u0 + x, y0 + 4, v0 + d - 1, B.wool_red);
  for (let y = y0; y < y0 + 4; y++) { set(u0 + 5, y, v0 + d - 1, B.wool_red); set(u0 + 11, y, v0 + d - 1, B.wool_red); }
  for (let x = 1; x < w - 1; x++) for (let z = 1; z < d - 1; z++) set(u0 + x, G, v0 + z, B.stone);
  for (let v = v0 + d; v < S - 1; v++) for (let x = 6; x <= 10; x++) set(u0 + x, G, v, B.stone);
  set(u0 + 8, y0 + 3, v0 + 7, B.lumen); set(u0 + 8, y0 + 7, v0 + 7, B.lumen);
  if (rnd() < 0.5) for (let y = y0 + H + 1; y <= y0 + H + 3; y++) set(u0 + 1, y, v0 + 1, B.brick); // труба
}
