// Транспорт спасателей: машинки-роботы (разные окраски и модификации, превращаются в робота),
// грузовичок и самосвал (питомцы катаются в кузове) и вертолёт. На всём можно ездить или летать.
import * as THREE from 'three';
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
  race: { body: '#ff7a00', dark: '#a84400', stripe: '#141414', star: '#ffffff', speed: 14 },
  police: { body: '#f2f2f2', dark: '#1c3a9a', stripe: '#1c3a9a', star: '#ffd23a', siren: ['#2a5aff', '#ff3030'] },
  fire: { body: '#d8382c', dark: '#7a1410', stripe: '#ffd23a', star: '#ffffff', ladder: true },
  ambulance: { body: '#f6f6f6', dark: '#c4c4cc', stripe: '#e8302a', star: '#e8302a', siren: ['#ff3030', '#ff3030'], cross: true },
};
export const TRUCK_COLORS = { truck: { cab: '#2f6ee0', dark: '#1c449a', bed: '#8a6a44' }, dump: { cab: '#f2c21c', dark: '#b08810', bed: '#f2c21c' } };
const WOOL_COLOR = { wool_red: 'red', wool_blue: 'blue', wool_yellow: 'yellow', wool_green: 'green' };

// Каталог магазина (цены в ⭐)
export const VEHICLES = [
  { id: 'car_red', kind: 'car', style: 'red', title: 'Красная машинка', price: 2 },
  { id: 'car_blue', kind: 'car', style: 'blue', title: 'Синяя машинка', price: 2 },
  { id: 'car_yellow', kind: 'car', style: 'yellow', title: 'Жёлтая машинка', price: 2 },
  { id: 'car_green', kind: 'car', style: 'green', title: 'Зелёная машинка', price: 2 },
  { id: 'car_race', kind: 'car', style: 'race', title: 'Гоночная', price: 3 },
  { id: 'car_police', kind: 'car', style: 'police', title: 'Полицейская', price: 3 },
  { id: 'car_fire', kind: 'car', style: 'fire', title: 'Пожарная', price: 3 },
  { id: 'car_ambulance', kind: 'car', style: 'ambulance', title: 'Скорая помощь', price: 3 },
  { id: 'truck', kind: 'truck', style: 'truck', title: 'Грузовичок', price: 5 },
  { id: 'dump', kind: 'dump', style: 'dump', title: 'Самосвал', price: 5 },
  { id: 'heli', kind: 'heli', style: 'heli', title: 'Вертолёт', price: 8 },
];

