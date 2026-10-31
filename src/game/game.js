// Игра: сборка систем, игровой цикл, жизненный цикл мира
import * as THREE from 'three';
import { createAtlasTexture, createEntityAtlas, createChunkMaterials } from '../render/chunkRenderer.js';
import { Sky } from '../render/sky.js';
import { Clouds } from '../render/clouds.js';
import { Selection } from '../render/selection.js';
import { Particles } from '../render/particles.js';
import { Weather } from '../render/weather.js';
import { Hand } from '../render/hand.js';
import { World } from '../world/world.js';
import { Generator } from '../world/generator.js';
import { Ticker } from '../world/tick.js';
import { Fluids } from '../world/fluids.js';
import { Player } from '../player/player.js';
import { Controls } from '../player/controls.js';
import { raycast } from '../player/raycast.js';
import { B, BLOCKS } from '../world/blocks.js';
import { BIOME } from '../world/biomes.js';
import { clamp, lerp, SEA } from '../core/math.js';
import { DebugOverlay } from '../ui/debug.js';
import { HUD } from '../ui/hud.js';
import { ContainerUI } from '../ui/inventoryUI.js';
import { Chat } from '../ui/chat.js';
import { Menus } from '../ui/menus.js';
import { TouchControls } from '../ui/touch.js';
import { Inventory } from './inventory.js';
import { Survival } from './survival.js';
import { Interaction } from './interaction.js';
import { actions } from './actions.js';
import { tickFurnace } from './furnace.js';
import { EntityManager } from '../entity/entity.js';
import { MobManager } from '../entity/mobs/spawner.js';
import { Sfx } from '../audio/sfx.js';
import { Ambience } from '../audio/ambience.js';
import { Storage } from '../save/storage.js';
import { MobModel, Paint } from '../entity/mobmodel.js';
import { Town } from '../world/town.js';
import { Quests } from './quests.js';
import { Carbot } from '../entity/carbot.js';
import { Shop } from '../ui/shop.js';
import { cityRiver, CITY_G, BASE } from '../world/city.js';

export const IS_TOUCH = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) &&
  ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || new URLSearchParams(location.search).get('touch') === '1');

export const DEFAULT_SETTINGS = {
  renderDistance: IS_TOUCH ? 4 : 8, fov: 70, sensitivity: 1.0, masterVolume: 0.7, musicVolume: 0.35,
  ao: true, clouds: true, particles: true, smoothLight: true, fpsLimit: 0, bobbing: true, pixelRatio: IS_TOUCH ? 1 : 1.5,
  autoJump: IS_TOUCH, controlHints: IS_TOUCH,
};

