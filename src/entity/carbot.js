// Машинка-робот: на ней можно ездить, а по кнопке она превращается в робота и ходит рядом.
import { Entity } from './entity.js';
import { MobModel, Paint, faceRects } from './mobmodel.js';
import { moveEntity } from '../player/physics.js';
import { isWater, SOLID } from '../world/blocks.js';
import { lightBrightness } from './items-drop.js';
import { getItem } from '../game/items.js';

export const CAR_COLORS = {
  red: { body: '#d8382c', dark: '#9a2018', stripe: '#ffffff', star: '#ffd23a' },
  blue: { body: '#2f6ee0', dark: '#1c449a', stripe: '#ffd23a', star: '#e8302a' },
  yellow: { body: '#f2c21c', dark: '#b08810', stripe: '#2a2a2a', star: '#ffffff' },
  green: { body: '#3cb44a', dark: '#24782e', stripe: '#ffffff', star: '#ffd23a' },
};
const WOOL_COLOR = { wool_red: 'red', wool_blue: 'blue', wool_yellow: 'yellow', wool_green: 'green' };

const DEF = {
  tw: 128, th: 64,
  parts: [
    { n: 'body', size: [16, 6, 28], uv: [0, 0], pivot: [0, 6, 0], off: [0, 0, 0] },
    { n: 'cabin', size: [14, 6, 13], uv: [0, 34], pivot: [0, 12, -3], off: [0, 0, 0] },
    { n: 'wFL', size: [4, 7, 7], uv: [56, 34], pivot: [9, 3.5, 9], off: [0, 0, 0] }, { n: 'wFR', size: [4, 7, 7], uv: [56, 34], pivot: [-9, 3.5, 9], off: [0, 0, 0] },
    { n: 'wBL', size: [4, 7, 7], uv: [56, 34], pivot: [9, 3.5, -9], off: [0, 0, 0] }, { n: 'wBR', size: [4, 7, 7], uv: [56, 34], pivot: [-9, 3.5, -9], off: [0, 0, 0] },
    { n: 'armL', size: [4, 14, 4], uv: [80, 34], pivot: [10.5, 30, 0], off: [0, -6, 0] }, { n: 'armR', size: [4, 14, 4], uv: [80, 34], pivot: [-10.5, 30, 0], off: [0, -6, 0] },
    { n: 'legL', size: [5, 14, 5], uv: [96, 34], pivot: [4, 7, 0], off: [0, 0, 0] }, { n: 'legR', size: [5, 14, 5], uv: [96, 34], pivot: [-4, 7, 0], off: [0, 0, 0] },
  ],
};
// позы: позиция (px) и поворот по x для машинки (0) и робота (1)
const POSE = {
  body: [[0, 6, 0, 0], [0, 26, 0, Math.PI / 2]],
  cabin: [[0, 12, -3, 0], [0, 43, 0, 0]],
  wFL: [[9, 3.5, 9, 0], [10.5, 38, 0, 0]], wFR: [[-9, 3.5, 9, 0], [-10.5, 38, 0, 0]],
  wBL: [[9, 3.5, -9, 0], [7.5, 4, 0, 0]], wBR: [[-9, 3.5, -9, 0], [-7.5, 4, 0, 0]],
  armL: [[8, 10, 0, 0], [10.5, 36, 0, 0]], armR: [[-8, 10, 0, 0], [-10.5, 36, 0, 0]],
  legL: [[4, 6, 0, 0], [4, 7, 0, 0]], legR: [[-4, 6, 0, 0], [-4, 7, 0, 0]],
};
const GROW = new Set(['armL', 'armR', 'legL', 'legR']); // в машинке спрятаны

