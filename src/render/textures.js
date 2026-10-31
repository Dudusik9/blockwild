// Процедурный атлас текстур 16x16 (пиксель-арт). Всё рисуется кодом, внешних ассетов нет.
import { mulberry32, hash2 } from '../core/noise.js';
import { TILE_NAMES, TILE_INDEX, WOODS, WOOLS, TIERS, TOOLS, ARMOR_MATS, ARMOR_PARTS, FLOWERS, WATER_BASE, LAVA_BASE } from './tilenames.js';

export const ATLAS = 256, TS = 16;
const atlas = new Uint8Array(ATLAS * ATLAS * 4);
const hexc = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const mul = (c, f) => [clamp255(c[0] * f), clamp255(c[1] * f), clamp255(c[2] * f)];
const mix = (a, b, t) => [clamp255(a[0] + (b[0] - a[0]) * t), clamp255(a[1] + (b[1] - a[1]) * t), clamp255(a[2] + (b[2] - a[2]) * t)];
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

class Px {
  constructor(tile) { this.tx = (tile & 15) * TS; this.ty = (tile >> 4) * TS; }
  i(x, y) { return ((this.ty + y) * ATLAS + this.tx + x) * 4; }
  set(x, y, c, a = 255) { if (x < 0 || y < 0 || x > 15 || y > 15) return; const i = this.i(x, y); atlas[i] = c[0]; atlas[i + 1] = c[1]; atlas[i + 2] = c[2]; atlas[i + 3] = a; }
  get(x, y) { x = (x + 16) & 15; y = (y + 16) & 15; const i = this.i(x, y); return [atlas[i], atlas[i + 1], atlas[i + 2], atlas[i + 3]]; }
  alpha(x, y) { if (x < 0 || y < 0 || x > 15 || y > 15) return 0; return atlas[this.i(x, y) + 3]; }
  fill(c, a = 255) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, c, a); }
  clear() { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, [0, 0, 0], 0); }
  rect(x, y, w, h, c, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx - dy;
    for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } }
  }
  disc(cx, cy, r, c) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c); }
  outline(oc) { // тёмный контур вокруг непрозрачных пикселей
    const mark = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (this.alpha(x, y) === 0 && (this.alpha(x - 1, y) > 0 || this.alpha(x + 1, y) > 0 || this.alpha(x, y - 1) > 0 || this.alpha(x, y + 1) > 0)) mark.push([x, y]);
    }
    for (const [x, y] of mark) this.set(x, y, oc);
  }
}

// периодический value-noise 16x16
function vnoise(seed, scale = 4) {
  const r = mulberry32(seed), g = [];
  const n = 16 / scale;
  for (let i = 0; i < n * n; i++) g.push(r());
  return (x, y) => {
    const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[(iy % n) * n + (ix % n)], b = g[(iy % n) * n + ((ix + 1) % n)], c = g[((iy + 1) % n) * n + (ix % n)], d = g[((iy + 1) % n) * n + ((ix + 1) % n)];
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  };
}
function noiseFill(p, base, amp, r, a = 255) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, mul(base, 1 + (r() - 0.5) * 2 * amp), a); }
function blotchFill(p, c1, c2, seed, amp = 0.08, sc = 4) {
  const n = vnoise(seed, sc), r = mulberry32(seed + 1);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, mul(mix(c1, c2, n(x, y)), 1 + (r() - 0.5) * 2 * amp));
}
function speckle(p, c, count, r, a = 255) { for (let i = 0; i < count; i++) p.set((r() * 16) | 0, (r() * 16) | 0, c, a); }
function voronoi(p, n, r, colorFn, border) {
  const pts = []; for (let i = 0; i < n; i++) pts.push([r() * 16, r() * 16, r()]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let d1 = 1e9, d2 = 1e9, k = 0;
    for (let i = 0; i < n; i++) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
      const d = (x - pts[i][0] - ox) ** 2 + (y - pts[i][1] - oy) ** 2;
      if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1) < border;
    p.set(x, y, colorFn(pts[k][2], edge, x, y));
  }
}

const P = {}; // name -> painter(p, r)
const reg = (n, f) => { P[n] = f; };

