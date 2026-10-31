// Миссии спасателей для малышей: голосовое задание → стрелка-компас и звёздный маяк над целью → ⭐ за выполнение.
// Плюс постоянный указатель на базу и луч света над башней. Состояние живёт в meta.quests и сохраняется вместе с миром.
import * as THREE from 'three';
import { B, BLOCKS, SOLID, isLiquid } from '../world/blocks.js';
import { I } from './items.js';
import { PHRASES } from './phrases.js';
import { FireSpot } from '../entity/firespot.js';
import { TILE_INDEX } from '../render/tilenames.js';

const ICON = {
  town: '🏰', lost_kitten: '🐱', lost_puppy: '🐶', tree_kitten: '🌳', roof_kitten: '🏠', hungry_kitten: '🐟', hungry_puppy: '🦴',
  flag: '🚩', fire: '🔥', delivery: '📦', stars: '⭐', race: '🏁', heli: '🚁',
};
const DONE = ['done_1', 'done_2', 'done_3'];
const ARROW = '<svg viewBox="0 0 40 40"><path d="M20 3 L35 24 L25 24 L25 37 L15 37 L15 24 L5 24 Z"/></svg>';
const ROOFS = new Set([B.brick, B.planks_spruce, B.slab_brick, B.wool_red]);

export class Quests {
  constructor(g) {
    this.g = g; this.beaconT = 0; this.lostT = 0; this.ringT = 0; this.audio = null;
    const hud = document.getElementById('hud');
    this.el = document.createElement('div'); this.el.className = 'quest hidden';
    this.el.innerHTML = '<div class="q-arrow">' + ARROW + '</div><div class="q-icon"></div><div class="q-count"></div>';
    this.home = document.createElement('div'); this.home.className = 'quest home hidden';
    this.home.innerHTML = '<div class="q-arrow">' + ARROW + '</div><div class="q-icon">🐾</div>';
    this.stars = document.createElement('div'); this.stars.className = 'q-stars hidden';
    hud.appendChild(this.el); hud.appendChild(this.home); hud.appendChild(this.stars);
    this.arrow = this.el.querySelector('.q-arrow'); this.icon = this.el.querySelector('.q-icon'); this.count = this.el.querySelector('.q-count');
    this.homeArrow = this.home.querySelector('.q-arrow');
    this.el.addEventListener('pointerdown', () => this.repeat());
    this.beam = null;
  }
  dispose() { this.el.remove(); this.home.remove(); this.stars.remove(); if (this.audio) this.audio.pause(); this.removeBeam(); }
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

