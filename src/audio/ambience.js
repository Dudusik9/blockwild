// Окружение: музыка (генеративная пентатоника), пещерные звуки, ветер, дождь
const SCALE = [0, 2, 4, 7, 9]; // мажорная пентатоника

export class Ambience {
  constructor(game) {
    this.g = game; this.musicT = 25 + Math.random() * 40; this.caveT = 8; this.windT = 0;
    this.root = 220 * Math.pow(2, [0, 2, -3, 5][Math.floor(Math.random() * 4)] / 12);
  }
  update(dt) {
    const g = this.g, s = g.sfx;
    if (!s || !s.ctx || s.ctx.state !== 'running' || !g.player || g.state !== 'playing') return;
    const p = g.player, w = g.world;
    const light = w.getLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z));
    const underground = (light >> 4) < 3 && p.y < w.topY(Math.floor(p.x), Math.floor(p.z)) - 3;
    // дождь
    const roofed = underground || (p.y + 1 < w.topY(Math.floor(p.x), Math.floor(p.z)));
    s.setRain(g.rain * (roofed ? 0.25 : 1));
    s.setWind(Math.min(1, 0.25 + g.rain * 0.6 + Math.max(0, (p.y - 80) / 80)) * (underground ? 0.1 : 1));
    // музыка
    this.musicT -= dt;
    if (this.musicT <= 0 && !underground) {
      this.musicT = 70 + Math.random() * 130;
      this.phrase();
    }
    // пещера
    if (underground) {
      this.caveT -= dt;
      if (this.caveT <= 0) {
        this.caveT = 7 + Math.random() * 16;
        const a = Math.random() * 6.28, d = 6 + Math.random() * 10;
        const pos = { x: p.x + Math.cos(a) * d, y: p.y, z: p.z + Math.sin(a) * d };
        const r = Math.random();
        if (r < 0.6) s.play('drip', pos, 0.9, 0.7 + Math.random() * 0.8);
        else if (r < 0.85) s.noise({ pos, type: 'lowpass', f0: 200, f1: 70, dur: 2.5, gain: 0.35, attack: 0.8 });
        else s.tone({ pos, f0: 60 + Math.random() * 30, f1: 45, dur: 3, type: 'sine', gain: 0.25, attack: 1 });
      }
    }
  }
  phrase() {
    const s = this.g.sfx, c = s.ctx;
    let t = c.currentTime + 0.2;
    const n = 4 + Math.floor(Math.random() * 5);
    let deg = Math.floor(Math.random() * 5), oct = 1;
    for (let i = 0; i < n; i++) {
      const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
      deg += step;
      while (deg < 0) { deg += 5; oct -= 1; } while (deg > 4) { deg -= 5; oct += 1; }
      oct = Math.max(0, Math.min(2, oct));
      const f = this.root * Math.pow(2, oct + SCALE[deg] / 12);
      s.note(f, t, 4 + Math.random() * 2.5, 0.09);
      if (i === 0 || Math.random() < 0.25) s.note(this.root / 2, t, 7, 0.06, 'triangle');
      t += 1.4 + Math.random() * 1.8;
    }
  }
}