// ---------- природа ----------
reg('grass_top', (p, r) => blotchFill(p, [150, 150, 150], [210, 210, 210], 11, 0.07, 4));
reg('grass_side', (p, r) => {
  noiseFill(p, [134, 96, 67], 0.12, r); speckle(p, [100, 70, 48], 10, r); speckle(p, [160, 120, 85], 6, r);
  for (let x = 0; x < 16; x++) {
    const hgt = 3 + ((r() * 3) | 0);
    for (let y = 0; y < hgt; y++) { const g = 150 + ((r() * 60) | 0); p.set(x, y, [g, g, g]); }
  }
});
reg('dirt', (p, r) => { noiseFill(p, [134, 96, 67], 0.1, r); speckle(p, [98, 68, 46], 14, r); speckle(p, [158, 118, 84], 8, r); speckle(p, [110, 110, 105], 3, r); });
reg('podzol_top', (p, r) => { blotchFill(p, [92, 64, 40], [122, 96, 62], 31, 0.1, 4); speckle(p, [70, 50, 32], 14, r); speckle(p, [140, 120, 80], 6, r); });
reg('podzol_side', (p, r) => {
  noiseFill(p, [134, 96, 67], 0.1, r); speckle(p, [100, 70, 48], 10, r);
  for (let x = 0; x < 16; x++) { const h = 3 + ((r() * 2) | 0); for (let y = 0; y < h; y++) p.set(x, y, mul([100, 76, 48], 0.9 + r() * 0.3)); }
});
reg('stone', (p, r) => {
  blotchFill(p, [118, 118, 120], [138, 138, 140], 41, 0.05, 4); speckle(p, [100, 100, 102], 14, r); speckle(p, [150, 150, 152], 8, r);
  for (let k = 0; k < 2; k++) { let x = (r() * 16) | 0, y = (r() * 16) | 0; for (let i = 0; i < 4; i++) { p.set(x, y, [96, 96, 98]); x += (r() * 3 | 0) - 1; y += (r() * 2 | 0); } }
});
function cobbleT(p, r, moss) {
  voronoi(p, 9, r, (v, edge) => (edge ? [70, 70, 72] : mul([125, 125, 128], 0.78 + v * 0.45)), 1.1);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = p.get(x, y); if (c[0] > 90 && r() < 0.15) p.set(x, y, mul(c, 1.1)); }
  if (moss) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (hash2(x, y, 99) < 0.35 && vnoise(5, 5)(x, y) > 0.5) { const c = p.get(x, y); p.set(x, y, mix(c, [82, 130, 54], 0.65)); }
}
reg('cobble', (p, r) => cobbleT(p, r, false));
reg('mossy_cobble', (p, r) => cobbleT(p, r, true));
reg('gravel', (p, r) => voronoi(p, 22, r, (v, edge) => (edge ? [92, 88, 86] : mul(v < 0.5 ? [140, 134, 130] : [110, 106, 108], 0.8 + v * 0.4)), 0.8));
reg('sand', (p, r) => { blotchFill(p, [214, 202, 156], [226, 215, 170], 51, 0.04, 4); speckle(p, [190, 176, 130], 14, r); speckle(p, [238, 228, 188], 8, r); });
reg('sandstone_top', (p, r) => { blotchFill(p, [212, 198, 150], [222, 210, 165], 52, 0.03, 4); speckle(p, [196, 182, 135], 8, r); });
reg('sandstone_side', (p, r) => {
  for (let y = 0; y < 16; y++) { const band = y % 5 === 0 ? 0.9 : (y % 7 === 3 ? 0.95 : 1); for (let x = 0; x < 16; x++) p.set(x, y, mul([214, 200, 152], band * (0.97 + r() * 0.06))); }
  p.rect(0, 0, 16, 1, [226, 214, 168]); speckle(p, [190, 175, 130], 6, r);
});
reg('clay', (p, r) => { blotchFill(p, [156, 162, 178], [170, 176, 190], 61, 0.03, 4); speckle(p, [140, 146, 162], 8, r); });
reg('snow', (p, r) => { noiseFill(p, [244, 248, 252], 0.025, r); speckle(p, [210, 224, 240], 8, r); });
reg('ice', (p, r) => {
  noiseFill(p, [150, 200, 240], 0.05, r, 190);
  for (let k = 0; k < 4; k++) { let x = (r() * 16) | 0, y = (r() * 16) | 0; for (let i = 0; i < 7; i++) { p.set(x, y, [225, 245, 255], 215); x++; y += (r() * 3 | 0) - 1; } }
});
reg('basalt', (p, r) => { blotchFill(p, [44, 44, 52], [62, 62, 72], 71, 0.12, 4); speckle(p, [26, 26, 32], 18, r); speckle(p, [80, 80, 92], 6, r); });
reg('volcanic', (p, r) => {
  blotchFill(p, [22, 14, 36], [44, 26, 70], 81, 0.08, 4);
  for (let k = 0; k < 3; k++) { let x = (r() * 8) | 0, y = (r() * 16) | 0; for (let i = 0; i < 8; i++) { p.set(x, y, [120, 80, 190]); x++; y += (r() * 3 | 0) - 1; } }
  speckle(p, [160, 120, 220], 4, r);
});
reg('stone_brick', (p, r) => {
  noiseFill(p, [128, 128, 130], 0.06, r);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = (y / 4) | 0, off = row % 2 ? 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) p.set(x, y, [82, 82, 86]);
    else if (y % 4 === 0) p.set(x, y, mul(p.get(x, y), 1.1));
  }
});
reg('brick', (p, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = (y / 4) | 0, off = row % 2 ? 4 : 0;
    if (y % 4 === 3 || (x + off) % 8 === 7) p.set(x, y, [176, 170, 160]);
    else p.set(x, y, mul([158, 72, 56], 0.88 + r() * 0.24));
  }
});
reg('glass', (p, r) => {
  p.clear(); p.rect(0, 0, 16, 16, [200, 230, 240], 45);
  for (let i = 0; i < 16; i++) { p.set(i, 0, [225, 240, 248], 230); p.set(i, 15, [195, 215, 228], 230); p.set(0, i, [225, 240, 248], 230); p.set(15, i, [195, 215, 228], 230); }
  p.line(3, 6, 6, 3, [255, 255, 255]); p.line(3, 9, 9, 3, [240, 250, 255]); p.line(9, 14, 13, 10, [240, 250, 255]);
});
reg('glass_pane_edge', (p, r) => { p.fill([200, 230, 240], 120); });

// ---------- дерево ----------
const WCOL = {
  oak: { bark: [102, 80, 50], ring: [172, 134, 84], plank: [172, 130, 80], leaf: 0.8 },
  birch: { bark: [216, 214, 204], ring: [214, 200, 148], plank: [216, 200, 146], leaf: 0.92 },
  spruce: { bark: [62, 44, 28], ring: [120, 90, 58], plank: [112, 82, 52], leaf: 0.55 },
  acacia: { bark: [112, 104, 96], ring: [190, 110, 66], plank: [178, 94, 54], leaf: 0.85 },
  willow: { bark: [84, 86, 62], ring: [150, 156, 108], plank: [140, 150, 100], leaf: 0.7 },
};
for (const w of WOODS) {
  const c = WCOL[w];
  reg('log_' + w + '_side', (p, r) => {
    for (let x = 0; x < 16; x++) { const col = 0.82 + r() * 0.3; for (let y = 0; y < 16; y++) p.set(x, y, mul(c.bark, col * (0.94 + r() * 0.12))); }
    for (let x = 0; x < 16; x += 3 + ((r() * 2) | 0)) for (let y = 0; y < 16; y++) if (r() < 0.8) p.set(x, y, mul(c.bark, 0.68));
    if (w === 'birch') for (let i = 0; i < 9; i++) { const x = (r() * 14) | 0, y = (r() * 16) | 0; p.rect(x, y, 2 + ((r() * 3) | 0), 1, [34, 32, 30]); }
    if (w === 'willow') speckle(p, [70, 110, 60], 8, r);
  });
  reg('log_' + w + '_top', (p, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.5) p.set(x, y, mul(c.bark, 0.85 + r() * 0.15));
      else p.set(x, y, mul(c.ring, (((d | 0) % 2) ? 0.82 : 1.05) * (0.95 + r() * 0.1)));
    }
  });
  reg('planks_' + w, (p, r) => {
    for (let y = 0; y < 16; y++) {
      const board = (y / 4) | 0, shade = 0.9 + hash2(board, 3, w.length * 31) * 0.2;
      for (let x = 0; x < 16; x++) {
        let f = shade * (0.95 + r() * 0.1);
        if (y % 4 === 3) f *= 0.72; if (y % 4 === 0) f *= 1.06;
        const joint = (x + board * 5) % 16;
        if (joint === 0 && y % 4 !== 3) f *= 0.8;
        p.set(x, y, mul(c.plank, f));
      }
    }
  });
  reg('leaves_' + w, (p, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const hole = hash2(x, y, w.length * 7 + 5) < 0.17;
      const v = (140 + r() * 100) * c.leaf * 1.15 | 0;
      if (hole) p.set(x, y, [v, v, v], 0); else p.set(x, y, [v, v, v], 255);
    }
    // тёмные пятна
    for (let i = 0; i < 18; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; if (p.alpha(x, y)) { const v = 100 * c.leaf | 0; p.set(x, y, [v, v, v]); } }
  });
}
function spriteBase(p) { p.clear(); }
const SAP = { oak: [78, 150, 52], birch: [112, 170, 70], spruce: [40, 100, 60], acacia: [120, 160, 50], willow: [90, 150, 90] };
for (const w of WOODS) reg('sapling_' + w, (p, r) => {
  spriteBase(p); const c = SAP[w], st = [96, 70, 40];
  p.line(8, 15, 8, 8, st); p.set(7, 14, st);
  for (const [x, y] of [[8, 4], [7, 5], [9, 5], [6, 6], [10, 6], [5, 7], [11, 7], [7, 7], [9, 7], [8, 6], [7, 9], [9, 9], [6, 8], [10, 8], [8, 5], [8, 3], [7, 4], [9, 4]]) p.set(x, y, mul(c, 0.8 + r() * 0.4));
});

