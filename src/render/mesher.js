// Мешер чанка: скрытие граней, per-vertex AO, гладкое освещение, три слоя (opaque/cutout/translucent)
import { OPAQUE, LAYERS, SHAPES, TINTS, FACE_TILES, FAMILY, LIQ, SOLID, BLOCKS, SHAPE, LAYER, TINT, ANIMS, B } from '../world/blocks.js';
import { RX } from '../world/lighting.js';

const S16 = 16;
class Buf {
  constructor() {
    this.cap = 2048; this.n = 0; this.ni = 0;
    this.pos = new Int16Array(this.cap * 4); this.uv = new Uint8Array(this.cap * 4);
    this.lit = new Uint8Array(this.cap * 4); this.tint = new Uint8Array(this.cap * 4);
    this.idx = new Uint32Array(this.cap * 2);
  }
  grow() {
    const nc = this.cap * 2;
    const cp = (A, len) => { const a = new A.constructor(len); a.set(A); return a; };
    this.pos = cp(this.pos, nc * 4); this.uv = cp(this.uv, nc * 4); this.lit = cp(this.lit, nc * 4); this.tint = cp(this.tint, nc * 4);
    this.idx = cp(this.idx, nc * 2); this.cap = nc;
  }
  vert(x, y, z, u, v, tx, ty, sun, blk, ao, fl, r, g, b) {
    if (this.n >= this.cap) this.grow();
    const i = this.n * 4;
    this.pos[i] = x; this.pos[i + 1] = y; this.pos[i + 2] = z;
    this.uv[i] = u; this.uv[i + 1] = v; this.uv[i + 2] = tx; this.uv[i + 3] = ty;
    this.lit[i] = sun; this.lit[i + 1] = blk; this.lit[i + 2] = ao; this.lit[i + 3] = fl;
    this.tint[i] = r; this.tint[i + 1] = g; this.tint[i + 2] = b; this.tint[i + 3] = 255;
    return this.n++;
  }
  quad(a, flip) {
    if (this.ni + 6 > this.idx.length) this.grow();
    const I = this.idx; let k = this.ni;
    if (!flip) { I[k++] = a; I[k++] = a + 1; I[k++] = a + 2; I[k++] = a; I[k++] = a + 2; I[k++] = a + 3; }
    else { I[k++] = a + 1; I[k++] = a + 2; I[k++] = a + 3; I[k++] = a + 1; I[k++] = a + 3; I[k++] = a; }
    this.ni = k;
  }
  quad2(a) { // двусторонний квад — две стороны
    if (this.ni + 12 > this.idx.length) this.grow();
    const I = this.idx; let k = this.ni;
    I[k++] = a; I[k++] = a + 1; I[k++] = a + 2; I[k++] = a; I[k++] = a + 2; I[k++] = a + 3;
    I[k++] = a + 2; I[k++] = a + 1; I[k++] = a; I[k++] = a + 3; I[k++] = a + 2; I[k++] = a;
    this.ni = k;
  }
  finish() {
    if (this.n === 0) return null;
    const big = this.n > 65535;
    const idx = big ? this.idx.slice(0, this.ni) : Uint16Array.from(this.idx.subarray(0, this.ni));
    return { pos: this.pos.slice(0, this.n * 4), uv: this.uv.slice(0, this.n * 4), lit: this.lit.slice(0, this.n * 4), tint: this.tint.slice(0, this.n * 4), idx, n: this.n };
  }
}

// грани: 0:+x 1:-x 2:+y 3:-y 4:+z 5:-z
const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FU = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]];
const FV = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
const FO = [[1, 0, 1], [0, 0, 0], [0, 1, 1], [0, 0, 0], [0, 0, 1], [1, 0, 0]];
const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

let blk, light, H, tints, opts, bufs;
const idx3 = (x, y, z) => (y * RX + z) * RX + x;
const opq = (x, y, z) => (y < 0 ? 1 : y >= H ? 0 : OPAQUE[blk[(y * RX + z) * RX + x]]);
const lt = (x, y, z) => (y < 0 ? 0 : y >= H ? 0xf0 : light[(y * RX + z) * RX + x]);
const bk = (x, y, z) => (y < 0 ? 1 : y >= H ? 0 : blk[(y * RX + z) * RX + x]);
const aoV = new Uint8Array(4), sunV = new Float32Array(4), blkV = new Float32Array(4);