// ---------- машинка-робот ----------
const CAR_DEF = {
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

// ---------- грузовичок / самосвал ----------
const TRUCK_DEF = {
  tw: 128, th: 96,
  parts: [
    { n: 'cab', size: [16, 12, 10], uv: [0, 0], pivot: [0, 10, 10], off: [0, 0, 0] },
    { n: 'chassis', size: [14, 3, 28], uv: [0, 44], pivot: [0, 4.5, -1], off: [0, 0, 0] },
    { n: 'bedFloor', size: [16, 2, 18], uv: [0, 22], pivot: [0, 7, -5], off: [0, 0, 0] },
    { n: 'bedL', size: [1, 5, 18], uv: [70, 0], pivot: [7.5, 10.5, -5], off: [0, 0, 0] }, { n: 'bedR', size: [1, 5, 18], uv: [70, 0], pivot: [-7.5, 10.5, -5], off: [0, 0, 0] },
    { n: 'bedB', size: [14, 5, 1], uv: [70, 24], pivot: [0, 10.5, -13.5], off: [0, 0, 0] }, { n: 'bedF', size: [14, 5, 1], uv: [70, 24], pivot: [0, 10.5, 3.5], off: [0, 0, 0] },
    ...[[8.5, 10], [-8.5, 10], [8.5, -5], [-8.5, -5], [8.5, -11], [-8.5, -11]].map(([x, z], i) => ({ n: 'w' + i, size: [3, 7, 7], uv: [100, 24], pivot: [x, 3.5, z], off: [0, 0, 0] })),
  ],
};
const BED = ['bedFloor', 'bedL', 'bedR', 'bedB', 'bedF'];

// ---------- вертолёт ----------
const HELI_DEF = {
  tw: 128, th: 96,
  parts: [
    { n: 'body', size: [14, 12, 20], uv: [0, 6], pivot: [0, 10, 2], off: [0, 0, 0] },
    { n: 'tail', size: [4, 4, 20], uv: [68, 6], pivot: [0, 13, -17], off: [0, 0, 0] },
    { n: 'fin', size: [1, 8, 5], uv: [0, 40], pivot: [0, 17, -26], off: [0, 0, 0] },
    { n: 'tailRotor', size: [1, 7, 2], uv: [14, 40], pivot: [1.5, 17, -26], off: [0, 0, 0] },
    { n: 'mast', size: [2, 3, 2], uv: [22, 40], pivot: [0, 17.5, 2], off: [0, 0, 0] },
    { n: 'rotorA', size: [48, 1, 3], uv: [0, 0], pivot: [0, 19.5, 2], off: [0, 0, 0] }, { n: 'rotorB', size: [48, 1, 3], uv: [0, 0], pivot: [0, 19.5, 2], off: [0, 0, 0] },
    { n: 'skidL', size: [2, 2, 24], uv: [32, 40], pivot: [7, 1, 2], off: [0, 0, 0] }, { n: 'skidR', size: [2, 2, 24], uv: [32, 40], pivot: [-7, 1, 2], off: [0, 0, 0] },
  ],
};

const eyes = (P, x, y, w) => { // большие глаза в лобовом стекле
  P.rect(x + 1, y + 1, w - 2, 4, '#a8dcff');
  const l = x + 2, r = x + w - 5;
  P.rect(l, y + 1, 3, 3, '#ffffff'); P.rect(r, y + 1, 3, 3, '#ffffff'); P.rect(l + 1, y + 2, 2, 2, '#1a2a50'); P.rect(r, y + 2, 2, 2, '#1a2a50');
  P.px(l + 1, y + 2, '#ffffff'); P.px(r, y + 2, '#ffffff'); P.rect(x + (w >> 1) - 2, y + 5, 4, 1, '#ffffff');
};

const texCache = {};
function carTex(style) {
  const key = 'car:' + style; if (texCache[key]) return texCache[key];
  const c = CAR_COLORS[style] || CAR_COLORS.red, P = new Paint(128, 64, 4242);
  const B_ = P.box(0, 0, 16, 6, 28, c.body, 0.05);
  // капот (в роботе — грудь): полоса и звезда (у скорой — крест)
  const [tx, ty] = B_.top; P.rect(tx + 6, ty, 4, 28, c.stripe);
  if (c.cross) { P.rect(tx + 4, ty + 9, 8, 2, '#ffffff'); P.rect(tx + 5, ty + 8, 6, 4, c.star); P.rect(tx + 7, ty + 6, 2, 8, c.star); }
  else for (const [dx, dy] of [[7, 9], [8, 9], [6, 10], [7, 10], [8, 10], [9, 10], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11], [6, 12], [7, 12], [8, 12], [9, 12], [6, 13], [9, 13]]) P.px(tx + dx, ty + dy, c.star);
  // перед: бампер и фары; зад: стоп-сигналы
  const [fx, fy] = B_.front; P.rect(fx, fy + 4, 16, 2, '#3a3a40'); P.rect(fx + 1, fy + 1, 3, 2, '#fff6b0'); P.rect(fx + 12, fy + 1, 3, 2, '#fff6b0');
  const [bx, by] = B_.back; P.rect(bx + 1, by + 1, 3, 2, '#ff4030'); P.rect(bx + 12, by + 1, 3, 2, '#ff4030'); P.rect(bx, by + 4, 16, 2, '#3a3a40');
  for (const k of ['left', 'right']) { const [sx, sy] = B_[k]; P.rect(sx, sy + 2, 28, 1, c.stripe); if (c.cross) { P.rect(sx + 12, sy + 1, 4, 3, c.star); } }
  // кабина-голова: стёкла и большие глаза в лобовом стекле
  const C = P.box(0, 34, 14, 6, 13, c.dark, 0.04);
  eyes(P, C.front[0], C.front[1], 14);
  for (const k of ['left', 'right', 'back']) { const r = C[k]; P.rect(r[0] + 1, r[1] + 1, r[2] - 2, 3, '#8ac4ec'); }
  P.box(56, 34, 4, 7, 7, '#202024', 0.08); const W = faceRects(56, 34, 4, 7, 7);
  for (const k of ['left', 'right']) { const r = W[k]; P.rect(r[0] + 2, r[1] + 2, 3, 3, '#b8b8c0'); }
  P.box(80, 34, 4, 14, 4, c.body, 0.05); P.box(96, 34, 5, 14, 5, '#5a5a66', 0.06);
  const L = faceRects(96, 34, 5, 14, 5); P.rect(L.front[0], L.front[1] + 4, 5, 2, c.body);
  return (texCache[key] = P.tex());
}
function truckTex(style) {
  const key = 'truck:' + style; if (texCache[key]) return texCache[key];
  const c = TRUCK_COLORS[style] || TRUCK_COLORS.truck, P = new Paint(128, 96, 777);
  const C = P.box(0, 0, 16, 12, 10, c.cab, 0.05);
  eyes(P, C.front[0], C.front[1] + 2, 16); P.rect(C.front[0], C.front[1] + 9, 16, 3, '#3a3a40'); P.rect(C.front[0] + 1, C.front[1] + 9, 3, 2, '#fff6b0'); P.rect(C.front[0] + 12, C.front[1] + 9, 3, 2, '#fff6b0');
  for (const k of ['left', 'right']) { const r = C[k]; P.rect(r[0] + 1, r[1] + 2, r[2] - 3, 4, '#8ac4ec'); }
  P.box(0, 22, 16, 2, 18, c.bed, 0.08); P.box(70, 0, 1, 5, 18, c.bed, 0.08); P.box(70, 24, 14, 5, 1, c.bed, 0.08);
  P.box(0, 44, 14, 3, 28, '#3a3a40', 0.06);
  P.box(100, 24, 3, 7, 7, '#202024', 0.08); const W = faceRects(100, 24, 3, 7, 7);
  for (const k of ['left', 'right']) { const r = W[k]; P.rect(r[0] + 2, r[1] + 2, 3, 3, '#b8b8c0'); }
  return (texCache[key] = P.tex());
}
function heliTex() {
  if (texCache.heli) return texCache.heli;
  const P = new Paint(128, 96, 999);
  P.box(0, 0, 48, 1, 3, '#2a2a30', 0.05);
  const Bd = P.box(0, 6, 14, 12, 20, '#e8382c', 0.05);
  eyes(P, Bd.front[0], Bd.front[1] + 1, 14); P.rect(Bd.front[0], Bd.front[1] + 7, 14, 1, '#ffffff');
  for (const k of ['left', 'right']) { const r = Bd[k]; P.rect(r[0] + 10, r[1] + 1, 9, 5, '#8ac4ec'); P.rect(r[0], r[1] + 8, r[2], 2, '#ffffff'); P.rect(r[0] + 4, r[1] + 7, 2, 4, '#ffffff'); P.rect(r[0] + 3, r[1] + 8, 4, 2, '#ffffff'); }
  P.box(68, 6, 4, 4, 20, '#e8382c', 0.05); P.box(0, 40, 1, 8, 5, '#ffffff', 0.03); P.box(14, 40, 1, 7, 2, '#2a2a30');
  P.box(22, 40, 2, 3, 2, '#5a5a66'); P.box(32, 40, 2, 2, 24, '#5a5a66');
  return (texCache.heli = P.tex());
}

