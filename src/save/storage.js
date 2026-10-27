// Сохранения в IndexedDB: метаданные мира, изменённые чанки (RLE), состояние (сущности)
const DB_NAME = 'blockwild', DB_VER = 1;

export function rleEncode(blocks) {
  const out = []; let v = blocks[0], n = 1;
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === v && n < 65535) n++; else { out.push(v, n); v = b; n = 1; }
  }
  out.push(v, n);
  return Uint16Array.from(out);
}
export function rleDecode(data, out) {
  let p = 0;
  for (let i = 0; i < data.length; i += 2) { const v = data[i], n = data[i + 1]; out.fill(v, p, p + n); p += n; }
  return out;
}

export class Storage {
  constructor() { this.db = null; }
  open() {
    if (this.db) return Promise.resolve(this);
    return new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        db.createObjectStore('worlds', { keyPath: 'id' });
        db.createObjectStore('chunks');
        db.createObjectStore('state');
      };
      rq.onsuccess = () => { this.db = rq.result; res(this); };
      rq.onerror = () => rej(rq.error);
    });
  }
  _tx(store, mode = 'readonly') { return this.db.transaction(store, mode).objectStore(store); }
  _p(rq) { return new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }); }
  async listWorlds() { await this.open(); const all = await this._p(this._tx('worlds').getAll()); return all.sort((a, b) => b.lastPlayed - a.lastPlayed); }
  async saveWorld(meta) { await this.open(); return this._p(this._tx('worlds', 'readwrite').put(meta)); }
  async deleteWorld(id) {
    await this.open();
    await this._p(this._tx('worlds', 'readwrite').delete(id));
    await this._p(this._tx('state', 'readwrite').delete(id));
    const range = IDBKeyRange.bound(id + ':', id + ':￿');
    await this._p(this._tx('chunks', 'readwrite').delete(range));
  }
  async listChunkKeys(id) {
    await this.open();
    const keys = await this._p(this._tx('chunks').getAllKeys(IDBKeyRange.bound(id + ':', id + ':￿')));
    return keys;
  }
  async saveChunk(wid, cx, cz, data) {
    await this.open();
    const rec = { rle: rleEncode(data.blocks), biomes: data.biomes.slice(), heights: data.heights.slice(), maxY: data.maxY, bes: JSON.parse(JSON.stringify(data.bes || [])) };
    return this._p(this._tx('chunks', 'readwrite').put(rec, wid + ':' + cx + ',' + cz));
  }
  async loadChunk(wid, cx, cz) {
    await this.open();
    const rec = await this._p(this._tx('chunks').get(wid + ':' + cx + ',' + cz));
    if (!rec) return null;
    const blocks = new Uint16Array(65536); rleDecode(rec.rle, blocks);
    return { blocks, biomes: rec.biomes, heights: rec.heights, maxY: rec.maxY, bes: rec.bes };
  }
  async saveState(wid, obj) { await this.open(); return this._p(this._tx('state', 'readwrite').put(JSON.parse(JSON.stringify(obj)), wid)); }
  async loadState(wid) { await this.open(); return this._p(this._tx('state').get(wid)); }
}