// ---------- руды ----------
function oreT(p, r, col, dark, n = 7) {
  P.stone(p, mulberry32(7));
  for (let k = 0; k < n; k++) {
    const cx = 2 + ((r() * 12) | 0), cy = 2 + ((r() * 12) | 0), sz = 1 + ((r() * 2) | 0);
    for (let dx = -sz; dx <= sz; dx++) for (let dy = -sz; dy <= sz; dy++) if (dx * dx + dy * dy <= sz * sz + 0.5 && r() < 0.85) p.set(cx + dx, cy + dy, mul(col, 0.8 + r() * 0.4));
  }
  speckle(p, dark, 5, r);
}
reg('ore_coal', (p, r) => oreT(p, r, [34, 34, 38], [20, 20, 22], 7));
reg('ore_copper', (p, r) => oreT(p, r, [200, 118, 70], [90, 160, 130], 6));
reg('ore_iron', (p, r) => oreT(p, r, [214, 172, 146], [170, 120, 96], 6));
reg('ore_gold', (p, r) => oreT(p, r, [250, 214, 70], [200, 150, 30], 5));
reg('ore_crystal', (p, r) => { oreT(p, r, [56, 120, 240], [30, 70, 180], 5); speckle(p, [170, 220, 255], 6, r); });
function metalBlock(p, r, c, pat) {
  noiseFill(p, c, 0.07, r);
  for (let i = 0; i < 16; i++) { p.set(i, 0, mul(c, 1.25)); p.set(0, i, mul(c, 1.2)); p.set(i, 15, mul(c, 0.7)); p.set(15, i, mul(c, 0.72)); }
  if (pat === 'coal') speckle(p, [60, 60, 66], 24, r);
  else { p.rect(3, 3, 10, 10, mul(c, 0.92)); for (let i = 3; i < 13; i++) { p.set(i, 3, mul(c, 1.12)); p.set(3, i, mul(c, 1.12)); } speckle(p, mul(c, 1.3), 6, r); }
}
reg('block_coal', (p, r) => metalBlock(p, r, [38, 38, 44], 'coal'));
reg('block_copper', (p, r) => { metalBlock(p, r, [196, 112, 72], 'x'); speckle(p, [80, 170, 140], 8, r); });
reg('block_iron', (p, r) => metalBlock(p, r, [214, 214, 218], 'x'));
reg('block_gold', (p, r) => metalBlock(p, r, [250, 212, 60], 'x'));
reg('block_crystal', (p, r) => { metalBlock(p, r, [60, 130, 240], 'x'); p.line(5, 10, 8, 4, [190, 230, 255]); p.line(9, 11, 11, 7, [190, 230, 255]); });