const ease = (t) => t * t * (3 - 2 * t);
const box = (w, h, d, col, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w / 16, h / 16, d / 16), new THREE.MeshBasicMaterial({ color: col })); m.position.set(x / 16, y / 16, z / 16); m.userData.own = true; return m; };

export class Carbot extends Entity {
  constructor(g, x, y, z, yaw = 0, style = 'red', kind = 'car') {
    super('carbot');
    this.g = g; this.clickable = true; this.x = x; this.y = y; this.z = z; this.yaw = yaw;
    this.kind = ['car', 'truck', 'dump', 'heli'].includes(kind) ? kind : 'car';
    this.style = this.kind === 'car' ? (CAR_COLORS[style] ? style : 'red') : this.kind === 'heli' ? 'heli' : this.kind;
    const def = this.kind === 'car' ? CAR_DEF : this.kind === 'heli' ? HELI_DEF : TRUCK_DEF;
    const tex = this.kind === 'car' ? carTex(this.style) : this.kind === 'heli' ? heliTex() : truckTex(this.style);
    this.model = new MobModel(def, tex); this.mesh = this.model.group;
    this.mode = 'car'; this.t = 0; this.tt = 0; // t: 0 — машинка, 1 — робот
    this.speed = 0; this.spin = 0; this.rotor = 0; this.wave = 0; this.lt = 0; this.bright = 1; this.walk = 0; this.stuckT = 0; this.tilt = 0; this.landing = false;
    this.passengers = [];
    this.buildExtras();
    this.setSize(); this.pose();
  }
  get color() { return this.style; } // совместимость со старыми вызовами
  get maxSpeed() { return this.kind === 'car' ? (CAR_COLORS[this.style].speed || 9) : this.kind === 'heli' ? 11 : 8; }

