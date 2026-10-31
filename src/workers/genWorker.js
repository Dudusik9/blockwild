// Воркер генерации чанков
import { Generator } from '../world/generator.js';
let gen = null, gkey = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'gen') {
    const k = m.seed + ':' + (m.city ? 'city' + (m.cityVer || 1) : '');
    if (!gen || gkey !== k) { gen = new Generator(m.seed, { city: !!m.city, cityVer: m.cityVer }); gkey = k; }
    const r = gen.generate(m.cx, m.cz);
    // обрезаем до maxY+2 рядов, чтобы пересылать меньше
    const rows = Math.min(256, r.maxY + 2);
    const blocks = r.blocks.slice(0, rows << 8);
    self.postMessage({ type: 'gen', id: m.id, cx: m.cx, cz: m.cz, blocks, biomes: r.biomes, heights: r.heights, bes: r.bes, maxY: r.maxY }, [blocks.buffer, r.biomes.buffer, r.heights.buffer]);
  }
};
