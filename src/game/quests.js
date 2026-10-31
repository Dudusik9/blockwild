// Миссии спасателей для малышей: голосовое задание → стрелка-компас и звёздный маяк над целью → ⭐ за выполнение.
// Состояние живёт в meta.quests и сохраняется вместе с миром.
import { B, BLOCKS, SOLID, isLiquid } from '../world/blocks.js';
import { I } from './items.js';
import { PHRASES } from './phrases.js';

const ICON = { town: '🏰', lost_kitten: '🐱', lost_puppy: '🐶', tree_kitten: '🌳', hungry_kitten: '🐟', hungry_puppy: '🦴', flag: '🚩' };
const DONE = ['done_1', 'done_2', 'done_3'];

export class Quests {
  constructor(g) {
    this.g = g; this.beaconT = 0; this.lostT = 0; this.audio = null;
    this.el = document.createElement('div'); this.el.className = 'quest hidden';
    this.el.innerHTML = '<div class="q-arrow"><svg viewBox="0 0 40 40"><path d="M20 3 L35 24 L25 24 L25 37 L15 37 L15 24 L5 24 Z"/></svg></div><div class="q-icon"></div>';
    this.stars = document.createElement('div'); this.stars.className = 'q-stars hidden';
    const hud = document.getElementById('hud'); hud.appendChild(this.el); hud.appendChild(this.stars);
    this.arrow = this.el.querySelector('.q-arrow'); this.icon = this.el.querySelector('.q-icon');
    this.el.addEventListener('pointerdown', () => this.repeat());
  }
  dispose() { this.el.remove(); this.stars.remove(); if (this.audio) this.audio.pause(); }
  get st() { const m = this.g.meta; return m.quests || (m.quests = { stars: 0, rescued: 0, active: null, next: 45, n: 0 }); }

  // ---------- голос ----------
  say(key) {
    const g = this.g;
    if (PHRASES[key]) g.menus?.toast(PHRASES[key]);
    try {
      if (this.audio) this.audio.pause();
      this.audio = new Audio('audio/' + key + '.mp3'); this.audio.volume = Math.min(1, (g.settings.masterVolume ?? 0.7) * 1.3);
      this.audio.play().catch(() => {});
    } catch (e) { /* без звука */ }
  }
  repeat() { const a = this.st.active; if (a) this.say(a.say); }