// Общие параметры для одной грани куба
function cubeFace(buf, f, x, y, z, ox, oy, oz, tile, tr, tg, tb, type) {
  const N = FN[f], U = FU[f], V = FV[f], O = FO[f];
  const fx = x + N[0], fy = y + N[1], fz = z + N[2];
  const fl = lt(fx, fy, fz);
  const smooth = opts.smooth, doAO = opts.ao;
  for (let k = 0; k < 4; k++) {
    const su = UV[k][0] ? 1 : -1, sv = UV[k][1] ? 1 : -1;
    if (smooth || doAO) {
      const s1x = fx + su * U[0], s1y = fy + su * U[1], s1z = fz + su * U[2];
      const s2x = fx + sv * V[0], s2y = fy + sv * V[1], s2z = fz + sv * V[2];
      const cx = s1x + sv * V[0], cy = s1y + sv * V[1], cz = s1z + sv * V[2];
      const o1 = opq(s1x, s1y, s1z), o2 = opq(s2x, s2y, s2z), oc = opq(cx, cy, cz);
      aoV[k] = doAO ? ((o1 && o2) ? 0 : 3 - (o1 + o2 + oc)) : 3;
      if (smooth) {
        let sun = fl >> 4, bl = fl & 15, n = 1;
        if (!o1) { const l = lt(s1x, s1y, s1z); sun += l >> 4; bl += l & 15; n++; }
        if (!o2) { const l = lt(s2x, s2y, s2z); sun += l >> 4; bl += l & 15; n++; }
        if (!oc && (!o1 || !o2)) { const l = lt(cx, cy, cz); sun += l >> 4; bl += l & 15; n++; }
        sunV[k] = sun / n; blkV[k] = bl / n;
      } else { sunV[k] = fl >> 4; blkV[k] = fl & 15; }
    } else { aoV[k] = 3; sunV[k] = fl >> 4; blkV[k] = fl & 15; }
  }
  const tx = tile & 15, ty = tile >> 4;
  const a = buf.n;
  for (let k = 0; k < 4; k++) {
    const u = UV[k][0], v = UV[k][1];
    const px = (ox + O[0] + u * U[0] + v * V[0]) * S16, py = (oy + O[1] + u * U[1] + v * V[1]) * S16, pz = (oz + O[2] + u * U[2] + v * V[2]) * S16;
    buf.vert(px, py, pz, u * 16, (1 - v) * 16, tx, ty, Math.round(sunV[k] * 17), Math.round(blkV[k] * 17), aoV[k] * 85, f | (type << 3), tr, tg, tb);
  }
  buf.quad(a, aoV[0] + aoV[2] < aoV[1] + aoV[3]);
}

function boxFace(buf, f, bx, ax, sun, bl, tile, box, type) {
  // box в 1/16, bx = ox*16..; ax = [ox,oy,oz]
  const U = FU[f], V = FV[f], O = FO[f];
  const x0 = box[0], y0 = box[1], z0 = box[2], x1 = box[3], y1 = box[4], z1 = box[5];
  const tx = tile & 15, ty = tile >> 4;
  const a = buf.n;
  for (let k = 0; k < 4; k++) {
    const u = UV[k][0], v = UV[k][1];
    const cx = O[0] + u * U[0] + v * V[0], cy = O[1] + u * U[1] + v * V[1], cz = O[2] + u * U[2] + v * V[2];
    const px = x0 + cx * (x1 - x0), py = y0 + cy * (y1 - y0), pz = z0 + cz * (z1 - z0);
    let tu = U[0] * px + U[1] * py + U[2] * pz; if (U[0] + U[1] + U[2] < 0) tu += 16;
    let tv = V[0] * px + V[1] * py + V[2] * pz; if (V[0] + V[1] + V[2] < 0) tv += 16;
    buf.vert(ax[0] * 16 + px, ax[1] * 16 + py, ax[2] * 16 + pz, Math.max(0, Math.min(16, tu)), Math.max(0, Math.min(16, 16 - tv)), tx, ty, sun, bl, 255, f | (type << 3), 255, 255, 255);
  }
  buf.quad(a, false);
}

