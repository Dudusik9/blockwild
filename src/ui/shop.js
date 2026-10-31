// Автосалон спасателей: крупные карточки транспорта с картинками, цена в ⭐ из миссий (в творческом — бесплатно)
import { VEHICLES, CAR_COLORS, TRUCK_COLORS } from '../entity/carbot.js';
import { SOLID } from '../world/blocks.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// картинка транспорта сбоку (пиксельная, без текстур)
function drawVehicle(v, W = 160, H = 100) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const R = (px, py, w, hh, col) => { x.fillStyle = col; x.fillRect(px, py, w, hh); };
  const wheel = (cx, cy, r) => { x.fillStyle = '#202024'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.fillStyle = '#b8b8c0'; x.beginPath(); x.arc(cx, cy, r * 0.45, 0, 7); x.fill(); };
  const eye = (ex, ey) => { R(ex, ey, 9, 9, '#fff'); R(ex + 3, ey + 3, 5, 5, '#1a2a50'); R(ex + 3, ey + 3, 2, 2, '#fff'); };
  if (v.kind === 'car') {
    const s = CAR_COLORS[v.style];
    R(18, 46, 124, 28, s.body); R(18, 56, 124, 4, s.stripe); R(46, 22, 66, 26, s.dark); R(52, 27, 54, 16, '#a8dcff');
    eye(58, 29); eye(88, 29); R(134, 50, 8, 7, '#fff6b0'); R(18, 50, 6, 6, '#ff4030');
    if (s.siren) { R(66, 14, 12, 8, s.siren[0]); R(80, 14, 12, 8, s.siren[1]); }
    if (s.ladder) { R(36, 16, 90, 5, '#d8c8a0'); for (let k = 40; k < 124; k += 10) R(k, 14, 3, 9, '#8a6a44'); }
    if (s.speed) { R(14, 32, 26, 5, '#141414'); R(22, 37, 4, 10, '#141414'); }
    if (s.cross) { R(92, 51, 18, 6, '#e8302a'); R(98, 45, 6, 18, '#e8302a'); }
    wheel(45, 76, 13); wheel(117, 76, 13);
  } else if (v.kind === 'truck' || v.kind === 'dump') {
    const s = TRUCK_COLORS[v.kind];
    if (v.kind === 'dump') { x.save(); x.translate(14, 54); x.rotate(-0.35); R(0, -28, 90, 28, s.bed); R(0, -28, 90, 4, '#8a6a10'); x.restore(); }
    else { R(12, 30, 92, 26, s.bed); for (let k = 16; k < 100; k += 14) R(k, 30, 3, 26, '#6a4a24'); }
    R(10, 56, 140, 10, '#3a3a40'); R(104, 22, 44, 36, s.cab); R(108, 27, 36, 16, '#a8dcff'); eye(112, 29); eye(130, 29); R(142, 46, 6, 6, '#fff6b0');
    wheel(30, 72, 12); wheel(58, 72, 12); wheel(126, 72, 12);
  } else {
    R(70, 8, 6, 10, '#5a5a66'); R(8, 6, 144, 5, '#2a2a30');
    R(38, 18, 78, 46, '#e8382c'); R(84, 24, 30, 22, '#a8dcff'); eye(88, 27); eye(102, 27);
    R(38, 46, 78, 6, '#ffffff'); R(54, 34, 6, 18, '#ffffff'); R(48, 40, 18, 6, '#ffffff');
    R(4, 30, 36, 10, '#e8382c'); R(2, 18, 8, 22, '#ffffff'); R(30, 70, 96, 5, '#5a5a66'); R(50, 62, 4, 8, '#5a5a66'); R(100, 62, 4, 8, '#5a5a66');
  }
  return c;
}