const PLAYER_DEF = {
  tw: 64, th: 64,
  parts: [
    { n: 'head', size: [8, 8, 8], uv: [0, 0], pivot: [0, 24, 0], off: [0, 4, 0] },
    { n: 'body', size: [8, 12, 4], uv: [16, 16], pivot: [0, 24, 0], off: [0, -6, 0] },
    { n: 'armL', size: [4, 12, 4], uv: [40, 16], pivot: [6, 23, 0], off: [0, -4, 0] }, { n: 'armR', size: [4, 12, 4], uv: [40, 32], pivot: [-6, 23, 0], off: [0, -4, 0] },
    { n: 'legL', size: [4, 12, 4], uv: [0, 16], pivot: [2, 12, 0], off: [0, -6, 0] }, { n: 'legR', size: [4, 12, 4], uv: [0, 32], pivot: [-2, 12, 0], off: [0, -6, 0] },
  ],
  paint(P) {
    const R = P.box(0, 0, 8, 8, 8, '#c89464', 0.08); P.rect(R.top[0], R.top[1], 8, 8, '#5a3a20');
    P.rect(R.front[0], R.front[1], 8, 2, '#5a3a20'); P.rect(R.front[0] + 1, R.front[1] + 3, 2, 2, '#f4f4f4'); P.rect(R.front[0] + 5, R.front[1] + 3, 2, 2, '#f4f4f4');
    P.rect(R.front[0] + 2, R.front[1] + 3, 1, 2, '#2a4a8a'); P.rect(R.front[0] + 6, R.front[1] + 3, 1, 2, '#2a4a8a'); P.rect(R.front[0] + 3, R.front[1] + 6, 2, 1, '#8a5a40');
    P.rect(R.back[0], R.back[1], 8, 8, '#5a3a20'); P.rect(R.left[0], R.left[1], 8, 2, '#5a3a20'); P.rect(R.right[0], R.right[1], 8, 2, '#5a3a20');
    P.box(16, 16, 8, 12, 4, '#3c7a52', 0.1); P.box(40, 16, 4, 12, 4, '#c89464', 0.08); P.box(40, 32, 4, 12, 4, '#c89464', 0.08);
    P.box(0, 16, 4, 12, 4, '#2c4a8a', 0.1); P.box(0, 32, 4, 12, 4, '#2c4a8a', 0.1);
  },
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('bw_settings') || '{}')); } catch (e) { /* ok */ }
    this.isTouch = IS_TOUCH;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.pixelRatio));
    this.renderer.autoClear = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.05, 1000);
    this.scene.add(this.camera);
    this.atlas = createAtlasTexture(); this.entityAtlas = createEntityAtlas();
    this.materials = createChunkMaterials(this.atlas);
    this.sky = new Sky(this.scene);
    this.controls = new Controls(canvas, this.settings);
    this.controls.touch = IS_TOUCH;
    this.selection = new Selection(this.scene);
    this.debug = new DebugOverlay(document.getElementById('debug'));
    this.sfx = new Sfx(this.settings);
    this.storage = new Storage();
    this.inventory = new Inventory();
    this.survival = new Survival(this);
    this.interaction = new Interaction(this);
    this.entities = new EntityManager(this);
    this.mobs = new MobManager(this);
    this.ambience = new Ambience(this);
    this.hud = new HUD(this, document.getElementById('hud'));
    this.chat = new Chat(this); this.chat.attach();
    this.container = new ContainerUI(this, document.getElementById('screens'));
    this.menus = new Menus(this, document.getElementById('screens'));
    this.shop = new Shop(this);
    this.touch = IS_TOUCH ? new TouchControls(this) : null;
    this.hand = new Hand(this);
    this.particles = new Particles(this.scene, this.entityAtlas, null, this.materials.uniforms);
    this.particles.density = IS_TOUCH ? 0.4 : 1;
    this.weather = new Weather(this);
    this.playerModel = new MobModel(PLAYER_DEF, (() => { const P = new Paint(64, 64, 7); PLAYER_DEF.paint(P); return P.tex(); })());
    this.playerModel.group.visible = false; this.scene.add(this.playerModel.group);
    this.view = 0;
    this.world = null; this.player = null; this.clouds = null; this.menuWorld = null;
    this.state = 'menu'; this.uiOpen = false; this.meta = null;
    this.time = 6000; this.day = 0; this.rain = 0; this.thunder = 0; this.flash = 0; this.shake = 0;
    this.clock = 0; this.fps = 0; this.frames = 0; this.fpsT = 0; this.hudHidden = false;
    this.target = null; this.dirVec = new THREE.Vector3();
    this.bob = 0; this.fovCur = this.settings.fov; this.accum = 0;
    this.torches = new Set(); this.saveT = 30; this.slowT = 0; this.torchT = 0; this.bubbleT = 0; this.wasWater = false; this.screenshotReq = false;
    this.setupInput();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.saveGame(); });
    window.addEventListener('beforeunload', () => { if (this.world && this.meta && this.player && this.state !== 'menu') this.saveGame(); });
    this.resize();
    this.last = performance.now(); this.running = true;
    this.startMenuWorld();
    this.menus.show('main');
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.pixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.hand.resize(w / h);
    document.documentElement.classList.toggle('portrait', h > w);
  }
  saveSettings() { try { localStorage.setItem('bw_settings', JSON.stringify(this.settings)); } catch (e) { /* ok */ } }
  applySettings() {
    this.sfx.applyVolumes(); this.particles.enabled = this.settings.particles;
    if (this.player) this.player.autoJump = !!this.settings.autoJump;
    this.touch?.setHints(!!this.settings.controlHints);
    this.resize(); if (this.world) this.world.remeshAll();
    this.saveSettings();
  }

  // ---------- ввод ----------
  setupInput() {
    const c = this.controls;
    c.onLockChange = (locked) => {
      if (!locked && this.state === 'playing' && !this.uiOpen && !this.chat.isOpen && !IS_TOUCH && !this.ignoreUnlock) this.pause();
    };
    const unlockAudio = () => this.sfx.resume();
    window.addEventListener('pointerdown', unlockAudio); window.addEventListener('keydown', unlockAudio); window.addEventListener('touchend', unlockAudio);
    c.onKey = (e) => {
      if (this.chat.isOpen) return false;
      if (this.state !== 'playing' && this.state !== 'paused') return false;
      if (e.code === 'F3') { this.debug.toggle(); return true; }
      if (this.state !== 'playing') return false;
      if (e.code === 'F1') { this.hudHidden = !this.hudHidden; this.hud.show(!this.hudHidden); return true; }
      if (e.code === 'F2') { this.screenshotReq = true; return true; }
      if (e.code === 'F5') { this.view = (this.view + 1) % 3; return true; }
      if (this.uiOpen) {
        const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
        if (e.code === 'Escape' || (e.code === 'KeyE' && !typing)) { this.closeUI(); return true; }
        if (!typing && /^Digit[1-9]$/.test(e.code)) { this.container.keyNumber(parseInt(e.code.slice(5), 10) - 1); return true; }
        return false;
      }
      if (!c.active()) return false;
      if (e.code === 'KeyE') { this.openUI('inventory'); return true; }
      if (e.code === 'KeyT') { this.openChat(''); return true; }
      if (e.code === 'Slash') { this.openChat('/'); return true; }
      return false;
    };
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.state === 'paused') this.resume(); });
  }
  openChat(prefill) { this.chat.open(prefill); this.uiOpen = true; this.controls.keys.clear(); }
  afterChatClose() { this.uiOpen = false; if (this.state === 'playing') this.relock(); }
  openUI(kind, be) {
    this.uiOpen = true; this.controls.keys.clear();
    this.ignoreUnlock = true; this.controls.unlock(); setTimeout(() => { this.ignoreUnlock = false; }, 400);
    this.container.open(kind, be);
    this.touch?.setUIMode(true);
  }
  closeUI() {
    if (this.shop?.isOpen) { this.shop.close(); return; }
    this.container.close(); this.uiOpen = false; this.touch?.setUIMode(false);
    if (this.state === 'playing') this.relock();
  }
  relock() { if (!IS_TOUCH && !this.controls.forced) this.controls.lock(); }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.controls.keys.clear(); this.controls.unlock(); this.saveGame();
    this.menus.show('pause');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.menus.hide(); this.state = 'playing'; this.relock(); this.last = performance.now();
  }

  // ---------- миры ----------
  startMenuWorld() {
    const settings = Object.assign({}, this.settings, { renderDistance: IS_TOUCH ? 3 : 5 });
    this.menuWorld = new World({ seed: 777, scene: this.scene, materials: this.materials, settings, storage: null, worldId: '__menu' });
    this.world = this.menuWorld; this.player = null;
    const gen = new Generator(777), o = { h: 0, biome: 0 };
    let sp = { x: 0, z: 0, y: 90 };
    outer: for (let r = 0; r < 800; r += 16) for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, x = Math.cos(a) * r, z = Math.sin(a) * r; gen.sample(x, z, o); if (o.h > SEA + 2 && o.biome !== BIOME.OCEAN) { sp = { x, z, y: o.h }; break outer; } }
    this.menuCenter = sp; this.state = 'menu'; this.time = 7000; this.rain = 0; this.thunder = 0;
    this.particles.world = this.world; this.hud.show(false);
  }
  async startWorld(meta) {
    this.stopWorld();
    this.menus.showLoading('Загрузка мира…');
    await this.storage.open().catch(() => {});
    this.meta = meta;
    const saved = new Set();
    try { for (const k of await this.storage.listChunkKeys(meta.id)) saved.add(k); } catch (e) { /* нет БД */ }
    const city = meta.worldType === 'city', cityVer = meta.cityVer || 1;
    this.world = new World({ seed: meta.seed, scene: this.scene, materials: this.materials, settings: this.settings, storage: this.storage.db ? this.storage : null, worldId: meta.id, city, cityVer });
    this.world.savedKeys = saved;
    this.particles.world = this.world;
    this.world.on('blockchange', (x, y, z, o, n, opts) => this.onBlockChange(x, y, z, o, n, opts));
    this.world.on('chunkmeshed', (c) => this.onChunkMeshed(c));
    this.world.on('chunkunload', (c) => this.onChunkUnload(c));
    this.clouds = new Clouds(this.scene, meta.seed); this.clouds.low = IS_TOUCH;
    this.ticker = new Ticker(this); this.fluids = new Fluids(this);
    this.player = new Player(this.world); this.player.mode = meta.mode || 'survival'; this.player.autoJump = !!this.settings.autoJump;
    this.gen = new Generator(meta.seed, { city, cityVer });
    this.inventory = new Inventory(); this.survival = new Survival(this); this.interaction = new Interaction(this);
    this.entities.clear(); this.mobs = new MobManager(this); this.town = new Town(this);
    this.quests?.dispose(); this.quests = new Quests(this);
    this.weather.dispose(); this.weather = new Weather(this);
    this.time = meta.time !== undefined ? meta.time : 1000; this.day = meta.day || 0; this.rain = 0; this.thunder = 0;
    this.torches.clear();
    let st = null; try { st = await this.storage.loadState(meta.id); } catch (e) { /* ok */ }
    if (meta.player) {
      Object.assign(this.player, { x: meta.player.x, y: meta.player.y, z: meta.player.z, yaw: meta.player.yaw || 0, pitch: meta.player.pitch || 0 });
      this.player.peakY = this.player.y; this.player.flying = !!meta.player.flying;
      this.inventory.load(meta.inventory); this.survival.load(meta.survival);
      this.spawn = meta.spawn || { x: this.player.x, y: this.player.y, z: this.player.z };
      this.weather.load(meta.weather);
      if (st) this.mobs.load(st);
    } else {
      const sp = this.findSpawn(); this.spawn = sp; this.player.setPos(sp.x, sp.y, sp.z);
    }
    this.state = 'loading'; this.loadWait = 0; this.controls.enabled = false;
    this.hud.show(false);
  }
  stopWorld() {
    if (this.container.isOpen) this.container.close();
    if (this.world) { this.world.dispose(); this.world = null; }
    this.menuWorld = null;
    if (this.clouds) { this.scene.remove(this.clouds.group); this.clouds = null; }
    this.entities.clear(); this.player = null; this.state = 'menu'; this.uiOpen = false;
    this.hud.show(false); this.touch?.show(false); this.playerModel.group.visible = false;
  }
  async exitToMenu() {
    if (this.world && this.meta && this.player) await this.saveGame();
    this.stopWorld(); this.startMenuWorld(); this.menus.show('main'); this.controls.enabled = false;
  }
  findSpawn() {
    if (this.gen.cityVer >= 2) return { x: BASE.spawn.x, y: CITY_G + 2, z: BASE.spawn.z }; // у арки базы
    if (this.gen.city) { // город: ближайший перекрёсток не на реке
      for (let r = 0; r < 20; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const x = i * 32 + 2, z = j * 32 + 2;
        if (!cityRiver(this.gen, x, z)) return { x: x + 0.5, y: CITY_G + 2, z: z + 0.5 };
      }
    }
    const o = { h: 0, biome: 0, t: 0, hum: 0 };
    for (let r = 0; r < 4000; r += 16) {
      const n = r === 0 ? 1 : Math.max(8, r / 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        this.gen.sample(x, z, o);
        if (o.h > SEA + 1 && o.biome !== BIOME.OCEAN && o.biome !== BIOME.MOUNTAINS && o.biome !== BIOME.BEACH && o.biome !== BIOME.DESERT) return { x: x + 0.5, y: o.h + 2, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: 90, z: 0.5 };
  }
  async saveGame() {
    if (!this.world || !this.meta || !this.player || !this.storage.db || this.meta.id === 'test') return;
    const p = this.player, m = this.meta;
    Object.assign(m, {
      lastPlayed: Date.now(), time: this.time, day: this.day, mode: p.mode, spawn: this.spawn,
      player: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, flying: p.flying }, inventory: this.inventory.serialize(), survival: this.survival.serialize(), weather: this.weather.serialize(),
    });
    try { await this.storage.saveWorld(m); await this.world.saveAll(); await this.storage.saveState(m.id, this.mobs.serialize()); } catch (e) { console.warn('save', e); }
  }

  // ---------- события мира ----------
  onBlockChange(x, y, z, old, nu, opts) {
    actions.onBlockChange.call(this, x, y, z, old, nu, opts);
    const k = x + ',' + y + ',' + z;
    if (nu === B.torch) this.torches.add(k); else if (old === B.torch) this.torches.delete(k);
  }
  onChunkMeshed(c) {
    if (c.torchScanned) return; c.torchScanned = true;
    const b = c.blocks, x0 = c.cx * 16, z0 = c.cz * 16;
    for (let y = 1; y <= c.maxY; y++) for (let i = 0; i < 256; i++) if (b[(y << 8) | i] === B.torch) this.torches.add((x0 + (i & 15)) + ',' + y + ',' + (z0 + (i >> 4)));
    if (this.mobs && this.state === 'playing') this.mobs.onChunk(c);
  }
  onChunkUnload(c) {
    const x0 = c.cx * 16, z0 = c.cz * 16;
    for (const k of this.torches) { const [x, , z] = k.split(',').map(Number); if (x >= x0 && x < x0 + 16 && z >= z0 && z < z0 + 16) this.torches.delete(k); }
  }
  onHurt() { this.shake = Math.max(this.shake, 0.25); }
  onPetTamed(pet) { this.quests?.onPetTamed(pet); }
  onPetFed(pet) { this.quests?.onPetFed(pet); }
  onTownBuilt(town) { this.quests?.onTownBuilt(town); }
  onTownSite(site) { this.quests?.onTownBuilt(site); }
  onFireOut(f) { this.quests?.onFireOut(f); }
  onPickup(stack) { this.quests?.onPickup(stack); }
  // ---------- машинка-робот ----------
  spawnCarbot(x, y, z, yaw, style, robot, kind = 'car') {
    const c = new Carbot(this, x, y, z, yaw, style || ['red', 'blue', 'yellow'][(Math.random() * 3) | 0], kind);
    if (robot && c.kind === 'car') { c.mode = 'robot'; c.t = 1; c.setSize(); c.pose(); }
    this.entities.add(c); return c;
  }
  // ближайшая машинка-робот (только легковые превращаются)
  nearestCar(r = 8) {
    const p = this.player; if (p.riding) return p.riding.kind === 'car' ? p.riding : null;
    let best = null, bd = r;
    for (const e of this.entities.list) if (e.type === 'carbot' && !e.dead && e.kind === 'car') { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  transformCar() { const c = this.nearestCar(); if (c) c.transform(this); return !!c; }
  onDeath() {
    const p = this.player, inv = this.inventory;
    if (p.riding) p.riding.dismount(this);
    for (const s of [...inv.slots, ...inv.armor]) if (s) this.dropItem(p.x, p.y + 1, p.z, s, [(Math.random() - 0.5) * 4, 4, (Math.random() - 0.5) * 4]);
    inv.clear();
    this.sfx.play('death');
    this.state = 'dead'; this.uiOpen = true; if (this.container.isOpen) this.container.close(); this.controls.unlock();
    this.touch?.setUIMode(true);
    this.menus.show('death', this.survival.lastCause);
  }
  respawn() {
    const sp = this.spawn, p = this.player;
    this.survival.reset(); p.setPos(sp.x, sp.y, sp.z); p.flying = false;
    this.menus.hide(); this.uiOpen = false; this.touch?.setUIMode(false);
    this.state = 'loading'; this.loadWait = 0; this.respawning = true;
  }

  // ---------- главный цикл ----------
  loop(now) {
    if (!this.running) return;
    requestAnimationFrame((t) => this.loop(t));
    const lim = this.settings.fpsLimit;
    if (lim > 0 && now - this.last < 1000 / lim - 1) return;
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.clock += dt;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    try { this.tick(dt); } catch (e) { console.error(e); }
    this.render();
    this.controls.endFrame();
  }

  tick(dt) {
    const w = this.world;
    if (!w) return;
    if (this.state === 'menu') { this.tickMenu(dt); return; }
    const p = this.player;
    if (this.state === 'loading') {
      w.update(p.x, p.z, 0, 1, dt);
      this.loadWait += dt;
      const c = w.getChunk(Math.floor(p.x) >> 4, Math.floor(p.z) >> 4);
      const ok = w.allReadyAround(p.x, p.z, 1) && c && c.meshState === 2;
      this.menus.setLoadingProgress(Math.min(1, w.stats.meshed / 20));
      if (ok || this.loadWait > 40) this.onLoaded();
      this.updateEnvironment(dt); this.updateCamera(dt);
      return;
    }
    if (this.state === 'paused') { w.update(p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), dt); this.updateEnvironment(dt); this.updateCamera(dt); return; }
    const active = this.state === 'playing' && this.controls.active() && !this.uiOpen;
    if (active) {
      const s = 0.0022 * this.settings.sensitivity * (IS_TOUCH ? 1.3 : 1);
      p.yaw -= this.controls.dx * s; p.pitch = clamp(p.pitch - this.controls.dy * s, -1.55, 1.55);
    }
    this.time += dt * 20;
    if (this.time >= 24000) { this.time -= 24000; this.day++; }
    this.accum += dt;
    const inp = active ? this.controls.input() : { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false };
    let n = 0;
    while (this.accum >= 1 / 60 && n < 6) { p.update(1 / 60, this.state === 'dead' ? { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false } : inp, this.clock); this.accum -= 1 / 60; n++; }
    if (n === 6) this.accum = 0;
    if (p.stepEvent) this.sfx.play('step:' + (p.inWater ? 'water' : this.soundUnder()), { x: p.x, y: p.y, z: p.z }, p.sneaking ? 0.4 : 1);
    if (p.inWater && !this.wasWater) { this.sfx.play('splash', { x: p.x, y: p.y, z: p.z }); this.particles.splash(p.x, p.y + 1, p.z, 14); }
    this.wasWater = p.inWater;
    if (p.headInWater && (this.bubbleT -= dt) <= 0) { this.bubbleT = 0.5; this.particles.bubble(p.x + (Math.random() - 0.5) * 0.4, p.y + p.eye, p.z + (Math.random() - 0.5) * 0.4); }
    if (this.state === 'playing') { this.survival.update(dt); this.interaction.update(dt); }
    this.ticker.update(dt); this.fluids.update(dt);
    this.tickBlockEntities(dt);
    this.weather.update(dt);
    this.entities.update(dt);
    if (this.state === 'playing') { this.mobs.update(dt); this.town.update(dt); this.quests.update(dt); }
    this.ambience.update(dt);
    this.ambients(dt);
    this.autosave(dt);
    w.update(p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), dt);
    this.updateEnvironment(dt);
    this.updateCamera(dt);
    this.updateTarget();
    this.particles.update(dt, this.camera);
    this.hand.update(dt);
    this.sfx.setListener(p.x, p.y + 1.6, p.z, p.yaw);
    this.hud.update(dt);
    this.container.update(dt);
    this.slowT -= dt; if (this.slowT <= 0) { this.slowT = 0.3; this.chat.update(); this.touch?.setRobotVisible(!!this.nearestCar()); this.touch?.setRiding(!!p.riding); }
  }
  tickMenu(dt) {
    const c = this.menuCenter, w = this.world, t = this.clock;
    const a = t * 0.04, r = 44;
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    this.menuY = this.menuY || c.y + 24; const ty = w.topY(Math.floor(x), Math.floor(z)); this.menuY += (Math.max(c.y + 24, ty + 14) - this.menuY) * Math.min(1, dt);
    const y = this.menuY;
    w.update(x, z, -Math.sin(a), Math.cos(a), dt);
    this.camera.position.set(x, y, z);
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(-0.3, -a - Math.PI / 2 + 0.9, 0);
    this.time = (7000 + t * 12) % 24000;
    this.updateEnvironment(dt);
    this.particles.update(dt, this.camera);
  }
  autosave(dt) { this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 30; this.saveGame(); } }
  tickBlockEntities(dt) {
    for (const be of this.world.be.values()) {
      if (be.type !== 'furnace') continue;
      if (tickFurnace(be, dt)) {
        const id = this.world.getBlock(be.x, be.y, be.z); const m = BLOCKS[id].name.match(/^furnace_(lit_)?(\d)$/);
        if (m) this.world.setBlock(be.x, be.y, be.z, B[(be.burn > 0 ? 'furnace_lit_' : 'furnace_') + m[2]], { keepBE: true });
      }
      if (be.burn > 0 && Math.random() < dt * 4) this.particles.smoke(be.x + 0.5, be.y + 1.1, be.z + 0.5, 0.3, 0.15, 1.0);
    }
  }
  ambients(dt) {
    const p = this.player;
    this.torchT -= dt;
    if (this.torchT > 0 || !this.settings.particles) return;
    this.torchT = 0.12;
    let n = 0;
    for (const k of this.torches) {
      const [x, y, z] = k.split(',').map(Number);
      if (Math.abs(x - p.x) > 14 || Math.abs(z - p.z) > 14 || Math.abs(y - p.y) > 12) continue;
      if (Math.random() < 0.7) this.particles.flame(x + 0.5, y + 0.68, z + 0.5);
      if (Math.random() < 0.25) this.particles.smoke(x + 0.5, y + 0.8, z + 0.5, 0.25, 0.08, 0.9);
      if (++n > 30) break;
    }
  }
  onLoaded() {
    const p = this.player, w = this.world;
    if (!this.meta.player || this.respawning) {
      const y = Math.min(250, w.topY(Math.floor(p.x), Math.floor(p.z)) + 1);
      p.setPos(p.x, Math.max(y, 2) + 0.01, p.z);
      if (!this.meta.player) this.spawn = { x: p.x, y: p.y, z: p.z };
    }
    this.respawning = false;
    this.state = 'playing'; this.controls.enabled = true;
    this.menus.hide(); this.hud.show(!this.hudHidden); this.touch?.show(true);
    this.hud.statSig = ''; this.hud.sig = '';
    this.chat.attach();
    if (!IS_TOUCH && !this.controls.forced) { this.menus.toast('Esc — пауза, E — инвентарь, T — чат'); this.controls.lock(); }
    this.chat.log('Добро пожаловать в Blockwild! Команды: /help', '#9fe');
    this.saveT = 30;
  }

  updateEnvironment(dt) {
    const cam = this.camera;
    this.sky.update(cam.position, this.time, this.day, this.rain, this.thunder, this.clock, this.flash || 0);
    const u = this.materials.uniforms;
    u.uTime.value = this.clock;
    u.uSunCol.value.copy(this.sky.sunLight);
    u.uFlash.value = (this.flash || 0) * 0.5;
    const R = this.world === this.menuWorld ? 3 : this.settings.renderDistance;
    const wet = 1 - this.rain * 0.28;
    let near = R * 16 * 0.55 * wet, far = (R * 16 * 0.97 + 8) * wet;
    u.uFogColor.value.copy(this.sky.horizon);
    let under = 0;
    const p = this.player;
    if (p && this.world) {
      if (p.headInWater) { near = 0.5; far = 22; under = 1; const d = 0.3 + 0.7 * this.sky.daylight; u.uFogColor.value.setRGB(0.12 * d, 0.3 * d, 0.55 * d); }
      if (p.headInLava) { near = 0.1; far = 3; u.uFogColor.value.setRGB(0.9, 0.3, 0.05); }
    }
    u.uFogNear.value = near; u.uFogFar.value = far; u.uUnder.value = under;
    if (!this.scene.fog) this.scene.fog = new THREE.Fog(0xffffff, far, far * 3);
    this.scene.fog.color.copy(u.uFogColor.value); this.scene.fog.near = far * 0.8; this.scene.fog.far = far * 3.2;
    if (this.clouds) {
      this.clouds.enabled = this.settings.clouds && !under;
      const d = this.sky.daylight;
      const c = new THREE.Color().setRGB(lerp(0.1, 1, d), lerp(0.11, 1, d), lerp(0.18, 1, d));
      c.lerp(new THREE.Color(0.5, 0.52, 0.56), this.rain * 0.6);
      this.clouds.update(cam.position, this.time / 20 + this.day * 1200, c, this.rain);
    }
  }

  updateCamera(dt) {
    const p = this.player, cam = this.camera;
    const eyeY = p.y + p.eye;
    let bobX = 0, bobY = 0, roll = 0;
    if (this.settings.bobbing && p.onGround && !p.flying && this.view === 0) {
      const sp = Math.hypot(p.vx, p.vz);
      this.bob += sp * dt * 2.1;
      const a = Math.min(1, sp / 4.3);
      bobY = Math.abs(Math.sin(this.bob)) * 0.06 * a - 0.03 * a; bobX = Math.sin(this.bob) * 0.04 * a; roll = Math.sin(this.bob) * 0.012 * a;
    }
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const sh = this.shake * 0.08;
    cam.rotation.order = 'YXZ';
    const yaw = p.yaw, pitch = p.pitch;
    if (this.survival.hurtT > 0) roll += Math.sin(this.survival.hurtT * 20) * 0.04;
    if (this.state === 'dead') roll += 0.5;
    cam.position.set(p.x, eyeY + bobY, p.z);
    cam.rotation.set(pitch + (Math.random() - 0.5) * sh, yaw + (Math.random() - 0.5) * sh, roll);
    if (bobX) cam.translateX(bobX);
    const pm = this.playerModel.group;
    if (this.view > 0) {
      const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const sign = this.view === 1 ? 1 : -1; let dist = p.riding ? (p.riding.kind === 'car' ? 5.5 : 7.5) : 4;
      const r2 = raycast(this.world, cam.position.x, cam.position.y, cam.position.z, -dir.x * sign, -dir.y * sign, -dir.z * sign, dist);
      if (r2.hit) dist = Math.max(0.6, r2.dist - 0.3);
      cam.position.x -= dir.x * sign * dist; cam.position.y -= dir.y * sign * dist; cam.position.z -= dir.z * sign * dist;
      if (this.view === 2) cam.rotation.set(-pitch, yaw + Math.PI, roll);
      pm.visible = !p.riding; pm.position.set(p.x, p.y, p.z); pm.rotation.y = yaw + Math.PI;
      pm.rotation.y = yaw;
      const sw = Math.sin(p.walkDist * 2.2) * 0.9 * Math.min(1, Math.hypot(p.vx, p.vz) / 3);
      const P = this.playerModel.parts;
      P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.armL.rotation.x = -sw; P.armR.rotation.x = sw - (this.hand.swinging ? Math.sin(this.hand.swing * Math.PI) * 1.6 : 0);
      P.head.rotation.x = -pitch; this.playerModel.mat.color.setScalar(0.9);
    } else pm.visible = false;
    this.hand.root.visible = this.view === 0 && this.state !== 'dead' && !this.hudHidden;
    const baseFov = this.settings.fov * (p.headInWater ? 0.94 : 1);
    const target = baseFov + (p.sprinting && Math.hypot(p.vx, p.vz) > 4 ? 9 : 0) + (p.flying ? 3 : 0);
    this.fovCur += (target - this.fovCur) * Math.min(1, dt * 8);
    if (Math.abs(cam.fov - this.fovCur) > 0.01) { cam.fov = this.fovCur; cam.updateProjectionMatrix(); }
  }

  updateTarget() {
    const cam = this.camera;
    if (this.state !== 'playing' || !this.controls.active() || this.uiOpen || this.view !== 0) { this.target = null; this.selection.setTarget(null); this.selection.setCrack(0); return; }
    cam.getWorldDirection(this.dirVec);
    const d = this.dirVec;
    const r = raycast(this.world, cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z, this.player.creative ? 6 : 4.5, false);
    this.target = r.hit ? r : null;
    this.selection.setTarget(this.target);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    if (this.player && this.state !== 'loading' && this.state !== 'menu' && this.hand.root.visible) this.hand.update && this.hand.render(this.renderer);
    if (this.debug.visible) this.debug.update(this);
    if (this.screenshotReq) {
      this.screenshotReq = false;
      this.canvas.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'blockwild-' + Date.now() + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); this.chat.log('Скриншот сохранён'); });
    }
  }
}
const { onBlockChange: _skip, setGameMode, ...rest } = actions;
Object.assign(Game.prototype, rest, { setGameMode });