const texCache = {};
function carTex(color) {
  if (texCache[color]) return texCache[color];
  const c = CAR_COLORS[color] || CAR_COLORS.red, P = new Paint(128, 64, 4242);
  const B_ = P.box(0, 0, 16, 6, 28, c.body, 0.05);
  // капот (в роботе — грудь): полоса и звезда
  const [tx, ty] = B_.top; P.rect(tx + 6, ty, 4, 28, c.stripe);
  for (const [dx, dy] of [[7, 9], [8, 9], [6, 10], [7, 10], [8, 10], [9, 10], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11], [6, 12], [7, 12], [8, 12], [9, 12], [6, 13], [9, 13]]) P.px(tx + dx, ty + dy, c.star);
  // перед: бампер и фары; зад: стоп-сигналы
  const [fx, fy] = B_.front; P.rect(fx, fy + 4, 16, 2, '#3a3a40'); P.rect(fx + 1, fy + 1, 3, 2, '#fff6b0'); P.rect(fx + 12, fy + 1, 3, 2, '#fff6b0');
  const [bx, by] = B_.back; P.rect(bx + 1, by + 1, 3, 2, '#ff4030'); P.rect(bx + 12, by + 1, 3, 2, '#ff4030'); P.rect(bx, by + 4, 16, 2, '#3a3a40');
  for (const k of ['left', 'right']) { const [sx, sy] = B_[k]; P.rect(sx, sy + 2, 28, 1, c.stripe); }
  // кабина-голова: стёкла и большие глаза в лобовом стекле
  const C = P.box(0, 34, 14, 6, 13, c.dark, 0.04);
  const [cx, cy] = C.front; P.rect(cx + 1, cy + 1, 12, 4, '#a8dcff');
  P.rect(cx + 2, cy + 1, 3, 3, '#ffffff'); P.rect(cx + 9, cy + 1, 3, 3, '#ffffff'); P.rect(cx + 3, cy + 2, 2, 2, '#1a2a50'); P.rect(cx + 9, cy + 2, 2, 2, '#1a2a50');
  P.px(cx + 3, cy + 2, '#ffffff'); P.px(cx + 9, cy + 2, '#ffffff'); P.rect(cx + 5, cy + 5, 4, 1, '#ffffff');
  for (const k of ['left', 'right', 'back']) { const r = C[k]; P.rect(r[0] + 1, r[1] + 1, r[2] - 2, 3, '#8ac4ec'); }
  P.box(56, 34, 4, 7, 7, '#202024', 0.08); const W = faceRects(56, 34, 4, 7, 7);
  for (const k of ['left', 'right']) { const r = W[k]; P.rect(r[0] + 2, r[1] + 2, 3, 3, '#b8b8c0'); }
  P.box(80, 34, 4, 14, 4, c.body, 0.05); P.box(96, 34, 5, 14, 5, '#5a5a66', 0.06);
  const L = faceRects(96, 34, 5, 14, 5); P.rect(L.front[0], L.front[1] + 4, 5, 2, c.body);
  return (texCache[color] = P.tex());
}

const ease = (t) => t * t * (3 - 2 * t);

export class Carbot extends Entity {
  constructor(g, x, y, z, yaw = 0, color = 'red') {
    super('carbot');
    this.g = g; this.clickable = true; this.x = x; this.y = y; this.z = z; this.yaw = yaw;
    this.color = CAR_COLORS[color] ? color : 'red';
    this.model = new MobModel(DEF, carTex(this.color)); this.mesh = this.model.group;
    this.mode = 'car'; this.t = 0; this.tt = 0; // t: 0 — машинка, 1 — робот
    this.speed = 0; this.spin = 0; this.wave = 0; this.lt = 0; this.bright = 1; this.walk = 0; this.stuckT = 0;
    this.setSize(); this.pose();
  }
  setSize() { if (this.t > 0.5) { this.w = 0.95; this.h = 2.8; } else { this.w = 1.1; this.h = 1.0; } }
  setColor(c) { if (!CAR_COLORS[c] || c === this.color) return false; this.color = c; this.model.mat.map = carTex(c); this.model.mat.needsUpdate = true; return true; }

