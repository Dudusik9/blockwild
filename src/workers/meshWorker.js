// Воркер: освещение региона 3x3 + меширование центрального чанка
import { computeLight, RX } from '../world/lighting.js';
import { meshChunk, buildTints } from '../render/mesher.js';
import { BIOMES } from '../world/biomes.js';

const blk = new Uint16Array(RX * RX * 256);
const lgt = new Uint8Array(RX * RX * 256);
const bio = new Uint8Array(RX * RX);

self.onmessage = (e) => {
  const m = e.data;
  if (m.type !== 'mesh') return;
  const chunks = m.chunks;
  let H = 0;
  for (let k = 0; k < 9; k++) H = Math.max(H, chunks[k].length >> 8);
  H = Math.min(256, H);
  const stride = RX * RX;
  for (let k = 0; k < 9; k++) {
    const ch = chunks[k], rows = ch.length >> 8;
    const ox = (k % 3) * 16, oz = ((k / 3) | 0) * 16;
    for (let y = 0; y < H; y++) {
      for (let z = 0; z < 16; z++) {
        const dst = y * stride + (oz + z) * RX + ox;
        if (y < rows) blk.set(ch.subarray((y << 8) + (z << 4), (y << 8) + (z << 4) + 16), dst);
        else blk.fill(0, dst, dst + 16);
      }
    }
    const bm = m.biomes[k];
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) bio[(oz + z) * RX + ox + x] = bm[z * 16 + x];
  }
  computeLight(blk, H, lgt);
  const tints = buildTints(bio, BIOMES);
  const layers = meshChunk(blk, lgt, H, tints, m.opts);
  // свет центрального чанка
  const light = new Uint8Array(H << 8);
  for (let y = 0; y < H; y++) for (let z = 0; z < 16; z++) {
    const src = y * stride + (16 + z) * RX + 16;
    light.set(lgt.subarray(src, src + 16), (y << 8) + (z << 4));
  }
  const tr = [light.buffer];
  for (const l of layers) if (l) tr.push(l.pos.buffer, l.uv.buffer, l.lit.buffer, l.tint.buffer, l.idx.buffer);
  self.postMessage({ type: 'mesh', id: m.id, cx: m.cx, cz: m.cz, ver: m.ver, layers, light }, tr);
};