// ---------- функциональные ----------
function plankBase(p, r, k = 1) { P.planks_oak(p, r); }
reg('workbench_top', (p, r) => {
  noiseFill(p, [182, 140, 88], 0.06, r);
  for (let i = 0; i < 16; i++) { p.set(i, 0, [110, 80, 48]); p.set(i, 15, [110, 80, 48]); p.set(0, i, [110, 80, 48]); p.set(15, i, [110, 80, 48]); }
  for (let i = 1; i < 15; i++) { p.set(i, 5, [128, 94, 58]); p.set(i, 10, [128, 94, 58]); p.set(5, i, [128, 94, 58]); p.set(10, i, [128, 94, 58]); }
  p.rect(6, 6, 4, 4, [150, 112, 70]);
});
reg('workbench_side', (p, r) => {
  P.planks_oak(p, r); p.rect(0, 0, 16, 3, [128, 94, 58]); p.rect(0, 3, 16, 1, [90, 64, 38]);
  p.rect(2, 6, 4, 8, [90, 90, 96]); p.rect(3, 4, 2, 2, [120, 80, 50]); // молоток
  p.line(9, 13, 13, 7, [200, 200, 205]); p.line(10, 13, 14, 7, [150, 150, 158]); // пила
});
reg('workbench_front', (p, r) => {
  P.planks_oak(p, r); p.rect(0, 0, 16, 3, [128, 94, 58]); p.rect(0, 3, 16, 1, [90, 64, 38]);
  p.rect(3, 6, 10, 8, [96, 70, 42]); p.rect(4, 7, 8, 6, [140, 104, 64]); p.rect(7, 9, 2, 2, [200, 190, 120]);
});
reg('furnace_top', (p, r) => { noiseFill(p, [108, 108, 112], 0.06, r); for (let i = 0; i < 16; i++) { p.set(i, 0, [80, 80, 84]); p.set(i, 15, [80, 80, 84]); p.set(0, i, [80, 80, 84]); p.set(15, i, [80, 80, 84]); } p.rect(5, 5, 6, 6, [40, 40, 44]); });
reg('furnace_side', (p, r) => { cobbleT(p, r, false); });
function furnaceFront(p, r, on) {
  cobbleT(p, r, false);
  p.rect(3, 3, 10, 5, [30, 30, 34]); p.rect(3, 9, 10, 5, [26, 26, 30]);
  for (let x = 3; x < 13; x += 2) p.set(x, 8, [80, 80, 86]);
  p.rect(4, 11, 8, 3, on ? [250, 140, 30] : [14, 14, 18]);
  if (on) { p.rect(5, 12, 6, 2, [255, 210, 70]); p.set(7, 11, [255, 240, 150]); p.rect(4, 4, 8, 3, [90, 40, 20]); }
}
reg('furnace_front', (p, r) => furnaceFront(p, r, false));
reg('furnace_front_on', (p, r) => furnaceFront(p, r, true));
reg('chest_side', (p, r) => {
  P.planks_oak(p, r); p.rect(0, 0, 16, 1, [96, 66, 36]); p.rect(0, 15, 16, 1, [96, 66, 36]);
  p.rect(0, 5, 16, 1, [96, 66, 36]);
  for (let i = 0; i < 16; i++) { p.set(0, i, [96, 66, 36]); p.set(15, i, [96, 66, 36]); }
});
reg('chest_front', (p, r) => {
  P.chest_side(p, r); p.rect(6, 4, 4, 4, [214, 214, 220]); p.rect(7, 5, 2, 2, [90, 90, 98]); p.rect(6, 4, 4, 1, [240, 240, 244]);
});
reg('chest_top', (p, r) => { P.planks_oak(p, r); for (let i = 0; i < 16; i++) { p.set(i, 0, [96, 66, 36]); p.set(i, 15, [96, 66, 36]); p.set(0, i, [96, 66, 36]); p.set(15, i, [96, 66, 36]); } p.rect(2, 2, 12, 12, mul([172, 130, 80], 1.05)); });
reg('torch', (p, r) => {
  p.clear();
  for (let y = 9; y < 16; y++) { p.set(7, y, [124, 90, 50]); p.set(8, y, [96, 68, 36]); }
  p.set(7, 8, [150, 110, 60]); p.set(8, 8, [110, 80, 44]);
  p.rect(7, 6, 2, 2, [255, 230, 90]); p.set(7, 5, [255, 170, 40]); p.set(8, 5, [255, 140, 30]); p.set(7, 7, [255, 250, 190]);
  p.set(7, 9, [255, 200, 60]); p.set(8, 9, [255, 190, 50]);
});
reg('lumen', (p, r) => {
  voronoi(p, 7, r, (v, edge) => (edge ? [200, 150, 60] : mul([255, 232, 140], 0.88 + v * 0.2)), 1.2);
  speckle(p, [255, 255, 220], 10, r);
});
reg('keg_side', (p, r) => {
  noiseFill(p, [140, 70, 44], 0.07, r);
  for (let y = 0; y < 16; y++) { if (y % 4 === 3) for (let x = 0; x < 16; x++) p.set(x, y, [96, 46, 30]); }
  p.rect(0, 2, 16, 2, [70, 70, 76]); p.rect(0, 12, 16, 2, [70, 70, 76]);
  p.disc(8, 8, 2.6, [30, 30, 34]); p.set(7, 7, [90, 90, 98]); p.set(10, 5, [255, 190, 60]); p.set(9, 6, [120, 90, 50]);
});
reg('keg_top', (p, r) => { noiseFill(p, [120, 66, 40], 0.06, r); p.disc(8, 8, 6.5, [100, 56, 34]); p.disc(8, 8, 5, [128, 72, 44]); p.rect(7, 7, 2, 2, [30, 30, 34]); p.set(8, 8, [255, 190, 60]); });
reg('keg_bottom', (p, r) => noiseFill(p, [84, 48, 30], 0.08, r));
const WCOLS = { white: [236, 236, 238], red: [178, 48, 44], orange: [222, 120, 36], yellow: [232, 200, 56], green: [88, 138, 44], blue: [52, 76, 178], purple: [128, 62, 168], black: [36, 36, 42] };
for (const c of WOOLS) reg('wool_' + c, (p, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, mul(WCOLS[c], ((x + y) % 2 ? 0.95 : 1.04) * (0.94 + r() * 0.12)));
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) p.set(x, y, mul(p.get(x, y), 0.92));
});
reg('cactus_side', (p, r) => {
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) p.set(x, y, mul([60, 128, 52], (x % 4 === 0 ? 0.78 : 1) * (0.92 + r() * 0.16)));
  for (let i = 0; i < 12; i++) { const x = 1 + ((r() * 14) | 0), y = (r() * 16) | 0; p.set(x, y, [226, 230, 180]); }
});
reg('cactus_top', (p, r) => {
  noiseFill(p, [70, 140, 58], 0.06, r);
  for (let i = 0; i < 16; i++) { p.set(i, 0, [44, 100, 40]); p.set(i, 15, [44, 100, 40]); p.set(0, i, [44, 100, 40]); p.set(15, i, [44, 100, 40]); }
  p.rect(5, 5, 6, 6, [54, 116, 46]);
});
reg('reed', (p, r) => {
  p.clear();
  for (const x of [3, 7, 11]) {
    const top = 1 + ((r() * 5) | 0);
    for (let y = top; y < 16; y++) p.set(x + (y % 5 === 0 ? 0 : 0), y, mul([200, 220, 170], 0.8 + r() * 0.3));
    for (let y = top + 2; y < 16; y += 4) { p.set(x, y, [150, 170, 120]); p.set(x + 1, y, [220, 235, 190]); }
    for (let y = top; y < 16; y++) p.set(x + 1, y, mul([200, 220, 170], 0.65 + r() * 0.2));
    p.set(x - 1, top + 3, [190, 210, 160]); p.set(x - 2, top + 2, [190, 210, 160]);
  }
});
reg('tall_grass', (p, r) => {
  p.clear();
  for (let x = 1; x < 16; x += 2) { const h = 6 + ((r() * 8) | 0), lean = ((r() * 3) | 0) - 1; for (let y = 0; y < h; y++) { const g = 150 + ((r() * 90) | 0); p.set(x + (y > h / 2 ? lean : 0), 15 - y, [g, g, g]); } }
});
reg('fern', (p, r) => {
  p.clear();
  for (let k = 0; k < 6; k++) {
    const ang = -1.3 + k * 0.52, len = 7 + ((r() * 3) | 0);
    for (let i = 1; i <= len; i++) { const x = Math.round(8 + Math.sin(ang) * i * 0.9), y = Math.round(15 - Math.cos(ang) * i); const g = 140 + ((r() * 90) | 0); p.set(x, y, [g, g, g]); if (i % 2 === 0) { p.set(x - 1, y + 1, [g * 0.8, g * 0.8, g * 0.8]); p.set(x + 1, y + 1, [g * 0.8, g * 0.8, g * 0.8]); } }
  }
});
reg('dead_bush', (p, r) => {
  p.clear(); const c = [112, 84, 48];
  p.line(8, 15, 8, 9, c); p.line(8, 11, 4, 6, c); p.line(8, 12, 12, 7, c); p.line(8, 9, 6, 4, c); p.line(8, 10, 10, 5, c); p.line(4, 6, 3, 4, c); p.line(12, 7, 13, 5, c);
  speckle(p, [140, 106, 62], 0, r);
});
const FCOL = { poppy: [214, 40, 40], dandelion: [250, 220, 40], cornflower: [70, 100, 230], lilac: [180, 100, 220] };
for (const f of FLOWERS) reg('flower_' + f, (p, r) => {
  p.clear(); const c = FCOL[f];
  p.line(8, 15, 8, 8, [62, 130, 48]); p.line(8, 13, 6, 11, [62, 130, 48]); p.line(8, 12, 10, 10, [72, 140, 52]);
  p.disc(8, 6, 2.2, c); p.set(8, 6, mul(c, 1.35)); p.set(8, 4, mul(c, 0.85)); p.set(6, 6, mul(c, 0.85));
  if (f === 'dandelion') { p.set(8, 6, [255, 180, 30]); } if (f === 'poppy') p.set(8, 6, [40, 20, 20]);
  if (f === 'lilac') { p.set(7, 3, c); p.set(9, 3, c); p.set(8, 8, c); }
  if (f === 'cornflower') { p.set(8, 3, c); p.set(5, 6, c); p.set(11, 6, c); p.set(8, 6, [250, 250, 255]); }
});
reg('farmland_top', (p, r) => {
  noiseFill(p, [88, 58, 38], 0.1, r);
  for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) { p.set(x, y, [60, 38, 26]); p.set(x + 1, y, mul([100, 68, 44], 1)); }
});
for (let i = 0; i < 8; i++) reg('wheat_' + i, (p, r) => {
  p.clear(); const hgt = 3 + i * 1.7 | 0;
  const green = i < 7 ? mul([84, 160, 52], 0.9 + i * 0.03) : [200, 170, 70];
  for (let x = 1; x < 16; x += 3) for (let y = 0; y < hgt; y++) {
    const col = i === 7 ? mul([214, 180, 80], 0.8 + r() * 0.4) : mul(green, 0.8 + r() * 0.4);
    p.set(x, 15 - y, col); if (y > 1 && (x + y) % 2 === 0) p.set(x + 1, 15 - y, mul(col, 0.8));
  }
  if (i === 7) for (let x = 1; x < 16; x += 3) { p.set(x, 15 - hgt, [236, 210, 110]); p.set(x, 14 - hgt, [226, 196, 90]); p.set(x + 1, 15 - hgt, [200, 170, 70]); }
});
reg('door_bottom', (p, r) => {
  P.planks_oak(p, r); p.rect(0, 0, 16, 16, [0, 0, 0], 0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = mul([160, 120, 74], 0.92 + r() * 0.16); if (x === 0 || x === 15 || y === 15) p.set(x, y, mul(c, 0.7)); else p.set(x, y, c); }
  p.rect(3, 2, 10, 5, [136, 100, 60]); p.rect(3, 9, 10, 5, [136, 100, 60]); p.rect(4, 3, 8, 3, [176, 134, 84]); p.rect(4, 10, 8, 3, [176, 134, 84]);
  p.rect(12, 7, 2, 2, [220, 200, 120]);
});
reg('door_top', (p, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = mul([160, 120, 74], 0.92 + r() * 0.16); if (x === 0 || x === 15 || y === 0) p.set(x, y, mul(c, 0.7)); else p.set(x, y, c); }
  for (const [x, y] of [[3, 3], [9, 3], [3, 8], [9, 8]]) { p.rect(x, y, 4, 4, [100, 150, 180]); p.rect(x, y, 4, 1, [180, 215, 235]); }
});
// ---------- вода / лава ----------
for (let f = 0; f < 8; f++) {
  reg('water_' + f, (p, r) => {
    const t = f / 8 * Math.PI * 2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const a = Math.sin((x / 16) * Math.PI * 2 * 2 + t) * 0.5 + Math.sin((y / 16) * Math.PI * 2 * 2 - t + x * 0.4) * 0.5 + Math.sin(((x + y) / 16) * Math.PI * 2 + t * 2) * 0.3;
      const v = 205 + a * 24 + (hash2(x, y, 5) - 0.5) * 10;
      p.set(x, y, [v * 0.93 | 0, v * 0.97 | 0, v], 176 + (a * 14) | 0);
    }
  });
  reg('lava_' + f, (p, r) => {
    const n = vnoise(901, 4), n2 = vnoise(902, 8);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const yy = (y + f * 2) % 16;
      const v = n(x, yy) * 0.6 + n2((x + 4) % 16, (yy + 3) % 16) * 0.5;
      const c = v < 0.45 ? mix([140, 30, 8], [220, 70, 10], v / 0.45) : v < 0.75 ? mix([220, 70, 10], [255, 160, 30], (v - 0.45) / 0.3) : mix([255, 160, 30], [255, 232, 120], Math.min(1, (v - 0.75) / 0.3));
      p.set(x, y, c);
    }
  });
}

