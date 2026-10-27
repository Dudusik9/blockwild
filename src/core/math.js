export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mod = (a, n) => ((a % n) + n) % n;
export const CH = 256;            // высота чанка
export const CS = 16;             // сторона чанка
export const SEA = 62;            // уровень моря
export const floorDiv = (a, n) => Math.floor(a / n);
export const ckey = (cx, cz) => cx * 65536 + cz + 0x7fffffff; // уникальный ключ (cx,cz в ±30000)
export function piecewise(x, pts) { // pts: [[x,y],...]
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) { const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t; }
  }
  return pts[pts.length - 1][1];
}
