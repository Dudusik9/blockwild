// Мир: чанки, пулы воркеров, загрузка/выгрузка, доступ к блокам
import * as THREE from 'three';
import { Emitter } from '../core/events.js';
import { OPAQUE, OPAC, EMIT, BLOCKS, B, SOLID, LAYER, FAMILY } from './blocks.js';
import { BIOMES } from './biomes.js';
import { layerGeometry } from '../render/chunkRenderer.js';
import { CH } from '../core/math.js';

const key = (cx, cz) => cx * 65536 + cz + 0x7fffffff;
export { key as chunkKey };

class WorkerPool {
  constructor(url, n) {
    this.workers = []; this.busy = []; this.cbs = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(url, { type: 'module' });
      w.onmessage = (e) => { this.busy[i] = false; const cb = this.cbs[i]; this.cbs[i] = null; cb && cb(e.data); };
      w.onerror = (e) => { console.error('worker error', e.message, e.filename, e.lineno); this.busy[i] = false; };
      this.workers.push(w); this.busy.push(false); this.cbs.push(null);
    }
  }
  get free() { let n = 0; for (const b of this.busy) if (!b) n++; return n; }
  submit(msg, transfer, cb) {
    const i = this.busy.indexOf(false);
    if (i < 0) return false;
    this.busy[i] = true; this.cbs[i] = cb; this.workers[i].postMessage(msg, transfer || []);
    return true;
  }
  terminate() { for (const w of this.workers) w.terminate(); }
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = null; this.biomes = null; this.heights = null; this.light = null; this.lightRows = 0;
    this.ready = false; this.loading = true;       // данные блоков
    this.meshState = 0;                            // 0 нет, 1 в работе, 2 готов
    this.dirty = false; this.urgent = false; this.meshVer = 0;
    this.modified = false; this.maxY = 0;
    this.meshes = [null, null, null]; this.group = null;
    this.verts = 0; this.tris = 0;
  }
}

export class World extends Emitter {
  constructor({ seed, scene, materials, settings, storage = null, worldId = null, city = false }) {
    super();
    this.seed = seed; this.city = !!city; this.scene = scene; this.materials = materials; this.settings = settings;
    this.storage = storage; this.worldId = worldId;
    this.chunks = new Map(); this.be = new Map();
    this.group = new THREE.Group(); scene.add(this.group);
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const total = Math.max(2, Math.min(8, hc - 1));
    const nGen = Math.max(1, Math.round(total * 0.34)), nMesh = Math.max(1, total - nGen);
    this.genPool = new WorkerPool(new URL('../workers/genWorker.js', import.meta.url), nGen);
    this.meshPool = new WorkerPool(new URL('../workers/meshWorker.js', import.meta.url), nMesh);
    this.order = []; this.orderT = 0; this.lastPc = [1e9, 1e9];
    this.results = [];
    this.savedKeys = new Set();
    this._lc = null; this._lk = -1;
    this.stats = { chunks: 0, meshed: 0, verts: 0, tris: 0, genQ: 0, meshQ: 0 };
    this.loadCount = 0; this.timeSum = 0;
    this.sky = 15; // для getLight вне чанков
  }