const HGT = (l) => (l === 8 ? 16 : l === 0 ? 14 : 14 - l * 1.7);
function cornerH(x, y, z, fam, cx, cz) {
  let sum = 0, w = 0;
  for (let dz = cz - 1; dz <= cz; dz++) for (let dx = cx - 1; dx <= cx; dx++) {
    const nid = bk(x + dx, y, z + dz);
    if (FAMILY[nid] === fam) {
      if (FAMILY[bk(x + dx, y + 1, z + dz)] === fam) return 16;
      const l = LIQ[nid]; const wt = l === 0 ? 10 : 1;
      sum += HGT(l) * wt; w += wt;
    } else if (!SOLID[nid] && !FAMILY[nid]) { w += 1; }
  }
  return w === 0 ? 14 : sum / w;
}

function liquid(buf, x, y, z, ox, oy, oz, id, tr, tg, tb) {
  const fam = FAMILY[id], type = ANIMS[id];
  const tile = FACE_TILES[id * 6 + 2];
  const tx = tile & 15, ty = tile >> 4;
  const own = lt(x, y, z);
  const sun = (own >> 4) * 17, bl = (own & 15) * 17;
  const aboveSame = FAMILY[bk(x, y + 1, z)] === fam;
  // верх
  const above = bk(x, y + 1, z);
  if (!aboveSame && !OPAQUE[above]) {
    const a = buf.n;
    const f = 2, V = FV[2], U = FU[2], O = FO[2];
    for (let k = 0; k < 4; k++) {
      const u = UV[k][0], v = UV[k][1];
      const cx = u, cz = 1 - v;
      const h = cornerH(x, y, z, fam, cx, cz);
      buf.vert((ox + cx) * 16, oy * 16 + h, (oz + cz) * 16, u * 16, (1 - v) * 16, tx, ty, sun, bl, 255, f | (type << 3), tr, tg, tb);
    }
    buf.quad(a, false);
  }
  // низ — если снизу воздух/прозрачный (виден снизу)
  const below = bk(x, y - 1, z);
  if (y > 0 && !OPAQUE[below] && FAMILY[below] !== fam && fam === 2) {
    // лава: дно
    const a = buf.n; const f = 3;
    for (let k = 0; k < 4; k++) { const u = UV[k][0], v = UV[k][1]; buf.vert((ox + u) * 16, oy * 16, (oz + v) * 16, u * 16, (1 - v) * 16, tx, ty, sun, bl, 255, f | (type << 3), tr, tg, tb); }
    buf.quad(a, false);
  }
  // бока
  for (let f = 0; f < 6; f++) {
    if (f === 2 || f === 3) continue;
    const N = FN[f];
    const nid = bk(x + N[0], y, z + N[2]);
    if (FAMILY[nid] === fam || OPAQUE[nid]) continue;
    const U = FU[f], O = FO[f];
    const a = buf.n;
    for (let k = 0; k < 4; k++) {
      const u = UV[k][0], v = UV[k][1];
      const cx = O[0] + u * U[0], cz = O[2] + u * U[2];
      let h = 0;
      if (v) h = aboveSame ? 16 : cornerH(x, y, z, fam, cx, cz);
      buf.vert((ox + cx) * 16, oy * 16 + h, (oz + cz) * 16, u * 16, 16 - h, tx, ty, sun, bl, 255, f | (type << 3), tr, tg, tb);
    }
    buf.quad(a, false);
  }
}