  // ПКМ: в машинку — сесть, роботу — помахать; шерстью — перекрасить
  interact(g, stack) {
    const nm = stack ? getItem(stack.id)?.name : null;
    if (nm && WOOL_COLOR[nm]) { if (this.setColor(WOOL_COLOR[nm])) { g.particles?.poof(this.x, this.y + 0.6, this.z, 12); g.sfx?.play('craft'); } return true; }
    if (this.mode === 'car' && this.t === 0) { this.mount(g); return true; }
    if (this.mode === 'robot') { this.wave = 1.6; g.sfx?.play('door', { x: this.x, y: this.y + 2, z: this.z }, 0.8, 1.6); return true; }
    return false;
  }
  hurt() { this.wave = Math.max(this.wave, 0.4); }
  mount(g) {
    const p = g.player; if (p.riding) return;
    p.riding = this; p.flying = false; this.rider = p;
    this.prevView = g.view; g.view = 1;
    p.yaw = this.yaw + Math.PI;
    g.sfx?.play('door', { x: this.x, y: this.y, z: this.z }, 1);
  }
  dismount(g) {
    const p = this.rider; if (!p) return;
    p.riding = null; this.rider = null; g.view = this.prevView || 0;
    // встать сбоку от машинки
    const sx = Math.cos(this.yaw), sz = -Math.sin(this.yaw), w = g.world;
    for (const s of [1.6, -1.6, 0]) {
      const x = this.x + sx * s, z = this.z + sz * s, by = Math.floor(this.y);
      if (!SOLID[w.getBlock(Math.floor(x), by, Math.floor(z))] && !SOLID[w.getBlock(Math.floor(x), by + 1, Math.floor(z))]) { p.setPos(x, this.y + 0.05, z); break; }
      if (s === 0) p.setPos(this.x, this.y + 1.1, this.z);
    }
    p.peakY = p.y;
  }
  transform(g) {
    if (this.t !== 0 && this.t !== 1) return;
    if (this.rider) this.dismount(g);
    this.mode = this.mode === 'car' ? 'robot' : 'car';
    this.tt = 1.1; this.speed = 0;
    g.sfx?.play('explode', { x: this.x, y: this.y, z: this.z }, 0.15, 2.5);
    g.sfx?.play('craft', null, 1, 0.6);
    g.particles?.confetti(this.x, this.y + 1, this.z, 24);
    g.quests?.say(this.mode === 'robot' ? 'car_robot' : 'car_car');
  }

  // управление за рулём: вперёд/назад — газ, влево/вправо — руль; камера сама догоняет машинку
  drive(dt, inp, p) {
    const g = this.g;
    if (inp.sneak) { this.dismount(g); return; }
    const target = inp.forward && !inp.back ? (inp.sprint ? 12 : 9) : inp.back && !inp.forward ? -4 : 0;
    const steer = (inp.left ? 1 : 0) - (inp.right ? 1 : 0); // влево — yaw растёт
    if (steer) this.yaw += steer * 2.4 * dt * (this.speed < -0.5 ? -1 : 1);
    // камера за машинкой
    let df = this.yaw + Math.PI - p.yaw; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
    p.yaw += Math.max(-3 * dt, Math.min(3 * dt, df));
    const acc = target === 0 ? 10 : 12;
    this.speed += Math.max(-acc * dt, Math.min(acc * dt, target - this.speed));
    if (inp.jump && this.onGround) this.vy = 7;
    this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed;
    p.vx = this.vx; p.vz = this.vz;
  }