// ---------- предметы ----------
const ICOL = { handle: [138, 100, 58], handle2: [100, 70, 38] };
const MAT = { wood: [160, 120, 72], stone: [138, 138, 142], iron: [226, 226, 232], crystal: [70, 150, 250], hide: [170, 110, 64], gold: [250, 210, 60] };
const shade = (c, f) => mul(c, f);
function handleLine(p, x0, y0, x1, y1) { p.line(x0, y0, x1, y1, ICOL.handle); p.line(x0 + 1, y0, x1 + 1, y1, ICOL.handle2); }
const toolShapes = {
  pickaxe: (p, m) => {
    p.line(3, 13, 10, 6, ICOL.handle); p.line(4, 13, 11, 6, ICOL.handle2);
    const pts = [[4, 4], [5, 3], [6, 2], [7, 2], [8, 2], [9, 2], [10, 3], [11, 4], [12, 5], [13, 6], [13, 7], [12, 7], [11, 6], [10, 5], [9, 4], [8, 4], [7, 4], [6, 4], [5, 5], [4, 5]];
    for (const [x, y] of pts) p.set(x, y, shade(m, 0.85 + ((x + y) % 3) * 0.1)); p.set(7, 2, shade(m, 1.2)); p.set(8, 2, shade(m, 1.2)); p.set(9, 3, shade(m, 1.1));
  },
  axe: (p, m) => {
    p.line(3, 13, 10, 6, ICOL.handle); p.line(4, 13, 11, 6, ICOL.handle2);
    for (const [x, y] of [[7, 2], [8, 2], [9, 2], [10, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 4], [7, 4], [8, 4], [9, 4], [10, 5], [11, 5], [8, 5], [9, 5], [11, 4], [12, 5]]) p.set(x, y, shade(m, 0.8 + ((x * 3 + y) % 4) * 0.1));
  },
  shovel: (p, m) => {
    p.line(3, 13, 9, 7, ICOL.handle); p.line(4, 13, 10, 7, ICOL.handle2);
    for (const [x, y] of [[10, 6], [11, 5], [12, 4], [11, 4], [12, 3], [10, 5], [11, 6], [12, 5], [13, 4], [11, 3], [10, 4], [13, 3], [12, 2]]) p.set(x, y, shade(m, 0.85 + ((x + y) % 3) * 0.1));
  },
  sword: (p, m) => {
    for (let i = 0; i < 9; i++) { p.set(5 + i, 10 - i, shade(m, 0.95 + (i % 2) * 0.1)); p.set(6 + i, 10 - i, shade(m, 0.8)); }
    p.set(14, 1, shade(m, 1.2)); p.set(13, 1, shade(m, 1.1));
    p.line(3, 8, 7, 12, [90, 70, 40]); p.line(3, 9, 7, 13, [120, 90, 50]);
    p.line(2, 13, 4, 11, ICOL.handle); p.line(2, 14, 4, 12, ICOL.handle2);
  },
  hoe: (p, m) => {
    p.line(3, 13, 10, 6, ICOL.handle); p.line(4, 13, 11, 6, ICOL.handle2);
    for (const [x, y] of [[8, 3], [9, 3], [10, 3], [11, 4], [8, 4], [9, 2], [10, 2]]) p.set(x, y, shade(m, 0.85 + ((x + y) % 3) * 0.1));
  },
};
for (const t of TIERS) for (const k of TOOLS) reg('i_' + t + '_' + k, (p, r) => { p.clear(); toolShapes[k](p, MAT[t]); p.outline([20, 16, 14]); });
const armorShapes = {
  helmet: (p, m) => { p.rect(3, 4, 10, 4, m); p.rect(2, 6, 12, 2, shade(m, 0.85)); p.rect(3, 8, 3, 4, m); p.rect(10, 8, 3, 4, m); p.rect(4, 5, 8, 1, shade(m, 1.2)); },
  chest: (p, m) => { p.rect(3, 3, 10, 11, m); p.rect(1, 3, 3, 6, shade(m, 0.85)); p.rect(12, 3, 3, 6, shade(m, 0.85)); p.rect(6, 3, 4, 2, [0, 0, 0], 0); p.rect(4, 6, 8, 1, shade(m, 1.2)); p.rect(5, 11, 6, 1, shade(m, 0.75)); },
  legs: (p, m) => { p.rect(3, 2, 10, 4, m); p.rect(3, 6, 4, 8, shade(m, 0.9)); p.rect(9, 6, 4, 8, shade(m, 0.9)); p.rect(3, 3, 10, 1, shade(m, 1.2)); },
  boots: (p, m) => { p.rect(2, 7, 4, 6, m); p.rect(10, 7, 4, 6, m); p.rect(1, 11, 5, 3, shade(m, 0.85)); p.rect(10, 11, 5, 3, shade(m, 0.85)); p.rect(2, 7, 4, 1, shade(m, 1.2)); p.rect(10, 7, 4, 1, shade(m, 1.2)); },
};
for (const m of ARMOR_MATS) for (const part of ARMOR_PARTS) reg('i_' + m + '_' + part, (p, r) => { p.clear(); armorShapes[part](p, MAT[m]); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.alpha(x, y) && hash2(x, y, 4) < 0.18) p.set(x, y, mul(p.get(x, y), 0.88)); p.outline([20, 16, 14]); });
function ingot(c) { return (p) => { p.clear(); p.rect(3, 6, 10, 5, c); p.rect(4, 5, 9, 1, shade(c, 1.2)); p.rect(3, 6, 10, 1, shade(c, 1.15)); p.rect(3, 10, 10, 1, shade(c, 0.7)); p.rect(12, 7, 1, 3, shade(c, 0.8)); p.set(5, 7, shade(c, 1.35)); p.outline([20, 16, 14]); }; }
reg('i_stick', (p) => { p.clear(); p.line(3, 13, 12, 4, ICOL.handle); p.line(4, 13, 13, 4, ICOL.handle2); p.outline([20, 16, 14]); });
reg('i_coal', (p, r) => { p.clear(); for (const [x, y, rad] of [[7, 8, 3.2], [10, 6, 2.4], [5, 5, 2]]) p.disc(x, y, rad, [34, 34, 40]); p.set(6, 6, [90, 90, 100]); p.set(9, 5, [80, 80, 90]); p.set(7, 8, [60, 60, 68]); p.outline([10, 10, 12]); });
reg('i_charcoal', (p, r) => { p.clear(); for (const [x, y, rad] of [[7, 8, 3.2], [10, 6, 2.4], [5, 5, 2]]) p.disc(x, y, rad, [62, 52, 48]); p.set(6, 6, [112, 96, 90]); p.outline([20, 14, 12]); });
reg('i_copper_ingot', ingot([212, 124, 76]));
reg('i_iron_ingot', ingot([222, 222, 228]));
reg('i_gold_ingot', ingot([252, 216, 64]));
reg('i_crystal', (p) => { p.clear(); const c = [70, 150, 250]; p.line(8, 2, 12, 7, c); p.line(8, 2, 4, 7, c); p.line(4, 7, 8, 14, c); p.line(12, 7, 8, 14, c); for (let y = 3; y < 14; y++) for (let x = 4; x < 13; x++) if (p.alpha(x, y) === 0) { /* заливка */ } p.disc(8, 8, 3.5, c); p.rect(6, 5, 4, 5, shade(c, 1.1)); p.set(7, 5, [210, 240, 255]); p.set(7, 6, [180, 225, 255]); p.set(10, 9, [30, 90, 200]); p.set(9, 10, [30, 90, 200]); p.set(8, 7, [150, 210, 255]); p.outline([10, 30, 90]); });
reg('i_clay_ball', (p) => { p.clear(); p.disc(8, 8, 4.5, [160, 166, 182]); p.disc(7, 7, 2, [182, 188, 202]); p.outline([60, 64, 80]); });
reg('i_brick', (p) => { p.clear(); p.rect(3, 5, 10, 6, [168, 80, 60]); p.rect(3, 5, 10, 1, [196, 110, 84]); p.rect(3, 10, 10, 1, [120, 54, 40]); p.rect(12, 6, 1, 4, [130, 60, 44]); p.outline([40, 20, 16]); });
reg('i_apple', (p) => { p.clear(); p.disc(8, 9, 4.6, [210, 40, 36]); p.disc(7, 8, 1.5, [244, 100, 90]); p.rect(8, 3, 1, 3, [100, 70, 40]); p.rect(9, 3, 2, 1, [70, 160, 60]); p.set(10, 4, [70, 160, 60]); p.outline([60, 10, 10]); });
reg('i_bread', (p) => { p.clear(); p.rect(3, 6, 10, 6, [214, 160, 80]); p.rect(4, 5, 8, 1, [214, 160, 80]); p.rect(4, 6, 8, 2, [236, 190, 110]); for (const x of [5, 8, 11]) p.rect(x, 6, 1, 2, [168, 116, 52]); p.rect(3, 11, 10, 1, [160, 108, 50]); p.outline([60, 36, 14]); });
reg('i_wheat', (p) => { p.clear(); for (const x of [5, 8, 11]) { p.line(x - 1, 14, x + 1, 5, [200, 170, 70]); p.rect(x, 2, 2, 4, [236, 206, 100]); p.set(x, 2, [250, 230, 140]); } p.outline([70, 50, 16]); });
reg('i_seeds', (p) => { p.clear(); for (const [x, y] of [[5, 6], [8, 8], [10, 5], [6, 10], [10, 10], [8, 5]]) { p.set(x, y, [90, 150, 50]); p.set(x + 1, y, [60, 110, 36]); } p.outline([20, 40, 14]); });
function meat(raw, kind) {
  return (p) => {
    p.clear();
    const body = raw ? (kind === 'chicken' ? [236, 190, 170] : [220, 100, 100]) : (kind === 'chicken' ? [200, 140, 70] : [150, 80, 44]);
    if (kind === 'chicken') { p.disc(8, 8, 4.2, body); p.rect(10, 11, 4, 2, [240, 236, 226]); p.rect(12, 12, 2, 2, [240, 236, 226]); p.disc(7, 7, 1.6, shade(body, 1.15)); }
    else { p.rect(3, 5, 10, 7, body); p.rect(4, 4, 8, 1, body); p.rect(4, 6, 6, 2, shade(body, 1.2)); p.rect(10, 8, 3, 3, shade(body, 0.8)); if (kind === 'mutton') p.rect(12, 6, 2, 2, [240, 236, 226]); }
    p.outline(raw ? [70, 20, 24] : [50, 24, 12]);
  };
}
reg('i_raw_mutton', meat(true, 'mutton')); reg('i_cooked_mutton', meat(false, 'mutton'));
reg('i_raw_chicken', meat(true, 'chicken')); reg('i_cooked_chicken', meat(false, 'chicken'));
reg('i_raw_pork', meat(true, 'pork')); reg('i_cooked_pork', meat(false, 'pork'));
reg('i_egg', (p) => { p.clear(); p.disc(8, 9, 4.2, [236, 226, 200]); p.disc(8, 7, 3.4, [244, 236, 214]); p.set(6, 7, [255, 255, 245]); p.set(9, 11, [190, 176, 140]); p.set(10, 9, [190, 140, 100]); p.outline([90, 76, 50]); });
reg('i_feather', (p) => { p.clear(); p.line(3, 13, 12, 3, [236, 236, 240]); p.line(4, 13, 13, 4, [200, 200, 210]); p.line(5, 11, 9, 4, [220, 220, 228]); p.line(6, 12, 11, 7, [210, 210, 220]); p.line(2, 14, 4, 12, [140, 140, 150]); p.outline([60, 60, 70]); });
reg('i_hide', (p) => { p.clear(); p.rect(3, 4, 10, 9, [166, 106, 62]); p.rect(2, 5, 12, 5, [166, 106, 62]); p.rect(4, 5, 8, 2, [190, 130, 80]); p.rect(3, 11, 10, 2, [130, 80, 46]); p.set(6, 8, [140, 88, 50]); p.set(9, 9, [140, 88, 50]); p.outline([60, 34, 18]); });
reg('i_bone', (p) => { p.clear(); p.line(4, 12, 11, 5, [236, 232, 214]); p.line(5, 12, 12, 5, [206, 200, 180]); p.disc(3, 12, 1.6, [236, 232, 214]); p.disc(5, 13, 1.4, [236, 232, 214]); p.disc(12, 4, 1.6, [236, 232, 214]); p.disc(11, 3, 1.4, [236, 232, 214]); p.outline([80, 76, 64]); });
reg('i_powder', (p, r) => { p.clear(); p.rect(4, 9, 8, 3, [90, 90, 96]); p.rect(5, 7, 6, 2, [108, 108, 116]); p.rect(6, 6, 4, 1, [120, 120, 128]); speckle(p, [160, 160, 170], 4, r); for (let i = 0; i < 6; i++) p.set(4 + ((r() * 8) | 0), 9 + ((r() * 3) | 0), [70, 70, 76]); p.outline([30, 30, 34]); });
reg('i_arrow', (p) => { p.clear(); p.line(3, 13, 12, 4, [150, 110, 64]); p.set(13, 3, [200, 200, 210]); p.set(12, 3, [190, 190, 200]); p.set(13, 4, [190, 190, 200]); p.set(14, 2, [220, 220, 230]); p.line(2, 11, 4, 13, [236, 236, 240]); p.line(3, 10, 5, 12, [210, 210, 220]); p.outline([30, 24, 20]); });
reg('i_shears', (p) => { p.clear(); p.line(4, 4, 11, 11, [220, 220, 228]); p.line(11, 4, 4, 11, [180, 180, 190]); p.disc(3, 13, 1.8, [200, 60, 50]); p.disc(12, 13, 1.8, [200, 60, 50]); p.line(3, 12, 7, 8, [150, 150, 160]); p.line(12, 12, 8, 8, [150, 150, 160]); p.outline([30, 30, 34]); });
reg('i_flint_steel', (p) => { p.clear(); p.rect(3, 8, 7, 5, [70, 70, 78]); p.rect(3, 8, 7, 1, [110, 110, 120]); p.rect(9, 3, 4, 7, [220, 220, 228]); p.rect(10, 4, 2, 5, [20, 20, 24]); p.set(5, 7, [255, 200, 60]); p.set(6, 6, [255, 240, 140]); p.outline([20, 20, 24]); });