  // мигалки, лестница, спойлер; кузов самосвала на шарнире
  buildExtras() {
    const P = this.model.parts, c = this.kind === 'car' ? CAR_COLORS[this.style] : null;
    this.extras = [];
    if (c && c.siren) { this.sirenA = box(3, 2, 3, c.siren[0], -3, 4, 0); this.sirenB = box(3, 2, 3, c.siren[1], 3, 4, 0); P.cabin.add(this.sirenA, this.sirenB); this.extras.push(this.sirenA, this.sirenB); }
    if (c && c.ladder) { const l = box(4, 1.5, 22, '#d8c8a0', 0, 4, -2); for (let k = -4; k <= 4; k++) l.add(box(4.4, 2, 0.8, '#8a6a44', 0, 0, k * 2.4 * 16 / 16)); P.cabin.add(l); this.extras.push(l); }
    if (c && c.speed) { const s = box(16, 1.5, 4, '#141414', 0, 4.5, -12); s.add(box(1.5, 3, 1.5, '#141414', 5 , -2, 0), box(1.5, 3, 1.5, '#141414', -5, -2, 0)); P.body.add(s); this.extras.push(s); }
    if (this.kind === 'dump') { // кузов вращается вокруг заднего края
      const hinge = new THREE.Group(); hinge.position.set(0, 6 / 16, -14 / 16); this.mesh.add(hinge);
      for (const n of BED) { const m = P[n]; m.position.sub(hinge.position); hinge.add(m); }
      this.hinge = hinge; this.dumpT = 0;
    }
  }
  setSize() {
    if (this.kind === 'heli') { this.w = 1.8; this.h = 1.6; }
    else if (this.kind !== 'car') { this.w = 1.3; this.h = 1.6; }
    else if (this.t > 0.5) { this.w = 0.95; this.h = 2.8; } else { this.w = 1.1; this.h = 1.0; }
  }
  setColor(c) {
    if (this.kind !== 'car' || !CAR_COLORS[c] || c === this.style) return false;
    this.style = c; this.model.mat.map = carTex(c); this.model.mat.needsUpdate = true; return true;
  }

  // ПКМ: сесть; роботу — помахать; машинку шерстью — перекрасить
  interact(g, stack) {
    const nm = stack ? getItem(stack.id)?.name : null;
    if (nm && WOOL_COLOR[nm] && this.kind === 'car') { if (this.setColor(WOOL_COLOR[nm])) { g.particles?.poof(this.x, this.y + 0.6, this.z, 12); g.sfx?.play('craft'); } return true; }
    if (this.mode === 'car' && this.t === 0) { this.mount(g); return true; }
    if (this.mode === 'robot') { this.wave = 1.6; g.sfx?.play('door', { x: this.x, y: this.y + 2, z: this.z }, 0.8, 1.6); return true; }
    return false;
  }
  hurt() { this.wave = Math.max(this.wave, 0.4); }
  mount(g) {
    const p = g.player; if (p.riding) return;
    p.riding = this; p.flying = false; this.rider = p; this.landing = false;
    this.prevView = g.view; g.view = 1;
    p.yaw = this.yaw + Math.PI;
    g.touch?.unlatchSneak();
    g.sfx?.play('door', { x: this.x, y: this.y, z: this.z }, 1);
  }
  dismount(g) {
    const p = this.rider; if (!p) return;
    p.riding = null; this.rider = null; g.view = this.prevView || 0;
    g.touch?.unlatchSneak();
    for (const pet of this.passengers) pet.ridingOn = null;
    this.passengers = [];
    // встать сбоку
    const side = this.kind === 'heli' ? 2.2 : 1.6, sx = Math.cos(this.yaw), sz = -Math.sin(this.yaw), w = g.world;
    for (const s of [side, -side, 0]) {
      const x = this.x + sx * s, z = this.z + sz * s, by = Math.floor(this.y);
      if (!SOLID[w.getBlock(Math.floor(x), by, Math.floor(z))] && !SOLID[w.getBlock(Math.floor(x), by + 1, Math.floor(z))]) { p.setPos(x, this.y + 0.05, z); break; }
      if (s === 0) p.setPos(this.x, this.y + this.h + 0.1, this.z);
    }
    p.peakY = p.y;
  }
  transform(g) {
    if (this.kind !== 'car' || (this.t !== 0 && this.t !== 1)) return;
    if (this.rider) this.dismount(g);
    this.mode = this.mode === 'car' ? 'robot' : 'car';
    this.tt = 1.1; this.speed = 0;
    g.sfx?.play('explode', { x: this.x, y: this.y, z: this.z }, 0.15, 2.5);
    g.sfx?.play('craft', null, 1, 0.6);
    g.particles?.confetti(this.x, this.y + 1, this.z, 24);
    g.quests?.say(this.mode === 'robot' ? 'car_robot' : 'car_car');
  }