  update(dt, g) {
    this.g = g;
    const w = g.world, p = g.player;
    if (!w.isLoaded(Math.floor(this.x), Math.floor(this.z))) return;
    // превращение
    if (this.tt > 0) {
      this.tt = Math.max(0, this.tt - dt);
      const k = 1 - this.tt / 1.1; this.t = this.mode === 'robot' ? k : 1 - k;
      if (this.tt === 0) this.t = this.mode === 'robot' ? 1 : 0;
      this.setSize();
    }
    const inW = isWater(w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.3), Math.floor(this.z)));
    if (this.mode === 'robot' && this.tt === 0) this.follow(dt, g);
    else if (!this.rider) { this.speed *= Math.pow(0.05, dt); this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed; }
    if (inW) { this.vy += (this.vy < 2 ? 14 : 0) * dt; this.vy *= 0.9; } else this.vy -= 28 * dt;
    if (this.vy < -50) this.vy = -50;
    moveEntity(w, this, this.vx * dt, this.vy * dt, this.vz * dt, { step: this.mode === 'robot' ? 0.6 : 1.05 });
    if (this.hitY) this.vy = 0;
    if (this.hitX || this.hitZ) this.speed *= 0.5;
    if (this.y < -20) { this.y = 120; this.vy = 0; }
    // наездник
    if (this.rider) {
      const r = this.rider; r.x = this.x; r.y = this.y + 0.25; r.z = this.z; r.vy = 0; r.onGround = true; r.peakY = r.y; r.fell = 0;
    }
    this.lt -= dt; if (this.lt <= 0) { this.lt = 0.4; this.bright = lightBrightness(w, this.x, this.y + 0.5, this.z, g.sky.daylight); }
    this.pose(dt);
  }

  // робот ходит рядом с игроком, как питомец
  follow(dt, g) {
    const p = g.player, dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    const moved = Math.hypot(this.x - (this.lastX ?? this.x), this.z - (this.lastZ ?? this.z)) / Math.max(dt, 1e-3);
    this.lastX = this.x; this.lastZ = this.z;
    this.stuckT = d > 5 && moved < 0.4 ? this.stuckT + dt : 0;
    if ((d > 28 || this.stuckT > 2.5) && p.onGround && !p.flying) {
      const a = p.yaw + 0.9, x = p.x + Math.sin(a) * 2.2, z = p.z + Math.cos(a) * 2.2;
      if (!SOLID[g.world.getBlock(Math.floor(x), Math.floor(p.y), Math.floor(z))]) { this.x = x; this.y = p.y + 0.1; this.z = z; this.stuckT = 0; g.particles?.poof(x, p.y, z, 10); }
    }
    let tvx = 0, tvz = 0;
    if (d > 3.5) { const sp = d > 10 ? 6.5 : 4; tvx = dx / d * sp; tvz = dz / d * sp; }
    const a = (this.onGround ? 30 : 8) * dt;
    this.vx += Math.max(-a, Math.min(a, tvx - this.vx)); this.vz += Math.max(-a, Math.min(a, tvz - this.vz));
    if ((this.hitX || this.hitZ) && this.onGround && (tvx || tvz)) this.vy = 11; // высокий прыжок
    const hs = Math.hypot(this.vx, this.vz);
    if (hs > 0.3) { let df = Math.atan2(this.vx, this.vz) - this.yaw; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283; this.yaw += df * Math.min(1, dt * 8); }
    else if (d < 6) { let df = Math.atan2(dx, dz) - this.yaw; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283; this.yaw += df * Math.min(1, dt * 3); }
    this.walk += hs * dt * 2.2;
  }

  pose(dt = 0) {
    const P = this.model.parts, t = ease(this.t), hs = Math.hypot(this.vx, this.vz);
    for (const n in POSE) {
      const [a, b] = POSE[n], m = P[n];
      m.position.set((a[0] + (b[0] - a[0]) * t) / 16, (a[1] + (b[1] - a[1]) * t) / 16, (a[2] + (b[2] - a[2]) * t) / 16);
      m.rotation.set(a[3] + (b[3] - a[3]) * t, 0, 0);
      if (GROW.has(n)) { const s = Math.max(0.01, t); m.scale.set(s, s, s); m.visible = t > 0.02; }
    }
    // колёса крутятся при езде
    this.spin += this.speed * dt * 2.3;
    if (t < 0.5) for (const n of ['wFL', 'wFR', 'wBL', 'wBR']) P[n].rotation.x = this.spin;
    // ходьба и взмах рукой у робота
    if (this.t === 1) {
      const sw = Math.sin(this.walk) * 0.8 * Math.min(1, hs / 3);
      P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.armL.rotation.x = -sw * 0.8; P.armR.rotation.x = sw * 0.8;
      if (this.wave > 0) { this.wave -= dt; P.armR.rotation.x = Math.PI; P.armR.rotation.z = -0.3 + Math.sin(this.wave * 14) * 0.45; } else P.armR.rotation.z = 0;
    }
    // прыжок-вращение во время превращения
    const hop = this.tt > 0 ? Math.sin((1 - this.tt / 1.1) * Math.PI) * 0.6 : 0;
    this.mesh.position.set(this.x, this.y + hop, this.z);
    this.mesh.rotation.y = this.yaw + (this.tt > 0 ? ease(1 - this.tt / 1.1) * Math.PI * 2 : 0);
    this.model.mat.color.setScalar(this.bright);
  }
  serialize() { return { k: 'carbot', x: this.x, y: this.y, z: this.z, yaw: this.yaw, c: this.color, robot: this.mode === 'robot' }; }
}