// ---------- питомцы, машинка, эффекты ----------
reg('i_fish', (p) => {
  p.clear(); const c = [80, 150, 220], d = [50, 100, 170];
  for (let y = 5; y < 12; y++) for (let x = 3; x < 12; x++) if (((x - 7.5) / 4.6) ** 2 + ((y - 8.5) / 3.2) ** 2 <= 1) p.set(x, y, c);
  for (let y = 4; y < 14; y++) { const w = Math.abs(y - 8.5) * 0.6; for (let x = 11; x < 12 + w && x < 15; x++) p.set(x, y, d); }
  p.rect(5, 10, 5, 1, [180, 210, 240]); p.set(5, 7, [255, 255, 255]); p.set(5, 8, [20, 20, 30]); p.line(8, 6, 9, 10, d); p.outline([20, 40, 80]);
});
reg('i_dog_treat', (p) => {
  p.clear(); const c = [196, 140, 80], h = [226, 176, 110];
  p.rect(5, 6, 6, 4, c); p.disc(4, 5.5, 2, c); p.disc(4, 10, 2, c); p.disc(11.5, 5.5, 2, c); p.disc(11.5, 10, 2, c);
  p.rect(5, 6, 6, 1, h); p.set(4, 4, h); p.set(11, 4, h); p.set(7, 8, [150, 100, 56]); p.set(9, 8, [150, 100, 56]); p.outline([80, 50, 24]);
});
function petFace(p, fur, ear, eye, cat) {
  p.clear();
  if (cat) { p.line(3, 2, 3, 6, fur); p.line(4, 3, 4, 6, fur); p.set(5, 4, fur); p.line(12, 2, 12, 6, fur); p.line(11, 3, 11, 6, fur); p.set(10, 4, fur); p.set(4, 4, [240, 150, 170]); p.set(11, 4, [240, 150, 170]); }
  p.disc(7.5, 9, 5.4, fur);
  if (!cat) { p.rect(1, 5, 3, 7, ear); p.rect(12, 5, 3, 7, ear); p.rect(5, 11, 6, 3, [244, 236, 220]); }
  p.rect(5, 7, 2, 2, eye); p.rect(9, 7, 2, 2, eye); p.set(5, 7, [255, 255, 255]); p.set(9, 7, [255, 255, 255]);
  p.rect(7, 10, 2, 1, cat ? [240, 130, 150] : [30, 24, 20]); p.set(6, 12, [60, 40, 40]); p.set(9, 12, [60, 40, 40]);
  if (!cat) p.rect(4, 14, 8, 1, [210, 50, 40]);
  p.outline([40, 28, 20]);
}
reg('i_spawn_kitten', (p) => petFace(p, [232, 146, 74], null, [60, 160, 60], true));
reg('i_spawn_puppy', (p) => petFace(p, [196, 140, 86], [120, 80, 46], [30, 24, 20], false));
reg('i_car_key', (p) => {
  p.clear(); const c = [216, 52, 40], d = [160, 30, 24];
  p.rect(2, 7, 12, 4, c); p.rect(4, 4, 7, 3, c); p.rect(5, 5, 2, 2, [170, 220, 250]); p.rect(8, 5, 2, 2, [170, 220, 250]);
  p.rect(2, 10, 12, 1, d); p.set(13, 8, [255, 230, 120]); p.set(2, 8, [255, 120, 100]);
  p.disc(4.5, 11.5, 1.8, [40, 40, 44]); p.disc(11.5, 11.5, 1.8, [40, 40, 44]); p.set(4, 11, [170, 170, 176]); p.set(11, 11, [170, 170, 176]);
  p.outline([30, 16, 14]);
});
reg('shop_top', (p) => {
  p.fill([196, 140, 80]); p.rect(0, 0, 16, 1, [150, 100, 56]); p.rect(0, 15, 16, 1, [150, 100, 56]);
  p.rect(3, 4, 10, 8, [40, 44, 52]); p.rect(4, 5, 8, 6, [90, 200, 120]); p.rect(6, 7, 1, 2, [240, 255, 240]); p.rect(9, 7, 1, 2, [240, 255, 240]);
});
reg('shop_side', (p) => {
  p.fill([240, 240, 236]); p.rect(0, 0, 16, 3, [42, 90, 216]); p.rect(0, 13, 16, 3, [42, 90, 216]);
  // красная машинка и звезда
  p.rect(2, 8, 9, 3, [216, 52, 40]); p.rect(4, 6, 5, 2, [216, 52, 40]); p.rect(5, 6, 3, 1, [170, 220, 250]);
  p.disc(4, 11.5, 1.2, [30, 30, 34]); p.disc(9, 11.5, 1.2, [30, 30, 34]);
  for (const [x, y] of [[13, 5], [12, 6], [13, 6], [14, 6], [11, 7], [12, 7], [13, 7], [14, 7], [15, 7], [12, 8], [14, 8]]) p.set(x, y, [255, 210, 58]);
});
reg('i_parcel', (p) => {
  p.clear(); p.rect(3, 4, 10, 9, [196, 150, 96]); p.rect(3, 4, 10, 2, [220, 176, 120]); p.rect(7, 4, 2, 9, [216, 52, 40]); p.rect(3, 8, 10, 1, [216, 52, 40]);
  p.set(6, 3, [216, 52, 40]); p.set(9, 3, [216, 52, 40]); p.outline([70, 46, 20]);
});
reg('i_star_token', (p) => {
  p.clear(); const c = [255, 214, 60];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x - 7.5, dy = y - 8, a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy); if (r <= 3 + 4 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3)) p.set(x, y, c); }
  p.set(6, 6, [255, 250, 210]); p.set(7, 6, [255, 250, 210]); p.outline([140, 90, 0]);
});
reg('fx_heart', (p) => {
  p.clear(); const c = [255, 255, 255];
  p.disc(5, 5.5, 3.3, c); p.disc(10.5, 5.5, 3.3, c);
  for (let y = 6; y < 15; y++) { const k = y - 6; for (let x = 1 + k; x <= 14 - k; x++) p.set(x, y, c); }
});
reg('fx_star', (p) => {
  p.clear(); const c = [255, 255, 255];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 8, a = Math.atan2(dx, -dy), r = Math.hypot(dx, dy);
    if (r <= 3.2 + 4.6 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3)) p.set(x, y, c);
  }
});