  // ---------- база: указатель и луч ----------
  baseDoor() {
    const t = this.g.meta.town; if (!t) return null;
    return t.door ? { x: t.door.x, y: t.door.y, z: t.door.z } : { x: t.tower.x + 0.5, y: t.tower.y, z: t.tower.z + 7.5 };
  }
  setArrow(el, t) {
    const p = this.g.player;
    let rel = Math.atan2(-(t.x - p.x), -(t.z - p.z)) - p.yaw; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
    el.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`;
    return rel;
  }
  updateHome() {
    const g = this.g, t = g.meta.town;
    if (!t || g.meta.noTown) { this.home.classList.add('hidden'); this.removeBeam(); return; }
    if (!this.beam) this.addBeam(t);
    const d = Math.hypot(t.tower.x - g.player.x, t.tower.z - g.player.z);
    this.home.classList.toggle('hidden', d < 15);
    this.setArrow(this.homeArrow, { x: t.tower.x + 0.5, z: t.tower.z + 0.5 });
  }
  addBeam(t) {
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 160, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd75a, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(geo, mat); this.beam.position.set(t.tower.x + 0.5, t.tower.y + 100, t.tower.z + 0.5);
    this.beam.renderOrder = 4; this.g.scene.add(this.beam);
  }
  removeBeam() { if (this.beam) { this.g.scene.remove(this.beam); this.beam.geometry.dispose(); this.beam.material.dispose(); this.beam = null; } }

  // ---------- цикл ----------
  update(dt) {
    const g = this.g, s = this.st;
    this.updateHome();
    if (this.beam) this.beam.material.opacity = 0.22 + Math.sin(g.clock * 2) * 0.08;
    if (g.meta.questsOff || !g.player) { this.el.classList.add('hidden'); this.stars.classList.add('hidden'); return; }
    this.stars.classList.toggle('hidden', s.stars <= 0); this.stars.textContent = '⭐ ' + s.stars;
    if (!s.active) { this.el.classList.add('hidden'); s.next -= dt; if (s.next <= 0) this.start(); return; }
    const t = this.targetPos(s.active);
    if (!t) { // цель пропала (выгружена/исчезла) — немного подождать и отменить
      this.lostT += dt; if (this.lostT > 15) { s.active = null; s.next = 10; this.lostT = 0; }
      this.el.classList.add('hidden'); return;
    }
    this.lostT = 0;
    this.check(s.active, t, dt);
    if (!s.active) return;
    this.el.classList.remove('hidden');
    this.setArrow(this.arrow, t);
    const p = g.player;
    this.el.classList.toggle('near', Math.hypot(t.x - p.x, t.z - p.z) < 6);
    this.icon.textContent = ICON[s.active.icon] || '⭐';
    const a = s.active;
    this.count.textContent = a.type === 'stars' ? a.got + '/' + a.total : a.points ? (a.idx + 1) + '/' + a.points.length : '';
    // маяк над целью; у колец гонки — кольцо из звёздочек
    this.beaconT -= dt;
    if (this.beaconT <= 0) {
      this.beaconT = 0.2;
      if (a.points) this.ring(t); else g.particles?.beacon(t.x, t.y + 1.2, t.z);
    }
  }
  ring(t) { // вертикальное кольцо из звёзд
    const g = this.g, n = 14, r = 2.6, ph = g.clock * 1.5;
    for (let i = 0; i < n; i++) {
      const a = ph + (i / n) * Math.PI * 2;
      g.particles?.spawn(t.x + Math.cos(a) * r, t.y + 2.4 + Math.sin(a) * r, t.z, 0, 0, 0, 0.45, 0.3, 0, 1, 0.85, 0.2, 1, g.particles.fullTile(TILE_INDEX.fx_star), { fade: 1, drag: 0 });
    }
  }

  // ---------- старт ----------
  start(type) {
    const g = this.g, s = this.st, p = g.player, ents = g.entities.list;
    const tamed = ents.filter((e) => e.isMob && e.tamed && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 30);
    const vehicles = ents.filter((e) => e.type === 'carbot' && !e.dead);
    const carNear = p.riding || vehicles.some((e) => e.kind !== 'heli' && Math.hypot(e.x - p.x, e.z - p.z) < 25);
    const heli = vehicles.some((e) => e.kind === 'heli');
    const fireCar = vehicles.some((e) => e.style === 'fire');
    const city = g.meta.worldType === 'city';
    if (!type) {
      const opts = ['lost', 'lost', 'tree', 'fire', 'delivery', 'stars'];
      if (city) opts.push('roof', 'fire');
      if (tamed.length) opts.push('hungry', 'hungry');
      if (vehicles.length) opts.push('flag');
      if (carNear) opts.push('race', 'race');
      if (fireCar) opts.push('fire', 'fire');
      if (heli) opts.push('heli', 'heli');
      type = opts[(Math.random() * opts.length) | 0];
      if (type === s.lastType && opts.length > 1) type = opts.find((o) => o !== type);
    }
    let a = null;
    if (type === 'town' && (g.meta.town || g.meta.townSite)) a = { type, icon: 'town', say: 'town' };
    else if (type === 'lost') a = this.startLost(Math.random() < 0.5 ? 'kitten' : 'puppy', 'ground');
    else if (type === 'tree') a = this.startLost('kitten', 'tree') || this.startLost('kitten', 'ground');
    else if (type === 'roof') a = this.startLost('kitten', 'roof') || this.startLost('kitten', 'tree');
    else if (type === 'hungry' && tamed.length) a = this.startHungry(tamed[(Math.random() * tamed.length) | 0]);
    else if (type === 'flag') a = this.startFlag();
    else if (type === 'fire') a = this.startFire();
    else if (type === 'delivery') a = this.startDelivery();
    else if (type === 'stars') a = this.startStars();
    else if (type === 'race') a = this.startRings(false);
    else if (type === 'heli') a = this.startRings(true);
    if (!a) { s.next = 8; return false; }
    a.id = 'q' + (++s.n); s.active = a; s.lastType = type;
    if (a.petKind) { const pet = this.pet(a); if (pet) pet.questId = a.id; }
    if (a.fire) a.fire.questId = a.id, delete a.fire;
    this.say(a.say);
    return true;
  }
  // свободная клетка: where = 'ground' | 'tree' (на кроне) | 'roof' (на крыше дома)
  findSpot(r0, r1, where = 'ground', flatOnly = false) {
    const g = this.g, w = g.world, p = g.player;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, r = r0 + Math.random() * (r1 - r0);
      const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
      if (!w.isLoaded(x, z)) continue;
      const y = w.topY(x, z) + 1, under = w.getBlock(x, y - 1, z);
      if (y < 2 || y > 250 || isLiquid(under) || !SOLID[under] || SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)]) continue;
      const leaves = BLOCKS[under].name.startsWith('leaves_');
      if (where === 'tree' && (!leaves || y - p.y > 9)) continue;
      if (where === 'roof' && (!ROOFS.has(under) || y - p.y < 3 || y - p.y > 10)) continue;
      if (where === 'ground' && (leaves || (flatOnly && Math.abs(y - p.y) > 1.5))) continue;
      return { x: x + 0.5, y, z: z + 0.5 };
    }
    return null;
  }
  startLost(kind, where) {
    const sp = this.findSpot(where === 'ground' ? 26 : 12, where === 'ground' ? 46 : 42, where); if (!sp) return null;
    const m = this.g.mobs.spawnMob(kind, sp.x, sp.y + 0.05, sp.z); m.lost = true; m.noDespawn = true; m.sitting = false;
    const key = where === 'tree' ? 'tree_kitten' : where === 'roof' ? 'roof_kitten' : 'lost_' + kind;
    return { type: where === 'ground' ? 'lost' : where, icon: key, say: key, petKind: kind, petEnt: m.id };
  }
  startHungry(pet) {
    const kind = pet.kind, item = kind === 'puppy' ? 'dog_treat' : 'fish', key = 'hungry_' + kind;
    const a = { type: 'hungry', icon: key, say: key, petKind: kind, petEnt: pet.id, item, stage: 'find' };
    pet.sitting = false;
    if (this.g.inventory.countOf(I[item]) > 0) { a.stage = 'bring'; return a; }
    const sp = this.findSpot(18, 32); if (!sp) return null;
    this.dropQuestItem(sp, item); a.pos = sp;
    return a;
  }
  dropQuestItem(sp, item, tag = true) {
    const e = this.g.dropItem(sp.x, sp.y + 0.3, sp.z, { id: I[item], count: 1 }, [0, 0, 0]);
    e.age = -1e9; e.questItem = tag; return e;
  }
  putFlag(sp) {
    const g = this.g, x = Math.floor(sp.x), y = sp.y, z = Math.floor(sp.z);
    for (let k = 0; k < 4; k++) g.setBlock(x, y + k, z, B.log_birch);
    g.setBlock(x, y + 4, z, B.lumen);
    for (let k = 2; k < 4; k++) for (let i = 1; i <= 2; i++) if (!SOLID[g.world.getBlock(x + i, y + k, z)]) g.setBlock(x + i, y + k, z, B.wool_red);
  }
  startFlag() {
    const sp = this.findSpot(40, 60); if (!sp) return null;
    this.putFlag(sp);
    return { type: 'flag', icon: 'flag', say: 'flag', pos: sp };
  }
  startFire() {
    const sp = this.findSpot(20, 45, 'roof') || this.findSpot(20, 45, 'tree'); if (!sp) return null;
    const f = new FireSpot(this.g, sp.x, sp.y, sp.z); this.g.entities.add(f);
    return { type: 'fire', icon: 'fire', say: 'fire', pos: sp, fire: f };
  }
  startDelivery() {
    const g = this.g, t = g.meta.town, p = g.player;
    let sp = null;
    if (t?.shopPad && Math.hypot(t.shopPad.x - p.x, t.shopPad.z - p.z) < 70 && g.world.isLoaded(Math.floor(t.shopPad.x), Math.floor(t.shopPad.z))) sp = { x: t.shopPad.x + 2, y: t.shopPad.y, z: t.shopPad.z };
    if (!sp) sp = this.findSpot(10, 22); if (!sp) return null;
    if (g.inventory.countOf(I.parcel) === 0) this.dropQuestItem(sp, 'parcel');
    return { type: 'delivery', icon: 'delivery', say: 'delivery', pos: sp, item: 'parcel', stage: 'find' };
  }
  startStars() {
    const a = { type: 'stars', icon: 'stars', say: 'stars', got: 0, total: 5, spots: [] };
    for (let i = 0; i < a.total; i++) { const sp = this.findSpot(6, 26, 'ground', true) || this.findSpot(6, 26); if (!sp) return null; a.spots.push(sp); }
    for (const sp of a.spots) this.dropQuestItem(sp, 'star_token', 'star');
    return a;
  }
  startRings(air) {
    const g = this.g, p = g.player, pts = [];
    const n = air ? 3 : 4, a0 = Math.random() * Math.PI * 2;
    let x = p.x, z = p.z;
    for (let i = 0; i < n; i++) {
      let ok = null;
      for (let k = 0; k < 20 && !ok; k++) {
        const a = a0 + (Math.random() - 0.5) * 1.6, r = air ? 26 + Math.random() * 14 : 16 + Math.random() * 10;
        const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
        if (!g.world.isLoaded(Math.floor(nx), Math.floor(nz))) continue;
        const top = g.world.topY(Math.floor(nx), Math.floor(nz));
        if (air) ok = { x: nx, y: Math.max(top + 6, p.y + 14 + i * 3), z: nz };
        else if (Math.abs(top + 1 - p.y) <= 1.5 && !SOLID[g.world.getBlock(Math.floor(nx), top + 1, Math.floor(nz))]) ok = { x: Math.floor(nx) + 0.5, y: top + 1, z: Math.floor(nz) + 0.5 };
      }
      if (!ok) return null;
      pts.push(ok); x = ok.x; z = ok.z;
    }
    return { type: air ? 'heli' : 'race', icon: air ? 'heli' : 'race', say: air ? 'heli' : 'race', points: pts, idx: 0, air };
  }

  // ---------- цель и проверка ----------
  pet(a) { return this.g.entities.list.find((e) => e.isMob && !e.dead && (e.id === a.petEnt || (a.id && e.questId === a.id))); }
  fire(a) { return this.g.entities.list.find((e) => e.type === 'fire' && !e.dead && e.questId === a.id); }
  targetPos(a) {
    const g = this.g;
    if (a.type === 'town') { // до постройки — к месту городка, после — к двери башни
      const m = g.meta;
      if (m.town) return this.baseDoor();
      return m.townSite ? { x: m.townSite.x + 0.5, y: g.player.y, z: m.townSite.z + 0.5, site: true } : null;
    }
    if ((a.type === 'hungry' || a.type === 'delivery') && a.stage === 'find') return a.pos;
    if (a.type === 'delivery') return a.dest;
    if (a.type === 'stars') {
      const p = g.player; let best = null, bd = 1e9;
      for (const e of g.entities.list) if (e.questItem === 'star' && !e.dead) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = { x: e.x, y: e.y, z: e.z }; } }
      return best || a.spots[0];
    }
    if (a.points) return a.points[a.idx];
    if (a.petKind) { const p = this.pet(a); if (!p) return null; a.petEnt = p.id; return { x: p.x, y: p.y + p.h, z: p.z }; }
    return a.pos;
  }
  check(a, t) {
    const g = this.g, p = g.player, d = Math.hypot(t.x - p.x, t.z - p.z);
    const loaded = (pos) => g.world.isLoaded(Math.floor(pos.x), Math.floor(pos.z));
    if (a.type === 'town' && !t.site && d < 5) this.complete('town_done');
    else if (a.type === 'flag' && d < 3 && Math.abs(t.y - p.y) < 4) this.complete();
    else if (a.type === 'hungry' && a.stage === 'find') {
      if (g.inventory.countOf(I[a.item]) > 0) { a.stage = 'bring'; this.say('got_treat'); }
      // после перезагрузки угощения на месте нет — положить снова
      else if (!g.entities.list.some((e) => e.questItem === true && !e.dead) && loaded(a.pos)) this.dropQuestItem(a.pos, a.item);
    } else if (a.type === 'fire') {
      if (!this.fire(a) && loaded(a.pos)) { const f = new FireSpot(g, a.pos.x, a.pos.y, a.pos.z, a.id); g.entities.add(f); }
    } else if (a.type === 'delivery') {
      const has = g.inventory.countOf(I.parcel) > 0;
      if (a.stage === 'find') {
        if (has) {
          const dest = this.findSpot(35, 60); if (!dest) return;
          this.putFlag(dest); a.dest = dest; a.stage = 'go'; this.say('delivery_go');
        } else if (!g.entities.list.some((e) => e.questItem === true && !e.dead) && loaded(a.pos)) this.dropQuestItem(a.pos, 'parcel');
      } else if (d < 3.5 && Math.abs(t.y - p.y) < 4) {
        if (has) { g.inventory.take(I.parcel, 1); this.complete(); } else { a.stage = 'find'; }
      }
    } else if (a.type === 'stars') {
      if (!g.entities.list.some((e) => e.questItem === 'star' && !e.dead) && a.got < a.total) { // после перезагрузки
        for (let i = a.got; i < a.total; i++) { const sp = this.findSpot(6, 20, 'ground', true) || this.findSpot(6, 20); if (sp) this.dropQuestItem(sp, 'star_token', 'star'); }
      }
    } else if (a.points) {
      const ok = a.air ? Math.hypot(t.x - p.x, t.z - p.z, (t.y + 2.4) - (p.y + 1)) < 4.5 : d < 3.5;
      if (ok) {
        a.idx++; g.sfx?.play('pop', null, 1, 1.4); g.particles?.confetti(t.x, t.y + 2, t.z, 18);
        if (a.idx >= a.points.length) this.complete(); else this.say('next_ring');
      }
    }
  }
  complete(key, n = 1) {
    const g = this.g, s = this.st, p = g.player;
    s.stars += n; if (s.active?.petKind) s.rescued++;
    s.active = null; s.next = 45 + Math.random() * 25;
    g.particles?.confetti(p.x, p.y + 2, p.z, 50);
    g.sfx?.play('craft', null, 1.2, 1.5);
    this.say(key || DONE[(Math.random() * DONE.length) | 0]);
  }

  // ---------- события игры ----------
  onTownBuilt() { const s = this.st; if (!s.active) this.start('town'); } // идущую миссию не прерываем
  onPetTamed(pet) {
    const a = this.st.active;
    if (a && (a.type === 'lost' || a.type === 'tree' || a.type === 'roof') && (pet.questId === a.id || pet.id === a.petEnt)) { pet.noDespawn = true; this.complete(); }
  }
  onPetFed(pet) {
    const a = this.st.active;
    if (a && a.type === 'hungry' && a.stage === 'bring' && (pet.id === a.petEnt || pet.questId === a.id)) this.complete();
  }
  onFireOut(f) { const a = this.st.active; if (a && a.type === 'fire' && f.questId === a.id) this.complete('fire_out'); }
  onPickup(stack) {
    const g = this.g, a = this.st.active;
    if (stack.id !== I.star_token) return;
    g.inventory.take(I.star_token, stack.count); // звёздочки не копятся в рюкзаке
    if (!a || a.type !== 'stars') return;
    a.got = Math.min(a.total, a.got + stack.count);
    g.particles?.confetti(g.player.x, g.player.y + 1.5, g.player.z, 12);
    if (a.got >= a.total) this.complete('stars_done', 2);
  }
}