function crossShape(buf, x, y, z, ox, oy, oz, tile, tr, tg, tb, type) {
  const own = lt(x, y, z);
  const sun = (own >> 4) * 17, bl = (own & 15) * 17;
  const tx = tile & 15, ty = tile >> 4;
  const P = [[0, 0, 0, 1, 0, 1], [1, 0, 0, 0, 0, 1]];
  for (const q of P) {
    const a = buf.n;
    const x0 = (ox + q[0]) * 16, z0 = (oz + q[2]) * 16, x1 = (ox + q[3]) * 16, z1 = (oz + q[5]) * 16;
    const yy = oy * 16;
    const fl = 2 | (type << 3);
    buf.vert(x0, yy, z0, 0, 16, tx, ty, sun, bl, 255, fl, tr, tg, tb);
    buf.vert(x1, yy, z1, 16, 16, tx, ty, sun, bl, 255, fl, tr, tg, tb);
    buf.vert(x1, yy + 16, z1, 16, 0, tx, ty, sun, bl, 255, fl, tr, tg, tb);
    buf.vert(x0, yy + 16, z0, 0, 0, tx, ty, sun, bl, 255, fl, tr, tg, tb);
    buf.quad2(a);
  }
}
function cropShape(buf, x, y, z, ox, oy, oz, tile) {
  const own = lt(x, y, z);
  const sun = (own >> 4) * 17, bl = (own & 15) * 17;
  const tx = tile & 15, ty = tile >> 4;
  const yy = oy * 16;
  const planes = [[4, 0, 4, 16], [12, 0, 12, 16], [0, 4, 16, 4], [0, 12, 16, 12]];
  for (const p of planes) {
    const a = buf.n; const fl = 2 | (3 << 3);
    const x0 = ox * 16 + p[0], z0 = oz * 16 + p[1], x1 = ox * 16 + p[2], z1 = oz * 16 + p[3];
    // плоскости вида x=const: (p0,0)->(p2=p0,16); z=const: (0,p1)->(16,p1)
    const xa = p[0], za = p[1], xb = p[2], zb = p[3];
    buf.vert(ox * 16 + xa, yy, oz * 16 + za, 0, 16, tx, ty, sun, bl, 255, fl, 255, 255, 255);
    buf.vert(ox * 16 + xb, yy, oz * 16 + zb, 16, 16, tx, ty, sun, bl, 255, fl, 255, 255, 255);
    buf.vert(ox * 16 + xb, yy + 16, oz * 16 + zb, 16, 0, tx, ty, sun, bl, 255, fl, 255, 255, 255);
    buf.vert(ox * 16 + xa, yy + 16, oz * 16 + za, 0, 0, tx, ty, sun, bl, 255, fl, 255, 255, 255);
    buf.quad2(a);
  }
}

const PANE_BOXES = [];
function paneBoxes(x, y, z) {
  PANE_BOXES.length = 0;
  PANE_BOXES.push([7, 0, 7, 9, 16, 9]);
  const conn = (nx, ny, nz) => { const n = bk(nx, ny, nz); return n === B.glass_pane || OPAQUE[n] || n === B.glass; };
  if (conn(x, y, z - 1)) PANE_BOXES.push([7, 0, 0, 9, 16, 7]);
  if (conn(x, y, z + 1)) PANE_BOXES.push([7, 0, 9, 9, 16, 16]);
  if (conn(x - 1, y, z)) PANE_BOXES.push([0, 0, 7, 7, 16, 9]);
  if (conn(x + 1, y, z)) PANE_BOXES.push([9, 0, 7, 16, 16, 9]);
  return PANE_BOXES;
}

function boxShape(buf, x, y, z, ox, oy, oz, id, boxes) {
  const own = lt(x, y, z);
  const ax = [ox, oy, oz];
  for (const box of boxes) {
    for (let f = 0; f < 6; f++) {
      const N = FN[f];
      let boundary = false;
      switch (f) {
        case 0: boundary = box[3] === 16; break; case 1: boundary = box[0] === 0; break;
        case 2: boundary = box[4] === 16; break; case 3: boundary = box[1] === 0; break;
        case 4: boundary = box[5] === 16; break; case 5: boundary = box[2] === 0; break;
      }
      let l = own;
      if (boundary) {
        const nid = bk(x + N[0], y + N[1], z + N[2]);
        if (OPAQUE[nid] || (nid === id && BLOCKS[id].shape !== SHAPE.PANE)) continue;
        l = lt(x + N[0], y + N[1], z + N[2]);
      }
      boxFace(buf, f, 0, ax, (l >> 4) * 17, (l & 15) * 17, FACE_TILES[id * 6 + f], box, 0);
    }
  }
}