// ---------- сборка атласа ----------
let built = false;
export function buildAtlas() {
  if (built) return atlas;
  built = true;
  for (let i = 0; i < TILE_NAMES.length; i++) {
    const name = TILE_NAMES[i];
    const p = new Px(i);
    const f = P[name];
    const r = mulberry32(strHash(name));
    if (!f) { p.fill([255, 0, 255]); continue; }
    f(p, r);
  }
  for (let f = 0; f < 8; f++) {
    P['water_' + f](new Px(WATER_BASE + f), mulberry32(f));
    P['lava_' + f](new Px(LAVA_BASE + f), mulberry32(f + 100));
  }
  return atlas;
}
export function tilePixels(tile) { // копия RGBA 16x16
  const out = new Uint8ClampedArray(16 * 16 * 4);
  const tx = (tile & 15) * 16, ty = (tile >> 4) * 16;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = ((ty + y) * ATLAS + tx + x) * 4, d = (y * 16 + x) * 4; out[d] = atlas[s]; out[d + 1] = atlas[s + 1]; out[d + 2] = atlas[s + 2]; out[d + 3] = atlas[s + 3]; }
  return out;
}
// Мипмапы без «швов»: уровни 0..4 (на 4-м уровне тайл = 1 пиксель)
export function atlasMipmaps() {
  const levels = [];
  levels.push({ data: atlas, width: ATLAS, height: ATLAS });
  let prev = levels[0];
  for (let l = 1; l <= 4; l++) {
    const w = prev.width >> 1, h = prev.height >> 1;
    const d = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = ((y * 2 + dy) * prev.width + x * 2 + dx) * 4; const al = prev.data[i + 3];
        r += prev.data[i] * al; g += prev.data[i + 1] * al; b += prev.data[i + 2] * al; a += al;
      }
      const o = (y * w + x) * 4;
      if (a > 0) { d[o] = r / a; d[o + 1] = g / a; d[o + 2] = b / a; }
      d[o + 3] = Math.min(255, a / 4 * (l > 1 ? 1.25 : 1.0));
    }
    prev = { data: d, width: w, height: h }; levels.push(prev);
  }
  return levels;
}
// Стадии трещин (10 штук) -> массивы RGBA 16x16
export function crackStages() {
  const out = [];
  const r = mulberry32(2024);
  const cells = new Set();
  let x = 8, y = 8;
  const order = [];
  for (let b = 0; b < 5; b++) {
    let cx = 8 + ((r() * 4) | 0) - 2, cy = 8 + ((r() * 4) | 0) - 2;
    const ang = r() * 6.28;
    for (let i = 0; i < 12; i++) { cx += Math.round(Math.cos(ang + (r() - 0.5) * 1.2) * 1.2); cy += Math.round(Math.sin(ang + (r() - 0.5) * 1.2) * 1.2); order.push([cx, cy]); }
  }
  for (let s = 0; s < 10; s++) {
    const d = new Uint8ClampedArray(16 * 16 * 4);
    const n = Math.floor((s + 1) * order.length / 10);
    for (let i = 0; i < n; i++) {
      const [px, py] = order[i];
      for (const [ox, oy] of s > 5 ? [[0, 0], [1, 0], [0, 1]] : [[0, 0]]) {
        const X = px + ox, Y = py + oy; if (X < 0 || Y < 0 || X > 15 || Y > 15) continue;
        const k = (Y * 16 + X) * 4; d[k] = 10; d[k + 1] = 10; d[k + 2] = 10; d[k + 3] = 200;
      }
    }
    out.push(d);
  }
  return out;
}
export const tileIndex = (n) => TILE_INDEX[n];
