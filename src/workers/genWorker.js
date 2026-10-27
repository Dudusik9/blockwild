// Воркер генерации чанков
import { Generator } from '../world/generator.js';
let gen = null, gseed = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'gen') {
    if (!gen || gseed !== m.seed) { gen = new Generator(m.seed); gseed = m.seed; }
    const r = gen.generate(m.cx, m.cz);
    // обрезаем до maxY+2 рядов, чтобы пересылать меньше
    const rows = Math.min(256, r.maxY + 2);
    const blocks = r.blocks.slice(0, rows << 8);
    self.postMessage({ type: 'gen', id: m.id, cx: m.cx, cz: m.cz, blocks, biomes: r.biomes, heights: r.heights, bes: r.bes, maxY: r.maxY }, [blocks.buffer, r.biomes.buffer, r.heights.buffer]);
  }
};
