// Освещение: BFS-заливка солнечного (верхний ниббл) и блочного (нижний ниббл) света, 15 уровней.
// Работает по региону 3x3 чанка (48x48xH) — центральный чанк получается точным (свет распространяется <= 15 блоков).
import { OPAC, EMIT } from './blocks.js';

export const RX = 48;
const QSIZE = 1 << 21;
let queue = null;

// blk: Uint16Array региона (idx=(y*48+z)*48+x); H — высота региона; light: Uint8Array того же размера (заполняется)
export function computeLight(blk, H, light) {
  if (!queue) queue = new Int32Array(QSIZE);
  const stride = RX * RX;
  const total = stride * H;
  light.fill(0, 0, total);
  let qh = 0, qt = 0;

  // --- солнце: вертикальные столбцы
  for (let z = 0; z < RX; z++) for (let x = 0; x < RX; x++) {
    let l = 15;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * stride + z * RX + x;
      const o = OPAC[blk[i]];
      if (o >= 15) break;
      if (o > 0) { l -= o; if (l <= 0) break; }
      light[i] = l << 4;
    }
  }
  // --- солнце: затравка границ света
  for (let y = 0; y < H; y++) {
    const yb = y * stride;
    for (let z = 0; z < RX; z++) {
      const zb = yb + z * RX;
      for (let x = 0; x < RX; x++) {
        const i = zb + x;
        const s = light[i] >> 4;
        if (s <= 1) continue;
        // сосед горизонтально, ниже по свету
        let need = false;
        if (x > 0 && (light[i - 1] >> 4) < s - 1 && OPAC[blk[i - 1]] < 15) need = true;
        else if (x < RX - 1 && (light[i + 1] >> 4) < s - 1 && OPAC[blk[i + 1]] < 15) need = true;
        else if (z > 0 && (light[i - RX] >> 4) < s - 1 && OPAC[blk[i - RX]] < 15) need = true;
        else if (z < RX - 1 && (light[i + RX] >> 4) < s - 1 && OPAC[blk[i + RX]] < 15) need = true;
        else if (y > 0 && (light[i - stride] >> 4) < s - 1 && OPAC[blk[i - stride]] < 15) need = true;
        if (need && qt < QSIZE) queue[qt++] = i;
      }
    }
  }
  // --- BFS солнца
  while (qh < qt) {
    const i = queue[qh++];
    const s = light[i] >> 4;
    if (s <= 1) continue;
    const y = (i / stride) | 0, r = i - y * stride, z = (r / RX) | 0, x = r - z * RX;
    for (let d = 0; d < 6; d++) {
      let j;
      if (d === 0) { if (x === 0) continue; j = i - 1; }
      else if (d === 1) { if (x === RX - 1) continue; j = i + 1; }
      else if (d === 2) { if (z === 0) continue; j = i - RX; }
      else if (d === 3) { if (z === RX - 1) continue; j = i + RX; }
      else if (d === 4) { if (y === 0) continue; j = i - stride; }
      else { if (y === H - 1) continue; j = i + stride; }
      const o = OPAC[blk[j]];
      if (o >= 15) continue;
      const loss = o > 1 ? o : 1;
      const nl = s - loss;
      if (nl > (light[j] >> 4)) {
        light[j] = (light[j] & 15) | (nl << 4);
        if (nl > 1 && qt < QSIZE) queue[qt++] = j;
      }
    }
  }

  // --- блочный свет
  qh = 0; qt = 0;
  for (let i = 0; i < total; i++) {
    const e = EMIT[blk[i]];
    if (e > 0) { light[i] = (light[i] & 0xf0) | e; if (qt < QSIZE) queue[qt++] = i; }
  }
  while (qh < qt) {
    const i = queue[qh++];
    const s = light[i] & 15;
    if (s <= 1) continue;
    const y = (i / stride) | 0, r = i - y * stride, z = (r / RX) | 0, x = r - z * RX;
    for (let d = 0; d < 6; d++) {
      let j;
      if (d === 0) { if (x === 0) continue; j = i - 1; }
      else if (d === 1) { if (x === RX - 1) continue; j = i + 1; }
      else if (d === 2) { if (z === 0) continue; j = i - RX; }
      else if (d === 3) { if (z === RX - 1) continue; j = i + RX; }
      else if (d === 4) { if (y === 0) continue; j = i - stride; }
      else { if (y === H - 1) continue; j = i + stride; }
      const o = OPAC[blk[j]];
      if (o >= 15) continue;
      const nl = s - (o > 1 ? o : 1);
      if (nl > (light[j] & 15)) {
        light[j] = (light[j] & 0xf0) | nl;
        if (nl > 1 && qt < QSIZE) queue[qt++] = j;
      }
    }
  }
}