  // ---------- цикл ----------
  update(dt) {
    const g = this.g, s = this.st;
    if (g.meta.questsOff || !g.player) { this.el.classList.add('hidden'); this.stars.classList.add('hidden'); return; }
    this.stars.classList.toggle('hidden', s.stars <= 0); this.stars.textContent = '⭐ ' + s.stars;
    if (!s.active) { this.el.classList.add('hidden'); s.next -= dt; if (s.next <= 0) this.start(); return; }
    const t = this.targetPos(s.active);
    if (!t) { // цель пропала (выгружена/исчезла) — немного подождать и отменить
      this.lostT += dt; if (this.lostT > 15) { s.active = null; s.next = 10; this.lostT = 0; }
      this.el.classList.add('hidden'); return;
    }
    this.lostT = 0;
    this.check(s.active, t);
    if (!s.active) return;
    this.el.classList.remove('hidden');
    const p = g.player, dx = t.x - p.x, dz = t.z - p.z;
    let rel = Math.atan2(-dx, -dz) - p.yaw; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
    this.arrow.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`;
    const d = Math.hypot(dx, dz);
    this.el.classList.toggle('near', d < 6);
    this.icon.textContent = ICON[s.active.icon] || '⭐';
    // звёздный маяк над целью
    this.beaconT -= dt;
    if (this.beaconT <= 0) { this.beaconT = 0.2; g.particles?.beacon(t.x, t.y + 1.2, t.z); }
  }

  // ---------- старт ----------
  start(type) {
    const g = this.g, s = this.st;
    const tamed = g.entities.list.filter((e) => e.isMob && e.tamed && !e.dead && Math.hypot(e.x - g.player.x, e.z - g.player.z) < 30);
    const hasCar = g.entities.list.some((e) => e.type === 'carbot' && !e.dead) || g.inventory.countOf(I.car_key) > 0;
    if (!type) {
      const opts = ['lost', 'lost', 'tree'];
      if (tamed.length) opts.push('hungry', 'hungry');
      if (hasCar) opts.push('flag');
      type = opts[(Math.random() * opts.length) | 0];
      if (type === s.lastType && opts.length > 1) type = opts.find((o) => o !== type);
    }
    let a = null;
    if (type === 'town' && (g.meta.town || g.meta.townSite)) a = { type, icon: 'town', say: 'town' };
    else if (type === 'lost') a = this.startLost(Math.random() < 0.5 ? 'kitten' : 'puppy', false);
    else if (type === 'tree') a = this.startLost('kitten', true) || this.startLost('kitten', false);
    else if (type === 'hungry' && tamed.length) a = this.startHungry(tamed[(Math.random() * tamed.length) | 0]);
    else if (type === 'flag') a = this.startFlag();
    if (!a) { s.next = 8; return false; }
    a.id = 'q' + (++s.n); s.active = a; s.lastType = type;
    if (a.petKind) { const pet = this.pet(a); if (pet) pet.questId = a.id; }
    this.say(a.say);
    return true;
  }
  // свободная клетка на поверхности (или на кроне) в кольце радиусов
  findSpot(r0, r1, onTree) {
    const g = this.g, w = g.world, p = g.player;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0);
      const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
      if (!w.isLoaded(x, z)) continue;
      const y = w.topY(x, z) + 1, under = w.getBlock(x, y - 1, z);
      if (y < 2 || y > 250 || isLiquid(under) || !SOLID[under] || SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)]) continue;
      if (BLOCKS[under].name.startsWith('leaves_') !== !!onTree) continue;
      if (onTree && y - p.y > 9) continue;
      return { x: x + 0.5, y, z: z + 0.5 };
    }
    return null;
  }
  startLost(kind, onTree) {
    const sp = this.findSpot(onTree ? 12 : 26, onTree ? 40 : 46, onTree); if (!sp) return null;
    const m = this.g.mobs.spawnMob(kind, sp.x, sp.y + 0.05, sp.z); m.lost = true; m.noDespawn = true; m.sitting = false;
    const key = onTree ? 'tree_kitten' : 'lost_' + kind;
    return { type: onTree ? 'tree' : 'lost', icon: key, say: key, petKind: kind, petEnt: m.id };
  }
  startHungry(pet) {
    const kind = pet.kind, item = kind === 'puppy' ? 'dog_treat' : 'fish', key = 'hungry_' + kind;
    const a = { type: 'hungry', icon: key, say: key, petKind: kind, petEnt: pet.id, item, stage: 'find' };
    pet.sitting = false;
    if (this.g.inventory.countOf(I[item]) > 0) { a.stage = 'bring'; return a; }
    const sp = this.findSpot(18, 32, false); if (!sp) return null;
    const e = this.g.dropItem(sp.x, sp.y + 0.3, sp.z, { id: I[item], count: 1 }, [0, 0, 0]);
    e.age = -1e9; e.questItem = true; a.pos = { x: sp.x, y: sp.y, z: sp.z };
    return a;
  }
  startFlag() {
    const sp = this.findSpot(40, 60, false); if (!sp) return null;
    const g = this.g, x = Math.floor(sp.x), y = sp.y, z = Math.floor(sp.z);
    for (let k = 0; k < 4; k++) g.setBlock(x, y + k, z, B.log_birch);
    g.setBlock(x, y + 4, z, B.lumen);
    for (let k = 2; k < 4; k++) for (let i = 1; i <= 2; i++) if (!SOLID[g.world.getBlock(x + i, y + k, z)]) g.setBlock(x + i, y + k, z, B.wool_red);
    return { type: 'flag', icon: 'flag', say: 'flag', pos: { x: sp.x, y, z: sp.z } };
  }

  // ---------- цель и проверка ----------
  pet(a) { return this.g.entities.list.find((e) => e.isMob && !e.dead && (e.id === a.petEnt || (a.id && e.questId === a.id))); }
  targetPos(a) {
    if (a.type === 'town') { // до постройки — к месту городка, после — к двери башни
      const m = this.g.meta, t = m.town;
      if (t) return { x: t.tower.x + 0.5, y: t.tower.y, z: t.tower.z + 7.5 };
      return m.townSite ? { x: m.townSite.x + 0.5, y: this.g.player.y, z: m.townSite.z + 0.5, site: true } : null;
    }
    if (a.type === 'hungry' && a.stage === 'find') return a.pos;
    if (a.petKind) { const p = this.pet(a); if (!p) return null; a.petEnt = p.id; return { x: p.x, y: p.y + p.h, z: p.z }; }
    return a.pos;
  }
  check(a, t) {
    const p = this.g.player, d = Math.hypot(t.x - p.x, t.z - p.z);
    if (a.type === 'town' && !t.site && d < 5) this.complete('town_done');
    else if (a.type === 'flag' && d < 3 && Math.abs(t.y - p.y) < 4) this.complete();
    else if (a.type === 'hungry' && a.stage === 'find') {
      const g = this.g;
      if (g.inventory.countOf(I[a.item]) > 0) { a.stage = 'bring'; this.say('got_treat'); }
      // после перезагрузки угощения на месте нет — положить снова
      else if (!g.entities.list.some((e) => e.questItem && !e.dead) && g.world.isLoaded(Math.floor(a.pos.x), Math.floor(a.pos.z))) {
        const e = g.dropItem(a.pos.x, a.pos.y + 0.3, a.pos.z, { id: I[a.item], count: 1 }, [0, 0, 0]); e.age = -1e9; e.questItem = true;
      }
    }
  }
  complete(key) {
    const g = this.g, s = this.st, p = g.player;
    s.stars++; if (s.active?.petKind) s.rescued++;
    s.active = null; s.next = 50 + Math.random() * 30;
    g.particles?.confetti(p.x, p.y + 2, p.z, 50);
    g.sfx?.play('craft', null, 1.2, 1.5);
    this.say(key || DONE[(Math.random() * DONE.length) | 0]);
  }

  // ---------- события игры ----------
  onTownBuilt() { const s = this.st; if (!s.active) this.start('town'); } // идущую миссию не прерываем
  onPetTamed(pet) {
    const a = this.st.active;
    if (a && (a.type === 'lost' || a.type === 'tree') && (pet.questId === a.id || pet.id === a.petEnt)) { pet.noDespawn = true; this.complete(); }
  }
  onPetFed(pet) {
    const a = this.st.active;
    if (a && a.type === 'hungry' && a.stage === 'bring' && (pet.id === a.petEnt || pet.questId === a.id)) this.complete();
  }
}
