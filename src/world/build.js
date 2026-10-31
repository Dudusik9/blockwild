// Общие постройки спасателей (без DOM, работают и в воркере генерации). set(x, y, z, id) — абсолютные координаты.
import { B } from './blocks.js';

export const PAW9 = ['..XX.XX..', '..XX.XX..', 'XX.....XX', 'XX.....XX', '...XXX...', '..XXXXX..', '.XXXXXXX.', '.XXXXXXX.', '..XX.XX..'];
export const PAW5 = ['.X.X.', 'X...X', '.....', '.XXX.', '.XXX.'];

// Клетки винтовой лестницы по периметру квадрата (2n+1)², от входа (юг) по часовой; полблока на клетку
export function towerRing(n) {
  const ring = [];
  for (let x = 0; x >= -n; x--) ring.push([x, n]);
  for (let z = n - 1; z >= -n; z--) ring.push([-n, z]);
  for (let x = -n + 1; x <= n; x++) ring.push([x, -n]);
  for (let z = -n + 1; z <= n; z++) ring.push([n, z]);
  for (let x = n - 1; x >= 1; x--) ring.push([x, n]);
  return ring;
}

// Башня спасателей: восьмиугольник (R — полуширина, s — срез углов), внутри винтовая лестница
// из полублоков вокруг светлой колонны (n — полуразмер лестничного квадрата), смотровая кабина, красная крыша.
// Возвращает уровень площадки TOP.
export function buildTower(set, tx, tz, y0, H, cfg = {}) {
  const R = cfg.R || 5, s = cfg.s || R + 2, n = cfg.n || 3;
  const ab = Math.abs, oct = (x, z, r, q) => Math.max(ab(x), ab(z)) <= r && ab(x) + ab(z) <= q;
  const ring = towerRing(n), N = ring.length; // N = 8n
  const TOP = y0 + 4 * n - 1;
  const faceHalf = s - R; // полуширина прямой грани
  for (let x = -R - 1; x <= R + 1; x++) for (let z = -R - 1; z <= R + 1; z++) {
    if (!oct(x, z, R, s)) continue;
    set(tx + x, H, tz + z, B.stone_brick);
    if (Math.max(ab(x), ab(z)) <= n) continue;
    for (let y = y0; y < TOP; y++) {
      const k = y - y0;
      let id = k < 2 ? B.stone_brick : k === 2 ? B.wool_blue : B.wool_white;
      const face = (ab(x) <= 1 && ab(z) >= R - 1) || (ab(z) <= 1 && ab(x) >= R - 1);
      if (face && (k % 5 === 3 || k % 5 === 4) && !(z > 0 && ab(x) <= faceHalf)) id = B.glass;
      set(tx + x, y, tz + z, id);
    }
  }
  // дверной проём на юг, 3 блока высотой (сразу за ним ступень)
  for (let z = n + 1; z <= R; z++) for (let y = y0; y <= y0 + 2; y++) set(tx, y, tz + z, 0);
  set(tx, y0 + 3, tz + R, B.wool_blue);
  // лапка на южной грани
  const paw = faceHalf >= 4 ? PAW9 : PAW5, pw = paw.length, ph = (pw - 1) >> 1;
  paw.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') set(tx + i - ph, TOP - 1 - j, tz + R, B.wool_blue); }));
  // колонна со светокамнями
  for (let x = -(n - 1); x <= n - 1; x++) for (let z = -(n - 1); z <= n - 1; z++) for (let y = y0; y < TOP; y++) {
    const edge = Math.max(ab(x), ab(z)) === n - 1 && (ab(x) === 0 || ab(z) === 0);
    set(tx + x, y, tz + z, edge && (y - y0) % 4 === 2 ? B.lumen : B.wool_white);
  }
  // ступени
  ring.forEach(([x, z], k) => {
    const half = k + 1, full = half >> 1;
    for (let y = y0; y < y0 + full; y++) set(tx + x, y, tz + z, B.planks_spruce);
    if (half & 1) set(tx + x, y0 + full, tz + z, B.slab_planks_spruce);
  });
  // площадка с проёмом (запас под голову на последних ступенях)
  const hole = new Set(ring.slice(N - 7, N - 1).map(([x, z]) => x + ',' + z));
  for (let x = -R - 1; x <= R + 1; x++) for (let z = -R - 1; z <= R + 1; z++) {
    if (!oct(x, z, R + 1, s + 1) || hole.has(x + ',' + z)) continue;
    set(tx + x, TOP, tz + z, B.planks_spruce);
    if (!oct(x, z, R, s)) set(tx + x, TOP + 1, tz + z, B.glass_pane);
  }
  // смотровая кабина: стекло, проёмы на 4 стороны
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    if (!oct(x, z, R - 1, s - 1) || oct(x, z, R - 2, s - 2) || hole.has(x + ',' + z)) continue;
    const gap = x === 0 || z === 0;
    for (let y = TOP + 1; y <= TOP + 3; y++) set(tx + x, y, tz + z, gap && y <= TOP + 2 ? 0 : B.glass);
  }
  // красная крыша-конус
  let r = R, q = s, y = TOP + 4;
  while (r >= 1) {
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (oct(x, z, r, q)) set(tx + x, y, tz + z, x === 0 && z === 0 && y === TOP + 4 ? B.lumen : B.wool_red);
    r -= 2; q -= 3; y++;
  }
  for (let k = 1; k <= 4; k++) set(tx, y + k - 1, tz, B.block_iron);
  set(tx, y + 4, tz, B.lumen);
  for (let k = 2; k <= 3; k++) for (let x = 1; x <= 3; x++) set(tx + x, y + k, tz, B.wool_red);
  return TOP;
}