// ---------- главная функция ----------
// region: {blk,light,H}, tints: {grass,foliage,water: Uint8Array 18*18*3}, o: {ao, smooth}
export function meshChunk(blkArr, lightArr, h, tintArr, o) {
  blk = blkArr; light = lightArr; H = h; tints = tintArr; opts = o;
  bufs = [new Buf(), new Buf(), new Buf()];
  let verts = 0;
  for (let y = 0; y < H; y++) {
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const x = lx + 16, z = lz + 16;
        const id = blk[(y * RX + z) * RX + x];
        if (id === 0) continue;
        const shape = SHAPES[id];
        const buf = bufs[LAYERS[id]];
        const ti = ((lz + 1) * 18 + (lx + 1)) * 3;
        const tt = TINTS[id];
        let tr = 255, tg = 255, tb = 255;
        if (tt) { const T = tt === TINT.GRASS ? tints.grass : tt === TINT.FOLIAGE ? tints.foliage : tints.water; tr = T[ti]; tg = T[ti + 1]; tb = T[ti + 2]; }
        switch (shape) {
          case SHAPE.CUBE: {
            const layer = LAYERS[id];
            const isGrass = tt === TINT.GRASS, isLeaf = tt === TINT.FOLIAGE;
            for (let f = 0; f < 6; f++) {
              const N = FN[f];
              const nid = bk(x + N[0], y + N[1], z + N[2]);
              if (OPAQUE[nid]) continue;
              if (nid === id && (layer !== LAYER.OPAQUE)) continue;
              const tile = FACE_TILES[id * 6 + f];
              if (isGrass) {
                if (f === 2) cubeFace(buf, f, x, y, z, lx, y, lz, tile, tr, tg, tb, 0);
                else if (f === 3) cubeFace(buf, f, x, y, z, lx, y, lz, tile, 255, 255, 255, 0);
                else cubeFace(buf, f, x, y, z, lx, y, lz, tile, tr, tg, tb, 5);
              } else cubeFace(buf, f, x, y, z, lx, y, lz, tile, tr, tg, tb, isLeaf ? 4 : 0);
            }
            break;
          }
          case SHAPE.LIQUID: liquid(buf, x, y, z, lx, y, lz, id, tr, tg, tb); break;
          case SHAPE.CROSS: crossShape(buf, x, y, z, lx, y, lz, FACE_TILES[id * 6 + 2], tr, tg, tb, ANIMS[id]); break;
          case SHAPE.CROP: cropShape(buf, x, y, z, lx, y, lz, FACE_TILES[id * 6 + 2]); break;
          case SHAPE.BOX: boxShape(buf, x, y, z, lx, y, lz, id, BLOCKS[id].boxes); break;
          case SHAPE.PANE: boxShape(buf, x, y, z, lx, y, lz, id, paneBoxes(x, y, z)); break;
        }
      }
    }
  }
  const out = bufs.map((b) => b.finish());
  return out;
}

// Цвета биомов -> сглаженные тинты 18x18 (для клеток -1..16 чанка)
export function buildTints(biomes9, BIOMES) {
  // biomes9: Uint8Array 48x48 (регион)
  const grass = new Uint8Array(18 * 18 * 3), foliage = new Uint8Array(18 * 18 * 3), water = new Uint8Array(18 * 18 * 3);
  const R = 2;
  for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) {
    let gr = 0, gg = 0, gb = 0, fr = 0, fg = 0, fb = 0, wr = 0, wg = 0, wb = 0, n = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const bi = biomes9[(z + 16 + dz) * 48 + (x + 16 + dx)];
      const b = BIOMES[bi];
      gr += b.grass[0]; gg += b.grass[1]; gb += b.grass[2];
      fr += b.foliage[0]; fg += b.foliage[1]; fb += b.foliage[2];
      wr += b.water[0]; wg += b.water[1]; wb += b.water[2]; n++;
    }
    const i = ((z + 1) * 18 + (x + 1)) * 3;
    grass[i] = gr / n; grass[i + 1] = gg / n; grass[i + 2] = gb / n;
    foliage[i] = fr / n; foliage[i + 1] = fg / n; foliage[i + 2] = fb / n;
    water[i] = wr / n; water[i + 1] = wg / n; water[i + 2] = wb / n;
  }
  return { grass, foliage, water };
}
