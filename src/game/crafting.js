// Сопоставление сетки крафта с рецептами
import { RECIPES, tagMatches } from './recipes.js';
import { ITEMS, I } from './items.js';

const nameOf = (s) => (s ? ITEMS.get(s.id).name : null);

function keyMatch(spec, name) {
  if (!name) return false;
  if (spec[0] === '#') return tagMatches(spec.slice(1), name);
  return spec === name;
}

// grid: массив стеков (n*n); n — сторона. Возвращает {recipe, count, id} или null
export function matchRecipe(grid, n) {
  // обрезка пустых строк/столбцов
  let minX = n, minY = n, maxX = -1, maxY = -1; const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const s = grid[y * n + x];
    if (s) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); cells.push(nameOf(s)); }
  }
  if (!cells.length) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  for (const r of RECIPES) {
    if (r.list) {
      if (r.list.length !== cells.length) continue;
      const left = cells.slice(); let ok = true;
      for (const spec of r.list) { const i = left.findIndex((nm) => keyMatch(spec, nm)); if (i < 0) { ok = false; break; } left.splice(i, 1); }
      if (ok) return { recipe: r, id: r.outId, count: r.n };
      continue;
    }
    if (r.w !== w || r.h !== h) continue;
    for (let mirror = 0; mirror < 2; mirror++) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const sym = r.rows[y][mirror ? w - 1 - x : x];
        const nm = nameOf(grid[(y + minY) * n + (x + minX)]);
        if (sym === '.') { if (nm) ok = false; }
        else if (!keyMatch(r.key[sym], nm)) ok = false;
      }
      if (ok) return { recipe: r, id: r.outId, count: r.n };
    }
  }
  return null;
}
export function consumeGrid(grid) {
  for (let i = 0; i < grid.length; i++) { const s = grid[i]; if (s) { s.count--; if (s.count <= 0) grid[i] = null; } }
}