  // за рулём: вперёд/назад — газ, влево/вправо — руль; камера сама догоняет. Вертолёт: прыжок — вверх.
  drive(dt, inp, p) {
    const g = this.g;
    if (inp.sneak) {
      if (this.kind === 'heli' && !this.onGround) this.landing = true; // в воздухе — сначала сесть
      else { this.dismount(g); return; }
    }
    const target = inp.forward && !inp.back ? (inp.sprint ? this.maxSpeed * 1.3 : this.maxSpeed) : inp.back && !inp.forward ? -4 : 0;
    const steer = (inp.left ? 1 : 0) - (inp.right ? 1 : 0); // влево — yaw растёт
    if (steer) this.yaw += steer * (this.kind === 'heli' ? 1.8 : 2.4) * dt * (this.speed < -0.5 ? -1 : 1);
    let df = this.yaw + Math.PI - p.yaw; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
    p.yaw += Math.max(-3 * dt, Math.min(3 * dt, df));
    const acc = target === 0 ? 10 : 12;
    this.speed += Math.max(-acc * dt, Math.min(acc * dt, target - this.speed));
    if (this.kind === 'heli') {
      const up = this.landing ? -5 : inp.jump ? 6 : (this.onGround ? 0 : -1.6);
      this.vy += Math.max(-14 * dt, Math.min(14 * dt, up - this.vy));
      if (this.y > 200) this.vy = Math.min(this.vy, 0);
    } else if (inp.jump && this.onGround) {
      if (this.kind === 'dump') this.dumpUp = true; else this.vy = 7;
    }
    if (this.kind === 'dump' && !inp.jump) this.dumpUp = false;
    this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed;
    p.vx = this.vx; p.vz = this.vz;
  }

