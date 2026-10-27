// Генератор мира: рельеф, биомы, пещеры, руды, структуры
import { Simplex, mulberry32, hash2, hash3 } from '../core/noise.js';
import { clamp, smoothstep, piecewise, SEA } from '../core/math.js';
import { B, SOLID, OPAC, FAMILY, BLOCKS } from './blocks.js';
import { BIOME, classify } from './biomes.js';
import { placeTree, placeCactus, placeBoulder, placeRuin } from './structures.js';

const R = 6;            // отступ региона для деревьев
const RW = 16 + 2 * R;  // 28
const CONT_PTS = [[-1, 20], [-0.6, 30], [-0.32, 48], [-0.14, 57], [-0.04, 61], [0.06, 64.5], [0.25, 69], [0.55, 76], [1, 88]];

export class Generator {
  constructor(seed) {
    this.seed = seed | 0;
    const s = this.seed;
    this.sCont = new Simplex(s + 11); this.sEro = new Simplex(s + 23); this.sPeak = new Simplex(s + 37);
    this.sTemp = new Simplex(s + 41); this.sHum = new Simplex(s + 53); this.sDet = new Simplex(s + 67);
    this.sMisc = new Simplex(s + 71); this.sCave = new Simplex(s + 83); this.sTubeA = new Simplex(s + 97); this.sTubeB = new Simplex(s + 101);
  }

  // Выборка столбца: возвращает [h, biome]
  sample(x, z, out) {
    const c = clamp(this.sCont.fbm2(x / 1000, z / 1000, 4) * 1.55 + 0.14, -1, 1);
    const e = clamp(this.sEro.fbm2(x / 650 + 500, z / 650 - 300, 3) * 1.6, -1, 1);
    const pv = 1 - Math.abs(this.sPeak.fbm2(x / 230 + 77, z / 230 + 13, 4)) * 2; // гребни 0..1
    let base = piecewise(c, CONT_PTS);
    const mount = smoothstep(0.18, 0.62, c) * smoothstep(0.35, -0.45, e);
    const detAmp = 2.2 + 5 * smoothstep(0.1, -0.7, e) + mount * 4;
    const det = this.sDet.fbm2(x / 52, z / 52, 4) * detAmp;
    let h = base + mount * (pv * pv * 62 + 8) + det;
    if (c > -0.14 && c < 0.02) h += this.sDet.noise2(x / 18, z / 18) * 1.2;
    h = clamp(h, 6, 240);
    let t = clamp(this.sTemp.fbm2(x / 820 + 30, z / 820 - 90, 3) * 1.7, -1, 1);
    const hum = clamp(this.sHum.fbm2(x / 640 - 40, z / 640 + 12, 3) * 1.7, -1, 1);
    t -= Math.max(0, h - 82) * 0.012;
    const rug = mount * pv;
    out.h = Math.floor(h); out.t = t; out.hum = hum;
    out.biome = classify(t, hum, h, SEA, rug);
    return out;
  }

  isEntrance(x, z) { return this.sMisc.noise2(x / 70 + 5, z / 70 - 5) > 0.62; }

  topBlocks(biome, h, x, z) {
    // [верх, наполнитель, глубина]
    const m = this.sMisc.noise2(x / 14, z / 14);
    switch (biome) {
      case BIOME.OCEAN: {
        if (h > SEA - 3) return [B.sand, B.sand, 3];
        const g = this.sMisc.noise2(x / 24 + 100, z / 24);
        if (g > 0.35) return [B.gravel, B.gravel, 3];
        if (g < -0.5) return [B.clay, B.clay, 2];
        return [B.sand, B.sand, 3];
      }
      case BIOME.BEACH: return [B.sand, B.sand, 4];
      case BIOME.DESERT: return [B.sand, B.sand, 5];
      case BIOME.TUNDRA: return h > SEA ? [B.snow, B.dirt, 3] : [B.sand, B.sand, 3];
      case BIOME.MOUNTAINS:
        if (h > 124 + m * 5) return [B.snow, B.stone, 1];
        if (h > 104 + m * 6) return [B.stone, B.stone, 1];
        if (m > 0.5) return [B.gravel, B.stone, 2];
        return [B.grass, B.dirt, 3];
      case BIOME.TAIGA: return m > 0.25 ? [B.podzol, B.dirt, 3] : [B.grass, B.dirt, 3];
      case BIOME.SWAMP: return h <= SEA + 1 && m > 0.3 ? [B.clay, B.dirt, 3] : [B.grass, B.dirt, 3];
      default: return [B.grass, B.dirt, 3];
    }
  }