export class Shop {
  constructor(g) {
    this.g = g; this.el = null;
    window.addEventListener('keydown', (e) => { if (this.el && (e.code === 'Escape' || e.code === 'KeyE')) { e.preventDefault(); this.close(); } });
  }
  get isOpen() { return !!this.el; }
  stars() { return this.g.quests?.st.stars || 0; }
  free() { return this.g.player?.creative; }
  open() {
    const g = this.g; if (this.el) return;
    g.uiOpen = true; g.controls.keys.clear();
    g.ignoreUnlock = true; g.controls.unlock(); setTimeout(() => { g.ignoreUnlock = false; }, 400);
    g.touch?.setUIMode(true);
    this.el = h('div', 'shop-wrap');
    const panel = h('div', 'shop');
    const head = h('div', 'shop-head');
    head.appendChild(h('div', 'shop-title', '🚗 Автосалон спасателей'));
    this.starEl = h('div', 'shop-stars'); head.appendChild(this.starEl);
    const x = h('button', 'shop-close', '✕'); x.onclick = () => this.close(); head.appendChild(x);
    panel.appendChild(head);
    const grid = h('div', 'shop-grid scroll');
    this.cards = [];
    for (const v of VEHICLES) {
      const card = h('div', 'shop-card');
      card.appendChild(drawVehicle(v));
      card.appendChild(h('div', 'shop-name', v.title));
      const price = h('div', 'shop-price', this.free() ? 'бесплатно' : '⭐'.repeat(v.price)); card.appendChild(price);
      card.addEventListener('click', () => this.buy(v));
      grid.appendChild(card); this.cards.push([card, v]);
    }
    panel.appendChild(grid);
    this.el.appendChild(panel);
    this.el.addEventListener('mousedown', (e) => { if (e.target === this.el) this.close(); });
    document.getElementById('screens').appendChild(this.el);
    this.refresh();
    g.quests?.say('shop_hello');
  }
  refresh() {
    const n = this.stars();
    this.starEl.textContent = this.free() ? 'Творческий режим — всё бесплатно' : 'У тебя ⭐ ' + n;
    for (const [card, v] of this.cards) card.classList.toggle('poor', !this.free() && n < v.price);
  }
  close() {
    const g = this.g; if (!this.el) return;
    this.el.remove(); this.el = null;
    g.uiOpen = false; g.touch?.setUIMode(false);
    if (g.state === 'playing') g.relock();
  }
  buy(v) {
    const g = this.g, q = g.quests;
    if (!this.free()) {
      if (this.stars() < v.price) { q?.say('shop_need'); g.sfx?.play('break_tool', null, 0.5); return; }
      q.st.stars -= v.price;
    }
    const pos = this.spot(v.kind);
    const car = g.spawnCarbot(pos.x, pos.y, pos.z, pos.yaw, v.style, false, v.kind);
    g.particles?.confetti(car.x, car.y + 1.5, car.z, 40);
    g.sfx?.play('craft', null, 1.2, 1.3);
    q?.say(v.kind === 'heli' ? 'shop_heli' : v.kind === 'car' ? 'shop_car' : 'shop_truck');
    this.close();
  }
  // где поставить покупку: площадка выдачи (вертолёт — вертолётная площадка), иначе перед игроком
  spot(kind) {
    const g = this.g, t = g.meta.town, p = g.player;
    let base = (kind === 'heli' && t?.heli) || t?.shopPad;
    if (!base || Math.hypot(base.x - p.x, base.z - p.z) > 60) base = { x: p.x - Math.sin(p.yaw) * 4, y: p.y + 0.5, z: p.z - Math.cos(p.yaw) * 4 };
    const busy = (x, z) => g.entities.list.some((e) => e.type === 'carbot' && !e.dead && Math.hypot(e.x - x, e.z - z) < 2.2);
    const w = g.world, free = (x, z) => !busy(x, z) && !SOLID[w.getBlock(Math.floor(x), Math.floor(base.y), Math.floor(z))] && !SOLID[w.getBlock(Math.floor(x), Math.floor(base.y) + 1, Math.floor(z))];
    for (const dz of [0, 4, -4, 8, -8]) for (const dx of [0, 3, -3, 6, -6, 9, -9]) {
      const x = base.x + dx, z = base.z + dz;
      if (free(x, z)) return { x, y: base.y + 0.05, z, yaw: Math.PI };
    }
    return { x: base.x, y: base.y + 2, z: base.z, yaw: Math.PI };
  }
}
