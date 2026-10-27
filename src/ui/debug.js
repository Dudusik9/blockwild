// F3: отладочная информация
import { BIOMES } from '../world/biomes.js';
import { BLOCKS } from '../world/blocks.js';

export class DebugOverlay {
  constructor(el) { this.el = el; this.visible = false; this.t = 0; }
  toggle() { this.visible = !this.visible; this.el.classList.toggle('hidden', !this.visible); }
  update(g) {
    const now = performance.now();
    if (now - this.t < 120) return; this.t = now;
    const p = g.player, w = g.world;
    let lines = [];
    lines.push(`Blockwild   ${g.fps.toFixed(0)} FPS   dist ${g.settings.renderDistance}`);
    if (p && w) {
      const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
      const cx = bx >> 4, cz = bz >> 4;
      const biome = BIOMES[w.getBiome(bx, bz)];
      const lt = w.getLight(bx, by + 1, bz);
      const dirs = ['юг (+Z)', 'запад (-X)', 'север (-Z)', 'восток (+X)'];
      const dir = dirs[((Math.round(((-p.yaw) / (Math.PI / 2)) % 4) + 4) % 4)];
      lines.push(`XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`);
      lines.push(`Блок: ${bx} ${by} ${bz}   Чанк: ${cx} ${cz} (${bx & 15},${bz & 15})`);
      lines.push(`Взгляд: ${dir}  yaw ${(p.yaw * 57.2958).toFixed(1)} pitch ${(p.pitch * 57.2958).toFixed(1)}`);
      lines.push(`Биом: ${biome ? biome.name : '?'}   Свет: солнце ${lt >> 4}, блок ${lt & 15}`);
      lines.push(`Режим: ${p.mode}${p.flying ? ' (полёт)' : ''}   на земле: ${p.onGround ? 'да' : 'нет'}   вода: ${p.inWater ? 'да' : 'нет'}`);
      lines.push(`Время: ${Math.floor(g.time)} (день ${g.day})   погода: дождь ${g.rain.toFixed(2)} гроза ${g.thunder.toFixed(2)}`);
      lines.push(`Чанки: ${w.stats.chunks} (мешей ${w.stats.meshed})  вершин ${w.stats.verts}  треугольников ${w.stats.tris}`);
      lines.push(`Очереди: ген ${w.genPool.workers.length - w.genPool.free}/${w.genPool.workers.length}, меш ${w.meshPool.workers.length - w.meshPool.free}/${w.meshPool.workers.length}, готово ${w.results.length}`);
      if (g.target) { const b = BLOCKS[g.target.id]; lines.push(`Цель: ${b ? b.name : '?'} (${g.target.x} ${g.target.y} ${g.target.z}) грань ${g.target.nx},${g.target.ny},${g.target.nz}`); }
      if (g.entities) lines.push(`Сущности: ${g.entities.count()}  (мобы ${g.entities.mobCount ? g.entities.mobCount() : 0})`);
      const info = g.renderer.info.render;
      lines.push(`Draw calls: ${info.calls}   треуг. кадра: ${info.triangles}`);
    }
    if (performance.memory) lines.push(`Память: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} / ${(performance.memory.totalJSHeapSize / 1048576).toFixed(0)} МБ`);
    this.el.textContent = lines.join('\n');
  }
}