  generate(cx, cz) {
    const blocks = new Uint16Array(65536);
    const biomes = new Uint8Array(256);
    const heights = new Uint8Array(256);
    const bes = [];
    const ox = cx * 16, oz = cz * 16;
    const seed = this.seed;

    // ---- карта столбцов региона
    const hm = new Int16Array(RW * RW), bm = new Uint8Array(RW * RW), tm = new Float32Array(RW * RW);
    const tmp = { h: 0, t: 0, hum: 0, biome: 0 };
    for (let z = 0; z < RW; z++) for (let x = 0; x < RW; x++) {
      this.sample(ox + x - R, oz + z - R, tmp);
      const i = z * RW + x; hm[i] = tmp.h; bm[i] = tmp.biome; tm[i] = tmp.t;
    }
    let maxH = 0;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = (z + R) * RW + x + R; if (hm[i] > maxH) maxH = hm[i];
      biomes[z * 16 + x] = bm[i];
    }
    maxH = Math.max(maxH, SEA);

    // ---- сетка шума пещер
    const GX = 5, GZ = 5, GY = (maxH >> 2) + 3;
    const cheese = new Float32Array(GX * GZ * GY), ta = new Float32Array(GX * GZ * GY), tb = new Float32Array(GX * GZ * GY);
    for (let gy = 0; gy < GY; gy++) for (let gz = 0; gz < GZ; gz++) for (let gx = 0; gx < GX; gx++) {
      const x = ox + gx * 4, y = gy * 4, z = oz + gz * 4;
      const i = (gy * GZ + gz) * GX + gx;
      cheese[i] = this.sCave.noise3(x / 38, y / 22, z / 38) * 0.8 + this.sCave.noise3(x / 15 + 50, y / 10, z / 15) * 0.2;
      ta[i] = this.sTubeA.noise3(x / 34, y / 24, z / 34);
      tb[i] = this.sTubeB.noise3(x / 34 + 200, y / 24, z / 34);
    }