  // ---------- доступ к блокам ----------
  getChunk(cx, cz) {
    const k = key(cx, cz);
    if (k === this._lk) return this._lc;
    const c = this.chunks.get(k);
    this._lk = k; this._lc = c;
    return c;
  }
  isLoaded(x, z) { const c = this.getChunk(x >> 4, z >> 4); return !!(c && c.ready); }
  getBlock(x, y, z) {
    if (y < 0 || y > 255) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return 0;
    return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  getBiome(x, z) { const c = this.getChunk(x >> 4, z >> 4); return c && c.biomes ? c.biomes[((z & 15) << 4) | (x & 15)] : 2; }
  topY(x, z) { const c = this.getChunk(x >> 4, z >> 4); return c && c.heights ? c.heights[((z & 15) << 4) | (x & 15)] : 0; }
  // свет: (sun<<4)|block
  getLight(x, y, z) {
    if (y < 0) return 0;
    if (y > 255) return 0xf0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return 0xf0;
    if (!c.light) return y > c.heights[((z & 15) << 4) | (x & 15)] ? 0xf0 : 0;
    if (y >= c.lightRows) return 0xf0;
    return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }
  sunAt(x, y, z) { return this.getLight(x, y, z) >> 4; }
  blockLightAt(x, y, z) { return this.getLight(x, y, z) & 15; }

  setBlock(x, y, z, id, opts = {}) {
    if (y < 0 || y > 255) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return false;
    const lx = x & 15, lz = z & 15, i = (y << 8) | (lz << 4) | lx;
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    c.modified = true;
    if (y > c.maxY) c.maxY = y;
    // карта высот
    const hi = (lz << 4) | lx;
    const solidish = (b) => b !== 0 && (SOLID[b] || OPAC[b] > 0 || FAMILY[b]);
    if (solidish(id)) { if (y > c.heights[hi]) c.heights[hi] = y; }
    else if (y === c.heights[hi]) { let yy = y - 1; while (yy > 0 && !solidish(c.blocks[(yy << 8) | hi])) yy--; c.heights[hi] = yy; }
    // перемешивание
    const light = EMIT[id] !== EMIT[old] || OPAC[id] !== OPAC[old];
    const R = (EMIT[id] > 0 || EMIT[old] > 0) ? 14 : (light ? 7 : 0);
    this.markDirty(c, true);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      if (dx < 0 && lx > R) continue; if (dx > 0 && 15 - lx > R) continue;
      if (dz < 0 && lz > R) continue; if (dz > 0 && 15 - lz > R) continue;
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (n && n.ready) this.markDirty(n, true);
    }
    // сущности блоков
    if (!opts.keepBE) {
      const bk = x + ',' + y + ',' + z;
      if (this.be.has(bk) && !this.isBEBlock(id)) this.be.delete(bk);
    }
    if (!opts.silent) this.emit('blockchange', x, y, z, old, id, opts);
    return true;
  }
  isBEBlock(id) { const n = BLOCKS[id].name; return n.startsWith('furnace') || n.startsWith('chest'); }
  markDirty(c, urgent) { c.dirty = true; if (urgent) c.urgent = true; }
  remeshAll() { for (const c of this.chunks.values()) if (c.ready) c.dirty = true; }

  // ---------- загрузка / выгрузка ----------
  update(px, pz, lx, lz, dt) {
    const R = this.settings.renderDistance;
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    this.orderT -= dt;
    if (pcx !== this.lastPc[0] || pcz !== this.lastPc[1] || this.orderT <= 0 || this.lastR !== R) {
      this.lastPc = [pcx, pcz]; this.orderT = 0.3; this.lastR = R;
      this.buildOrder(pcx, pcz, R, lx, lz);
    }
    // генерация
    const ord = this.order;
    for (let i = 0; i < ord.length && this.genPool.free > 0; i++) {
      const o = ord[i];
      if (this.chunks.has(key(o[0], o[1]))) continue;
      this.requestChunk(o[0], o[1]);
    }
    // меширование: сначала срочные
    let tries = 0;
    for (let pass = 0; pass < 2 && this.meshPool.free > 0; pass++) {
      for (let i = 0; i < ord.length && this.meshPool.free > 0; i++) {
        const o = ord[i];
        if (o[2] > R) continue;
        const c = this.chunks.get(key(o[0], o[1]));
        if (!c || !c.ready || c.meshState === 1) continue;
        if (pass === 0 && !c.urgent) continue;
        if (c.meshState === 2 && !c.dirty) continue;
        if (!this.neighborsReady(c)) continue;
        this.submitMesh(c);
      }
    }
    // применение результатов
    let n = 0;
    while (this.results.length && n < 4) { this.applyMesh(this.results.shift()); n++; }
    // выгрузка
    if (this.unloadT === undefined) this.unloadT = 0;
    this.unloadT -= dt;
    if (this.unloadT <= 0) {
      this.unloadT = 0.5;
      for (const c of this.chunks.values()) {
        const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
        if (d > R + 2 && c.meshState !== 1 && !c.loading) this.unloadChunk(c);
      }
    }
    // статистика
    let ch = 0, me = 0, v = 0, t = 0;
    for (const c of this.chunks.values()) { ch++; if (c.meshState === 2) { me++; v += c.verts; t += c.tris; } }
    this.stats.chunks = ch; this.stats.meshed = me; this.stats.verts = v; this.stats.tris = t;
  }

