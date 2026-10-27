// Инвентарь: хотбар (0-8) + 27 слотов + броня 4. Стек: {id, count, dmg}
import { maxStack, getItem } from './items.js';

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null);
    this.armor = new Array(4).fill(null);
    this.selected = 0;
  }
  get held() { return this.slots[this.selected]; }
  static clone(s) { return s ? { id: s.id, count: s.count, dmg: s.dmg || 0 } : null; }
  // Добавить предметы; возвращает число, которое не поместилось
  add(id, count, dmg = 0) {
    const ms = maxStack(id);
    if (ms > 1) {
      for (let pass = 0; pass < 2 && count > 0; pass++) {
        // сначала хотбар и основной, объединяя
        for (let i = 0; i < 36 && count > 0; i++) {
          const s = this.slots[i];
          if (s && s.id === id && s.count < ms) { const n = Math.min(ms - s.count, count); s.count += n; count -= n; }
        }
        if (pass === 0) break;
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) { const n = Math.min(ms, count); this.slots[i] = { id, count: n, dmg }; count -= n; }
    }
    return count;
  }
  canAdd(id, count) {
    const ms = maxStack(id); let room = 0;
    for (const s of this.slots) { if (!s) room += ms; else if (s.id === id) room += ms - s.count; }
    return room >= count;
  }
  countOf(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.count; return n; }
  take(id, n) {
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) { const t = Math.min(s.count, n); s.count -= t; n -= t; if (s.count <= 0) this.slots[i] = null; }
    }
    return n === 0;
  }
  decrementSelected(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return;
    s.count -= n; if (s.count <= 0) this.slots[this.selected] = null;
  }
  clear() { this.slots.fill(null); this.armor.fill(null); }
  serialize() {
    const f = (s) => (s ? [s.id, s.count, s.dmg || 0] : null);
    return { slots: this.slots.map(f), armor: this.armor.map(f), selected: this.selected };
  }
  load(d) {
    const g = (a) => (a ? { id: a[0], count: a[1], dmg: a[2] } : null);
    if (!d) return;
    this.slots = d.slots.map(g); this.armor = d.armor.map(g); this.selected = d.selected || 0;
    while (this.slots.length < 36) this.slots.push(null);
  }
  // износ предмета в слоте; возвращает true, если сломался
  damageSelected(amount = 1) {
    const s = this.slots[this.selected];
    if (!s) return false;
    const it = getItem(s.id);
    if (!it || !it.dur) return false;
    s.dmg = (s.dmg || 0) + amount;
    if (s.dmg >= it.dur) { this.slots[this.selected] = null; return true; }
    return false;
  }
}