  update(dt, g) {
    this.g = g;
    const w = g.world;
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
    const flying = this.kind === 'heli' && (this.rider || !this.onGround);
    if (this.kind === 'heli') { if (!this.rider) this.vy += Math.max(-10 * dt, Math.min(10 * dt, -3 - this.vy)); } // без пилота — плавно опускается
    else if (inW) { this.vy += (this.vy < 2 ? 14 : 0) * dt; this.vy *= 0.9; } else this.vy -= 28 * dt;
    if (this.vy < -50) this.vy = -50;
    moveEntity(w, this, this.vx * dt, this.vy * dt, this.vz * dt, { step: this.mode === 'robot' ? 0.6 : this.kind === 'heli' ? 0.05 : 1.05 });
    if (this.hitY) this.vy = 0;
    if (this.hitX || this.hitZ) this.speed *= 0.5;
    if (this.y < -20) { this.y = 120; this.vy = 0; }
    if (this.landing && this.onGround && this.rider) { this.landing = false; this.dismount(g); }
    // наездник
    if (this.rider) {
      const r = this.rider; r.x = this.x; r.y = this.y + 0.25; r.z = this.z; r.vy = 0; r.onGround = true; r.peakY = r.y; r.fell = 0;
      if (this.kind === 'truck' || this.kind === 'dump') this.loadPets(g);
    }
    // пассажиры в кузове
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.passengers = this.passengers.filter((pet) => !pet.dead && pet.ridingOn === this);
    this.passengers.forEach((pet, i) => {
      const lx = (i % 2 ? -0.22 : 0.22), lz = -0.25 - ((i >> 1) * 0.5);
      pet.x = this.x + lx * c + lz * s; pet.z = this.z - lx * s + lz * c; pet.y = this.y + 0.55 + (this.dumpT || 0) * 0.3; pet.vx = pet.vy = pet.vz = 0; pet.yaw = this.yaw;
    });
    if (flying || this.rotor > 0.1) this.rotor = Math.min(28, this.rotor + dt * (this.rider ? 20 : -6)); else this.rotor = 0;
    if (this.kind === 'heli' && !this.rider) this.rotor = Math.max(0, this.rotor - dt * 8);
    this.lt -= dt; if (this.lt <= 0) { this.lt = 0.4; this.bright = lightBrightness(w, this.x, this.y + 0.5, this.z, g.sky.daylight); }
    this.pose(dt);
  }
  // ручные питомцы рядом запрыгивают в кузов
  loadPets(g) {
    if (this.passengers.length >= 4) return;
    for (const e of g.entities.list) {
      if (!e.isMob || !e.tamed || e.dead || e.sitting || e.ridingOn || this.passengers.length >= 4) continue;
      if (Math.hypot(e.x - this.x, e.z - this.z) > 6) continue;
      e.ridingOn = this; this.passengers.push(e);
      g.particles?.hearts(e.x, e.y + e.h, e.z, 4);
    }
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
    const P = this.model.parts, hs = Math.hypot(this.vx, this.vz);
    this.spin += this.speed * dt * 2.3;
    if (this.kind === 'car') {
      const t = ease(this.t);
      for (const n in POSE) {
        const [a, b] = POSE[n], m = P[n];
        m.position.set((a[0] + (b[0] - a[0]) * t) / 16, (a[1] + (b[1] - a[1]) * t) / 16, (a[2] + (b[2] - a[2]) * t) / 16);
        m.rotation.set(a[3] + (b[3] - a[3]) * t, 0, 0);
        if (GROW.has(n)) { const s = Math.max(0.01, t); m.scale.set(s, s, s); m.visible = t > 0.02; }
      }
      if (t < 0.5) for (const n of ['wFL', 'wFR', 'wBL', 'wBR']) P[n].rotation.x = this.spin;
      for (const e of this.extras) e.visible = this.t < 0.1;
      if (this.sirenA) { const on = Math.floor((this.g?.clock || 0) * 4) % 2 === 0; this.sirenA.visible = this.t < 0.1 && on; this.sirenB.visible = this.t < 0.1 && !on; }
      if (this.t === 1) {
        const sw = Math.sin(this.walk) * 0.8 * Math.min(1, hs / 3);
        P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.armL.rotation.x = -sw * 0.8; P.armR.rotation.x = sw * 0.8;
        if (this.wave > 0) { this.wave -= dt; P.armR.rotation.x = Math.PI; P.armR.rotation.z = -0.3 + Math.sin(this.wave * 14) * 0.45; } else P.armR.rotation.z = 0;
      }
    } else if (this.kind === 'heli') {
      this.rotAng = (this.rotAng || 0) + this.rotor * dt;
      P.rotorA.rotation.y = this.rotAng; P.rotorB.rotation.y = this.rotAng + Math.PI / 2; P.tailRotor.rotation.x = this.rotAng * 1.5;
      this.tilt += ((this.rider && !this.onGround ? this.speed * 0.025 : 0) - this.tilt) * Math.min(1, dt * 4);
    } else {
      for (let i = 0; i < 6; i++) P['w' + i].rotation.x = this.spin;
      if (this.hinge) { this.dumpT += ((this.dumpUp ? 1 : 0) - this.dumpT) * Math.min(1, dt * 3); this.hinge.rotation.x = -this.dumpT * 0.9; }
    }
    // прыжок-вращение во время превращения
    const hop = this.tt > 0 ? Math.sin((1 - this.tt / 1.1) * Math.PI) * 0.6 : 0;
    this.mesh.position.set(this.x, this.y + hop, this.z);
    this.mesh.rotation.set(this.tilt || 0, this.yaw + (this.tt > 0 ? ease(1 - this.tt / 1.1) * Math.PI * 2 : 0), 0, 'YXZ');
    this.model.mat.color.setScalar(this.bright);
  }
  serialize() { return { k: 'carbot', x: this.x, y: this.y, z: this.z, yaw: this.yaw, c: this.style, kind: this.kind, robot: this.mode === 'robot' }; }
}