  buildOrder(pcx, pcz, R, lx, lz) {
    const arr = [];
    const L = Math.hypot(lx, lz) || 1; const dx0 = lx / L, dz0 = lz / L;
    for (let dz = -(R + 1); dz <= R + 1; dz++) for (let dx = -(R + 1); dx <= R + 1; dx++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > (R + 1.5) * (R + 1.5)) continue;
      const dd = Math.sqrt(d2) || 1;
      const dot = (dx * dx0 + dz * dz0) / dd;
      arr.push([pcx + dx, pcz + dz, Math.max(Math.abs(dx), Math.abs(dz)), d2 - (d2 > 1 ? dot * 6 : 0)]);
    }
    arr.sort((a, b) => a[3] - b[3]);
    this.order = arr;
  }

  requestChunk(cx, cz) {
    const c = new Chunk(cx, cz);
    this.chunks.set(key(cx, cz), c); this._lk = -1;
    const k = key(cx, cz);
    const submitGen = () => {
      const ok = this.genPool.submit({ type: 'gen', id: k, cx, cz, seed: this.seed, city: this.city }, [], (res) => this.onGen(c, res));
      if (!ok) { this.chunks.delete(k); this._lk = -1; }
    };
    if (this.storage && this.savedKeys.has(this.worldId + ':' + cx + ',' + cz)) {
      this.storage.loadChunk(this.worldId, cx, cz).then((data) => {
        if (this.chunks.get(k) !== c) return;
        if (data) this.initChunkData(c, data.blocks, null, null, null, false, data);
        else { if (!this.genPool.submit({ type: 'gen', id: k, cx, cz, seed: this.seed, city: this.city }, [], (res) => this.onGen(c, res))) { this.chunks.delete(k); this._lk = -1; } }
      });
    } else submitGen();
  }

  onGen(c, res) {
    if (this.chunks.get(key(c.cx, c.cz)) !== c) return;
    const blocks = new Uint16Array(65536);
    blocks.set(res.blocks);
    this.initChunkData(c, blocks, res.biomes, res.heights, res.bes, true);
  }
  initChunkData(c, blocks, biomes, heights, bes, fresh, saved) {
    c.blocks = blocks;
    if (saved) { c.biomes = saved.biomes; c.heights = saved.heights; }
    else { c.biomes = biomes; c.heights = heights; }
    if (!c.biomes) { c.biomes = new Uint8Array(256).fill(2); }
    if (!c.heights) { c.heights = new Uint8Array(256); for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { let y = 255; while (y > 0 && !(blocks[(y << 8) | (z << 4) | x] !== 0 && (SOLID[blocks[(y << 8) | (z << 4) | x]] || OPAC[blocks[(y << 8) | (z << 4) | x]] > 0))) y--; c.heights[(z << 4) | x] = y; } }
    let m = 0; for (let i = 0; i < 256; i++) if (c.heights[i] > m) m = c.heights[i];
    c.maxY = m; if (saved && saved.maxY) c.maxY = Math.max(m, saved.maxY);
    c.ready = true; c.loading = false;
    if (fresh && bes) for (const b of bes) { const k = b.x + ',' + b.y + ',' + b.z; if (!this.be.has(k)) this.be.set(k, b); }
    if (saved && saved.bes) for (const b of saved.bes) this.be.set(b.x + ',' + b.y + ',' + b.z, b);
    this.emit('chunkready', c);
  }

  neighborsReady(c) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const n = this.chunks.get(key(c.cx + dx, c.cz + dz));
      if (!n || !n.ready) return false;
    }
    return true;
  }

  submitMesh(c) {
    const chunks = [], biomes = [], transfer = [];
    let rows = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = this.chunks.get(key(c.cx + dx, c.cz + dz));
      rows = Math.max(rows, Math.min(256, n.maxY + 3));
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = this.chunks.get(key(c.cx + dx, c.cz + dz));
      const r = Math.min(256, n.maxY + 3);
      const a = n.blocks.slice(0, r << 8); chunks.push(a); transfer.push(a.buffer);
      const b = n.biomes.slice(); biomes.push(b); transfer.push(b.buffer);
    }
    c.meshState = 1; c.dirty = false; c.urgent = false; c.meshVer++;
    const ver = c.meshVer;
    const ok = this.meshPool.submit({ type: 'mesh', id: key(c.cx, c.cz), cx: c.cx, cz: c.cz, ver, chunks, biomes, opts: { ao: this.settings.ao, smooth: this.settings.smoothLight } }, transfer, (res) => { this.results.push(res); });
    if (!ok) { c.meshState = c.meshes[0] || c.meshes[1] || c.meshes[2] ? 2 : 0; c.dirty = true; }
  }

  applyMesh(res) {
    const c = this.chunks.get(key(res.cx, res.cz));
    if (!c) return;
    c.meshState = 2;
    c.light = res.light; c.lightRows = res.light.length >> 8;
    if (!c.group) { c.group = new THREE.Group(); c.group.position.set(c.cx * 16, 0, c.cz * 16); this.group.add(c.group); }
    let verts = 0, tris = 0;
    const mats = [this.materials.opaque, this.materials.cutout, this.materials.trans];
    for (let l = 0; l < 3; l++) {
      const old = c.meshes[l];
      const data = res.layers[l];
      if (old) { c.group.remove(old); old.geometry.dispose(); c.meshes[l] = null; }
      if (data) {
        const m = new THREE.Mesh(layerGeometry(data, c.maxY + 2), mats[l]);
        m.matrixAutoUpdate = false; m.frustumCulled = true;
        m.updateMatrix(); m.matrixWorld.copy(m.matrix);
        if (l === 2) m.renderOrder = 1;
        c.group.add(m); c.meshes[l] = m;
        verts += data.n; tris += data.idx.length / 3;
      }
    }
    c.group.updateMatrixWorld(true);
    c.verts = verts; c.tris = tris;
    this.emit('chunkmeshed', c);
  }

  unloadChunk(c) {
    if (c.group) { for (const m of c.meshes) if (m) m.geometry.dispose(); this.group.remove(c.group); c.group = null; }
    if (c.modified && this.storage && c.ready) this.saveChunk(c);
    this.chunks.delete(key(c.cx, c.cz)); this._lk = -1;
    this.emit('chunkunload', c);
    // BE очищаем только если сохранён
    const x0 = c.cx * 16, z0 = c.cz * 16;
    for (const [k, b] of this.be) if (b.x >= x0 && b.x < x0 + 16 && b.z >= z0 && b.z < z0 + 16) this.be.delete(k);
  }

  chunkBEs(c) {
    const out = []; const x0 = c.cx * 16, z0 = c.cz * 16;
    for (const b of this.be.values()) if (b.x >= x0 && b.x < x0 + 16 && b.z >= z0 && b.z < z0 + 16) out.push(b);
    return out;
  }
  saveChunk(c) {
    if (!this.storage) return Promise.resolve();
    c.modified = false;
    this.savedKeys.add(this.worldId + ':' + c.cx + ',' + c.cz);
    return this.storage.saveChunk(this.worldId, c.cx, c.cz, { blocks: c.blocks, biomes: c.biomes, heights: c.heights, maxY: c.maxY, bes: this.chunkBEs(c) });
  }
  saveAll() {
    const ps = [];
    for (const c of this.chunks.values()) if (c.modified && c.ready) ps.push(this.saveChunk(c));
    return Promise.all(ps);
  }

  // Свободная проверка прогрузки области под игроком
  allReadyAround(x, z, r = 1) {
    const cx = x >> 4, cz = z >> 4;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const c = this.chunks.get(key(cx + dx, cz + dz)); if (!c || !c.ready) return false; }
    return true;
  }

  dispose() {
    this.genPool.terminate(); this.meshPool.terminate();
    for (const c of this.chunks.values()) { if (c.group) { for (const m of c.meshes) if (m) m.geometry.dispose(); this.group.remove(c.group); } }
    this.chunks.clear(); this.scene.remove(this.group);
  }
}
