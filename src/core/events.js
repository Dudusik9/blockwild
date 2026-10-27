export class Emitter {
  constructor() { this.h = new Map(); }
  on(ev, fn) { if (!this.h.has(ev)) this.h.set(ev, []); this.h.get(ev).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { const a = this.h.get(ev); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  emit(ev, ...args) { const a = this.h.get(ev); if (a) for (const f of a.slice()) f(...args); }
}
export const bus = new Emitter();