    // ---- заполнение столбцов
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = ox + x, wz = oz + z;
      const ri = (z + R) * RW + x + R;
      const h = hm[ri], biome = bm[ri];
      const [top, fill, fd] = this.topBlocks(biome, h, wx, wz);
      const ent = this.isEntrance(wx, wz);
      const fx = x / 4, fz = z / 4;
      const ix = Math.min(3, fx | 0), iz = Math.min(3, fz | 0);
      const tx = fx - ix, tz = fz - iz;
      const top3 = h; // верх для пещер
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = B.basalt;
        else if (y <= 4) id = hash3(wx, y, wz, seed) < (5 - y) / 5 ? B.basalt : B.stone;
        else if (y === h) id = top;
        else if (y > h - fd) id = fill;
        else if (biome === BIOME.DESERT && y > h - fd - 3) id = B.sandstone;
        else id = B.stone;
        if (y >= 5 && y <= h - (biome === BIOME.OCEAN || h < SEA ? 4 : (ent ? 0 : 3))) {
          // триллинейная интерполяция грубой сетки
          const fy = y / 4, iy = fy | 0, ty = fy - iy;
          const b00 = (iy * GZ + iz) * GX + ix, b10 = b00 + 1, b01 = b00 + GX, b11 = b01 + 1;
          const s = GX * GZ;
          const tri = (a) => {
            const c00 = a[b00] * (1 - tx) + a[b10] * tx, c01 = a[b01] * (1 - tx) + a[b11] * tx;
            const c10 = a[b00 + s] * (1 - tx) + a[b10 + s] * tx, c11 = a[b01 + s] * (1 - tx) + a[b11 + s] * tx;
            return (c00 * (1 - tz) + c01 * tz) * (1 - ty) + (c10 * (1 - tz) + c11 * tz) * ty;
          };
          const depth = h - y;
          let thr = 0.46 + Math.max(0, (16 - depth) / 16) * 0.34 + (y < 14 ? (14 - y) * 0.025 : 0);
          let carve = false;
          const cv = tri(cheese);
          if (cv > thr) carve = true;
          else {
            const a = tri(ta), b2 = tri(tb);
            const rad = 0.065 + (y < 40 ? 0.02 : 0);
            if (a > -rad && a < rad && b2 > -rad && b2 < rad && (depth > 4 || ent)) carve = true;
          }
          if (carve) id = y <= 10 ? B.lava_0 : 0;
        }
        blocks[(y << 8) | (z << 4) | x] = id;
      }
      // вода
      if (h < SEA) {
        const cold = tm[ri] < -0.32;
        for (let y = h + 1; y <= SEA; y++) blocks[(y << 8) | (z << 4) | x] = (cold && y === SEA) ? B.ice : B.water_0;
      }
      heights[z * 16 + x] = h;
    }

    // ---- мелкие вкрапления: грунт, гравий, глина
    const rnd = mulberry32(hash2(cx, cz, seed ^ 0x5bd1e995) * 4294967296);
    const vein = (id, count, size, y0, y1, host) => {
      for (let n = 0; n < count; n++) {
        let x = (rnd() * 16) | 0, y = y0 + ((rnd() * (y1 - y0)) | 0), z = (rnd() * 16) | 0;
        const sz = 2 + ((rnd() * size) | 0);
        for (let k = 0; k < sz; k++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 4 && y < 255) {
            const idx = (y << 8) | (z << 4) | x;
            if (blocks[idx] === host) blocks[idx] = id;
          }
          x += ((rnd() * 3) | 0) - 1; y += ((rnd() * 3) | 0) - 1; z += ((rnd() * 3) | 0) - 1;
        }
      }
    };
    vein(B.dirt, 10, 12, 8, Math.min(120, maxH), B.stone);
    vein(B.gravel, 8, 10, 6, Math.min(100, maxH), B.stone);
    vein(B.clay, 3, 8, 30, 70, B.stone);
    vein(B.ore_coal, 22, 9, 5, 128, B.stone);
    vein(B.ore_copper, 16, 7, 5, 90, B.stone);
    vein(B.ore_iron, 14, 6, 5, 64, B.stone);
    vein(B.ore_gold, 4, 5, 5, 32, B.stone);
    vein(B.ore_crystal, 3, 4, 5, 18, B.stone);
    vein(B.ore_iron, 4, 5, 70, 110, B.stone); // в горах
    if (rnd() < 0.3) vein(B.block_coal, 1, 3, 20, 60, B.stone);

    // ---- адаптер для структур
    const W = {
      get: (x, y, z) => {
        const lx = x - ox, lz = z - oz;
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y > 255) return 0;
        return blocks[(y << 8) | (lz << 4) | lx];
      },
      set: (x, y, z, id) => {
        const lx = x - ox, lz = z - oz;
        if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y > 255) return;
        blocks[(y << 8) | (lz << 4) | lx] = id;
      },
    };
    const colAt = (wx, wz) => ((wz - oz + R) * RW + (wx - ox + R));
    const surfaceOk = (id) => id === B.grass || id === B.podzol || id === B.snow || id === B.dirt;

    // ---- деревья (сетка 4x4, соседний чанк тоже вносит вклад)
    const x0 = Math.floor((ox - 5) / 4), x1 = Math.floor((ox + 20) / 4);
    const z0 = Math.floor((oz - 5) / 4), z1 = Math.floor((oz + 20) / 4);
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const hh = hash2(gx, gz, seed + 991);
      const wx = gx * 4 + ((hash2(gx, gz, seed + 5) * 4) | 0), wz = gz * 4 + ((hash2(gx, gz, seed + 6) * 4) | 0);
      if (wx < ox - R + 1 || wx > ox + 15 + R - 1 || wz < oz - R + 1 || wz > oz + 15 + R - 1) continue;
      const ri = colAt(wx, wz);
      const biome = bm[ri], h = hm[ri];
      if (h <= SEA) continue;
      if (this.isEntrance(wx, wz)) continue;
      const [top] = this.topBlocks(biome, h, wx, wz);
      if (!surfaceOk(top)) continue;
      const forest = this.sMisc.noise2(wx / 110 + 9, wz / 110 - 4);
      let p = 0, type = 'oak';
      const pick = hash2(gx, gz, seed + 17);
      switch (biome) {
        case BIOME.MEADOW: p = forest > 0.15 ? 0.3 : 0.018; type = pick < 0.07 && forest > 0.15 ? 'bigoak' : 'oak'; break;
        case BIOME.BIRCH: p = 0.24; type = pick < 0.8 ? 'birch' : 'oak'; break;
        case BIOME.TAIGA: p = 0.3; type = 'spruce'; break;
        case BIOME.SAVANNA: p = 0.035; type = 'acacia'; break;
        case BIOME.SWAMP: p = 0.14; type = 'willow'; break;
        case BIOME.TUNDRA: p = 0.012; type = 'spruce'; break;
        case BIOME.MOUNTAINS: p = h < 98 ? 0.05 : 0; type = 'spruce'; break;
      }
      if (hh >= p) continue;
      placeTree(W, type, wx, h + 1, wz, mulberry32((hash2(wx, wz, seed + 1234) * 4294967296) | 0));
    }

    // ---- растительность и мелочь на поверхности
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = ox + x, wz = oz + z;
      const ri = (z + R) * RW + x + R;
      const h = hm[ri], biome = bm[ri];
      if (this.isEntrance(wx, wz)) continue;
      const r = hash2(wx, wz, seed + 3001), r2 = hash2(wx, wz, seed + 3002);
      const top = blocks[(h << 8) | (z << 4) | x];
      const above = (h + 1) < 256 ? blocks[((h + 1) << 8) | (z << 4) | x] : 1;
      if (h >= SEA && h <= SEA + 0 && (top === B.sand || top === B.grass || top === B.dirt || top === B.clay)) {
        // тростник у воды
        let near = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (z + R + dz) * RW + x + R + dx; if (hm[j] < SEA) near = true; }
        if (near && r < 0.18 && above === 0) { const n = 1 + ((r2 * 3) | 0); for (let k = 1; k <= n; k++) blocks[((h + k) << 8) | (z << 4) | x] = B.reed; continue; }
      }
      if (h <= SEA || above !== 0) continue;
      const put = (id) => { blocks[((h + 1) << 8) | (z << 4) | x] = id; };
      switch (biome) {
        case BIOME.MEADOW: if (r < 0.2) put(B.tall_grass); else if (r < 0.235) put(B.flower_poppy + ((r2 * 4) | 0)); break;
        case BIOME.BIRCH: if (r < 0.1) put(B.tall_grass); else if (r < 0.14) put(B.flower_poppy + ((r2 * 4) | 0)); break;
        case BIOME.TAIGA: if (r < 0.07) put(B.fern); else if (r < 0.12) put(B.tall_grass); break;
        case BIOME.SAVANNA: if (r < 0.22) put(B.tall_grass); break;
        case BIOME.SWAMP: if (r < 0.14) put(B.tall_grass); else if (r < 0.16) put(B.flower_cornflower); break;
        case BIOME.MOUNTAINS: if (top === B.grass && r < 0.05) put(B.tall_grass); break;
        case BIOME.DESERT:
          if (top === B.sand) {
            if (r < 0.004) put(B.dead_bush);
            else if (r < 0.012) {
              const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => { const lx = x + dx, lz = z + dz; return lx < 0 || lx > 15 || lz < 0 || lz > 15 || blocks[((h + 1) << 8) | (lz << 4) | lx] === 0; });
              if (ok) placeCactus(W, wx, h + 1, wz, 1 + ((r2 * 3) | 0));
            }
          } break;
      }
      // валуны
      if ((biome === BIOME.TAIGA || biome === BIOME.MOUNTAINS || biome === BIOME.MEADOW) && hash2(wx, wz, seed + 4001) < 0.0012) {
        placeBoulder(W, wx, h, wz, 1 + ((r2 * 2) | 0), rnd);
      }
    }

    // ---- руины
    if (hash2(cx, cz, seed + 777) < 0.035) {
      const rx = ox + 4, rz = oz + 4;
      const ci = colAt(rx + 3, rz + 3), b = bm[ci];
      if ([BIOME.MEADOW, BIOME.BIRCH, BIOME.DESERT, BIOME.SAVANNA, BIOME.TAIGA, BIOME.TUNDRA].includes(b)) {
        let mn = 999, mx = -1;
        for (let dz = 0; dz < 7; dz++) for (let dx = 0; dx < 7; dx++) { const hv = hm[colAt(rx + dx, rz + dz)]; if (hv < mn) mn = hv; if (hv > mx) mx = hv; }
        if (mx - mn <= 3 && mn > SEA + 1) placeRuin(W, rx, rz, mx, rnd, bes);
      }
    }

    // ---- карта высот
    let maxY = 0;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let y = 255;
      for (; y > 0; y--) { const id = blocks[(y << 8) | (z << 4) | x]; if (id !== 0 && (SOLID[id] || OPAC[id] > 0 || FAMILY[id])) break; }
      heights[z * 16 + x] = y;
      if (y > maxY) maxY = y;
    }
    return { blocks, biomes, heights, bes, maxY };
  }
}
