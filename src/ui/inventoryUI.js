// Экраны инвентаря: инвентарь+крафт 2x2, верстак 3x3, печь, сундук, творческий каталог
import { itemIconUrl } from './icons.js';
import { ITEMS, ITEM_LIST, getItem, maxStack, I } from '../game/items.js';
import { matchRecipe, consumeGrid } from '../game/crafting.js';
import { smeltResult, fuelTime } from '../game/recipes.js';
import { SMELT_TIME } from '../game/furnace.js';
import { BLOCKS, SHAPE } from '../world/blocks.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class ContainerUI {
  constructor(game, root) {
    this.g = game; this.root = root; this.open_ = false; this.kind = null;
    this.cursor = null; this.slots = []; this.drag = null; this.grid = []; this.gridN = 0; this.be = null;
    this.mx = 0; this.my = 0;
    this.cursorEl = h('div', 'slot cursor-stack hidden'); this.cursorEl.innerHTML = '<img class="ic"><span class="cnt"></span>';
    document.body.appendChild(this.cursorEl);
    this.tip = h('div', 'tooltip hidden'); document.body.appendChild(this.tip);
    window.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; this.moveCursor(); });
    window.addEventListener('mouseup', (e) => this.onUp(e));
    this.catTab = 0; this.search = '';
  }
  get isOpen() { return this.open_; }
  moveCursor() {
    this.cursorEl.style.left = (this.mx - 20) + 'px'; this.cursorEl.style.top = (this.my - 20) + 'px';
    this.tip.style.left = (this.mx + 14) + 'px'; this.tip.style.top = (this.my + 14) + 'px';
  }

  // ---------- открытие ----------
  open(kind, be) {
    const g = this.g;
    this.close(true);
    this.kind = kind; this.be = be || null; this.open_ = true; this.cursor = null; this.slots = [];
    const wrap = h('div', 'ui-wrap'); this.wrap = wrap;
    const panel = h('div', 'panel inv-panel'); wrap.appendChild(panel); this.panel = panel;
    const inv = g.inventory;
    const title = { inventory: 'Инвентарь', workbench: 'Верстак', furnace: 'Печь', chest: 'Сундук', creative: 'Творческий режим' }[kind];
    panel.appendChild(h('div', 'panel-title', title));
    if (kind === 'inventory' && g.player.creative) { this.kind = kind = 'creative'; panel.firstChild.textContent = 'Творческий режим'; }
    if (kind === 'inventory') {
      const top = h('div', 'inv-top');
      const armor = h('div', 'armor-col');
      for (let i = 0; i < 4; i++) armor.appendChild(this.mkSlot({ arr: inv.armor, i, type: 'armor', armor: i, ph: ['Шлем', 'Нагрудник', 'Поножи', 'Сапоги'][i] }));
      top.appendChild(armor);
      top.appendChild(this.playerDoll());
      top.appendChild(this.craftGrid(2));
      panel.appendChild(top);
    } else if (kind === 'workbench') {
      panel.appendChild(this.craftGrid(3, true));
    } else if (kind === 'furnace') {
      panel.appendChild(this.furnaceView());
    } else if (kind === 'chest') {
      const grid = h('div', 'grid g9');
      for (let i = 0; i < 27; i++) grid.appendChild(this.mkSlot({ arr: be.slots, i, type: 'normal' }));
      panel.appendChild(grid);
    } else if (kind === 'creative') {
      panel.appendChild(this.creativeView());
    }
    if (kind !== 'creative') {
      const main = h('div', 'grid g9');
      for (let i = 9; i < 36; i++) main.appendChild(this.mkSlot({ arr: inv.slots, i, type: 'normal' }));
      panel.appendChild(main);
    } else {
      panel.appendChild(h('div', 'panel-sub', 'Хотбар'));
    }
    const hot = h('div', 'grid g9 hotrow');
    for (let i = 0; i < 9; i++) hot.appendChild(this.mkSlot({ arr: inv.slots, i, type: 'normal' }));
    panel.appendChild(hot);
    if (kind === 'creative') {
      const trash = this.mkSlot({ type: 'trash', ph: 'Корзина' }); trash.el.classList.add('trash'); panel.appendChild(trash.el.parentNode || trash.el);
    }
    if (g.isTouch) {
      const bar = h('div', 'touch-bar');
      const cl = h('button', 'btn small red', '✕ Закрыть'); cl.onclick = () => g.closeUI();
      const half = h('button', 'btn small' + (this.right ? ' on' : ''), this.right ? '½ режим: ВКЛ' : '½ режим'); half.onclick = () => { this.right = !this.right; half.textContent = this.right ? '½ режим: ВКЛ' : '½ режим'; half.classList.toggle('on', this.right); };
      bar.appendChild(half); bar.appendChild(cl); panel.insertBefore(bar, panel.firstChild.nextSibling);
    }
    this.root.appendChild(wrap);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) this.dropCursor(e.button === 2); });
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    this.updateResult();
    this.refresh();
    g.sfx?.play('chest', null, 0.5);
  }
  close(silent) {
    if (!this.open_) return;
    const g = this.g;
    // вернуть сетку и курсор в инвентарь
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i]) { this.giveBack(this.grid[i]); this.grid[i] = null; }
    if (this.cursor) { this.giveBack(this.cursor); this.cursor = null; }
    this.grid = []; this.be = null;
    this.wrap.remove(); this.open_ = false; this.kind = null; this.slots = [];
    this.cursorEl.classList.add('hidden'); this.tip.classList.add('hidden');
    if (this.search !== undefined) this.search = '';
  }
  giveBack(st) {
    const g = this.g;
    const left = g.inventory.add(st.id, st.count, st.dmg || 0);
    if (left > 0) g.dropFromPlayer({ id: st.id, count: left, dmg: st.dmg || 0 });
  }
  dropCursor(one) {
    if (!this.cursor) return;
    const g = this.g;
    if (one) { g.dropFromPlayer({ id: this.cursor.id, count: 1, dmg: this.cursor.dmg || 0 }); this.cursor.count--; if (this.cursor.count <= 0) this.cursor = null; }
    else { g.dropFromPlayer(this.cursor); this.cursor = null; }
    this.refresh();
  }

  // ---------- построение ----------
  mkSlot(spec) {
    const el = h('div', 'slot'); el.innerHTML = '<img class="ic" draggable="false"><span class="cnt"></span><div class="dur"><i></i></div>';
    const s = Object.assign({ el, type: 'normal' }, spec);
    s.get = () => (s.type === 'result' ? this.result : s.type === 'creative' ? s.stack : s.arr ? s.arr[s.i] : null);
    s.set = (v) => { if (s.arr) s.arr[s.i] = v; };
    el.addEventListener('mousedown', (e) => this.onDown(e, s));
    el.addEventListener('mouseenter', () => this.onEnter(s));
    el.addEventListener('mouseleave', () => { this.hover = null; this.tip.classList.add('hidden'); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    if (spec.ph && s.type === 'armor') el.title = spec.ph;
    this.slots.push(s);
    if (spec.type === 'trash') { const w = h('div', 'trash-wrap'); w.appendChild(el); w.appendChild(h('span', 'trash-lbl', 'Корзина')); return { el: w }; }
    return s.type === 'normal' || s.type === 'armor' || s.type === 'result' || s.type === 'output' ? el : el;
  }
  playerDoll() {
    const d = h('div', 'doll');
    d.innerHTML = '<canvas width="72" height="108"></canvas>';
    const c = d.firstChild, x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    // простая пиксельная фигурка игрока
    const rect = (col, a, b, w, hh) => { x.fillStyle = col; x.fillRect(a, b, w, hh); };
    rect('#c89464', 24, 6, 24, 24); rect('#6b4226', 24, 6, 24, 8); rect('#2a3a5a', 30, 20, 4, 4); rect('#2a3a5a', 40, 20, 4, 4);
    rect('#3c7a52', 22, 32, 28, 36); rect('#c89464', 10, 32, 12, 32); rect('#c89464', 50, 32, 12, 32);
    rect('#2c4a8a', 22, 68, 14, 34); rect('#2c4a8a', 36, 68, 14, 34); rect('#1c1c24', 22, 98, 14, 6); rect('#1c1c24', 36, 98, 14, 6);
    return d;
  }
  craftGrid(n, bench) {
    const g = this.g;
    this.gridN = n; this.grid = new Array(n * n).fill(null);
    const wrap = h('div', 'craft' + (bench ? ' bench' : ''));
    const grid = h('div', 'grid cg' + n);
    for (let i = 0; i < n * n; i++) grid.appendChild(this.mkSlot({ arr: this.grid, i, type: 'normal', craft: true }));
    wrap.appendChild(grid);
    wrap.appendChild(h('div', 'arrow', '➜'));
    const res = this.mkSlot({ type: 'result' }); res.classList.add('big'); wrap.appendChild(res);
    return wrap;
  }
  furnaceView() {
    const be = this.be;
    const w = h('div', 'furnace');
    const left = h('div', 'f-left');
    left.appendChild(this.mkSlot({ arr: be.slots, i: 0, type: 'normal', furn: 'in' }));
    this.flame = h('div', 'flame'); left.appendChild(this.flame);
    left.appendChild(this.mkSlot({ arr: be.slots, i: 1, type: 'normal', furn: 'fuel' }));
    w.appendChild(left);
    this.progress = h('div', 'progress', '<i></i>'); w.appendChild(this.progress);
    const out = this.mkSlot({ arr: be.slots, i: 2, type: 'output' }); out.classList.add('big'); w.appendChild(out);
    return w;
  }
  creativeView() {
    const w = h('div', 'creative');
    const bar = h('div', 'cr-bar');
    const tabs = ['Все', 'Блоки', 'Природа', 'Инструменты', 'Прочее'];
    this.tabEls = tabs.map((t, i) => { const b = h('button', 'tab' + (i === this.catTab ? ' on' : ''), t); b.onclick = () => { this.catTab = i; this.tabEls.forEach((e, k) => e.classList.toggle('on', k === i)); this.fillCreative(); }; bar.appendChild(b); return b; });
    this.searchEl = h('input', 'search'); this.searchEl.placeholder = 'Поиск…'; this.searchEl.value = this.search || '';
    this.searchEl.addEventListener('input', () => { this.search = this.searchEl.value; this.fillCreative(); });
    this.searchEl.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Escape') this.g.closeUI(); });
    bar.appendChild(this.searchEl);
    w.appendChild(bar);
    this.crGrid = h('div', 'grid g9 crgrid'); w.appendChild(this.crGrid);
    this.fillCreative();
    return w;
  }
  fillCreative() {
    // убрать старые creative-слоты
    this.slots = this.slots.filter((s) => { if (s.type === 'creative') { s.el.remove(); return false; } return true; });
    const q = (this.search || '').toLowerCase();
    const cat = (it) => {
      if (!it.isBlock) return it.tool || it.armor || /sword|pickaxe|axe|shovel|hoe|shears|flint/.test(it.name) ? 3 : 4;
      const b = BLOCKS[it.block];
      if (b.shape === SHAPE.CROSS || /^(cactus|reed|leaves_|sapling_|farmland|log_)/.test(b.name)) return 2;
      return 1;
    };
    const list = ITEM_LIST.filter((it) => (this.catTab === 0 || cat(it) === this.catTab) && (!q || it.title.toLowerCase().includes(q) || it.name.includes(q)));
    this.crGrid.innerHTML = '';
    for (const it of list) {
      const s = this.mkSlot({ type: 'creative', stack: { id: it.id, count: 1, dmg: 0 } });
      this.crGrid.appendChild(s);
    }
    this.refresh();
  }

  // ---------- логика кликов ----------
  stacksMerge(a, b) { return a && b && a.id === b.id && (a.dmg || 0) === (b.dmg || 0) && maxStack(a.id) > 1; }
  onEnter(s) {
    this.hover = s;
    if (this.drag && this.cursor && (s.type === 'normal' || s.type === 'armor') && !this.drag.slots.includes(s)) {
      const cur = s.get();
      if (!cur || this.stacksMerge(cur, this.cursor)) { if (s.type === 'armor' && !this.armorOk(s, this.cursor)) return; this.drag.slots.push(s); s.el.classList.add('drag'); }
    }
    this.showTip(s);
  }
  showTip(s) {
    const st = s.get ? s.get() : null;
    if (!st) { this.tip.classList.add('hidden'); return; }
    const it = getItem(st.id);
    let t = `<b>${it.title}</b>`;
    if (it.dur) t += `<br><span class="dim">Прочность: ${it.dur - (st.dmg || 0)} / ${it.dur}</span>`;
    if (it.food) t += `<br><span class="dim">Сытость: +${it.food.hunger}</span>`;
    if (it.armor) t += `<br><span class="dim">Защита: ${it.armor.defense}</span>`;
    if (it.damage) t += `<br><span class="dim">Урон: ${it.damage}</span>`;
    this.tip.innerHTML = t; this.tip.classList.remove('hidden');
  }
  armorOk(s, st) { const it = getItem(st.id); return it && it.armor && it.armor.slot === s.armor; }
  onDown(e, s) {
    e.preventDefault(); e.stopPropagation();
    const g = this.g;
    if (e.button === 1) return;
    if (g.isTouch) {
      if (this.right) e = { button: 2, shiftKey: e.shiftKey, preventDefault() {}, stopPropagation() {} };
      const now = performance.now();
      if (this.lastTap && this.lastTap.s === s && now - this.lastTap.t < 380 && s.type === 'normal') { this.lastTap = null; this.drag = null; this.quickMove(s); return; }
      this.lastTap = { s, t: now };
    }
    g.sfx?.play('click');
    // нумерация: быстрые клавиши обработаны отдельно
    if (s.type === 'trash') { this.cursor = null; this.refresh(); return; }
    if (s.type === 'creative') {
      if (this.cursor) { this.cursor = null; }
      else this.cursor = { id: s.stack.id, count: e.button === 2 ? 1 : (e.shiftKey ? maxStack(s.stack.id) : maxStack(s.stack.id)), dmg: 0 };
      this.refresh(); return;
    }
    if (s.type === 'result') { this.takeResult(e.shiftKey); return; }
    if (s.type === 'output') { this.takeOutput(s, e.shiftKey); return; }
    if (e.shiftKey && e.button === 0) { this.quickMove(s); return; }
    if (this.cursor && (s.type === 'normal' || s.type === 'armor')) {
      // возможное начало перетаскивания
      this.drag = { button: e.button, slots: [s], start: s };
      s.el.classList.add('drag');
      return;
    }
    this.clickSlot(s, e.button);
  }
  onUp(e) {
    if (!this.drag) return;
    const d = this.drag; this.drag = null;
    for (const s of d.slots) s.el.classList.remove('drag');
    if (!this.cursor) return;
    if (d.slots.length <= 1) { this.clickSlot(d.start, d.button); return; }
    const total = this.cursor.count;
    const per = d.button === 2 ? 1 : Math.max(1, Math.floor(total / d.slots.length));
    let left = total;
    for (const s of d.slots) {
      if (left <= 0) break;
      const cur = s.get(), ms = maxStack(this.cursor.id);
      const room = cur ? ms - cur.count : ms;
      const n = Math.min(per, room, left);
      if (n <= 0) continue;
      if (cur) cur.count += n; else s.set({ id: this.cursor.id, count: n, dmg: this.cursor.dmg || 0 });
      left -= n;
    }
    if (left <= 0) this.cursor = null; else this.cursor.count = left;
    this.refresh();
  }
  clickSlot(s, button) {
    const cur = s.get();
    if (s.type === 'armor' && this.cursor && !this.armorOk(s, this.cursor)) return;
    if (button === 0) {
      if (!this.cursor) { if (cur) { this.cursor = cur; s.set(null); } }
      else if (!cur) { s.set(this.cursor); this.cursor = null; }
      else if (this.stacksMerge(cur, this.cursor)) {
        const room = maxStack(cur.id) - cur.count, n = Math.min(room, this.cursor.count);
        cur.count += n; this.cursor.count -= n; if (this.cursor.count <= 0) this.cursor = null;
      } else { s.set(this.cursor); this.cursor = cur; }
    } else if (button === 2) {
      if (!this.cursor) { if (cur) { const n = Math.ceil(cur.count / 2); this.cursor = { id: cur.id, count: n, dmg: cur.dmg || 0 }; cur.count -= n; if (cur.count <= 0) s.set(null); } }
      else if (!cur) { s.set({ id: this.cursor.id, count: 1, dmg: this.cursor.dmg || 0 }); this.cursor.count--; if (this.cursor.count <= 0) this.cursor = null; }
      else if (this.stacksMerge(cur, this.cursor) && cur.count < maxStack(cur.id)) { cur.count++; this.cursor.count--; if (this.cursor.count <= 0) this.cursor = null; }
    }
    this.refresh();
  }
  takeResult(shift) {
    if (!this.result) return;
    const g = this.g;
    const doOne = () => {
      const m = matchRecipe(this.grid, this.gridN); if (!m) return false;
      const out = { id: m.id, count: m.count, dmg: 0 };
      if (shift) { if (!g.inventory.canAdd(out.id, out.count)) return false; g.inventory.add(out.id, out.count); }
      else {
        if (this.cursor) { if (!this.stacksMerge(this.cursor, out) || this.cursor.count + out.count > maxStack(out.id)) return false; this.cursor.count += out.count; }
        else this.cursor = out;
      }
      consumeGrid(this.grid); g.sfx?.play('craft'); return true;
    };
    if (shift) { let n = 0; while (n++ < 64 && doOne()); } else doOne();
    this.updateResult(); this.refresh();
  }
  takeOutput(s, shift) {
    const cur = s.get(); if (!cur) return;
    if (shift) { const left = this.g.inventory.add(cur.id, cur.count, cur.dmg || 0); if (left <= 0) s.set(null); else cur.count = left; }
    else if (!this.cursor) { this.cursor = cur; s.set(null); }
    else if (this.stacksMerge(this.cursor, cur) && this.cursor.count + cur.count <= maxStack(cur.id)) { this.cursor.count += cur.count; s.set(null); }
    this.refresh();
  }
  quickMove(s) {
    const g = this.g, inv = g.inventory, st = s.get();
    if (!st) return;
    const move = (stack, ranges, arr) => { // ranges: [[from,to]] в массиве arr
      let c = stack.count; const ms = maxStack(stack.id);
      for (const [a, b] of ranges) for (let i = a; i < b && c > 0; i++) { const t = arr[i]; if (t && this.stacksMerge(t, stack) && t.count < ms) { const n = Math.min(ms - t.count, c); t.count += n; c -= n; } }
      for (const [a, b] of ranges) for (let i = a; i < b && c > 0; i++) { if (!arr[i]) { const n = Math.min(ms, c); arr[i] = { id: stack.id, count: n, dmg: stack.dmg || 0 }; c -= n; } }
      return c;
    };
    let left = st.count;
    const fromInv = s.arr === inv.slots;
    if (fromInv) {
      const it = getItem(st.id);
      if (this.kind === 'inventory' && it.armor && !inv.armor[it.armor.slot]) { inv.armor[it.armor.slot] = Object.assign({}, st, { count: 1 }); st.count--; if (st.count <= 0) inv.slots[s.i] = null; this.refresh(); return; }
      if (this.kind === 'furnace') {
        const be = this.be;
        if (smeltResult(st.id) !== null && smeltResult(st.id) !== undefined) left = move({ ...st, count: left }, [[0, 1]], be.slots);
        else if (fuelTime(st.id) > 0) left = move({ ...st, count: left }, [[1, 2]], be.slots);
        else left = s.i < 9 ? move({ ...st, count: left }, [[9, 36]], inv.slots) : move({ ...st, count: left }, [[0, 9]], inv.slots);
      } else if (this.kind === 'chest') left = move({ ...st, count: left }, [[0, 27]], this.be.slots);
      else if (this.kind === 'creative') left = s.i < 9 ? left : left;
      else left = s.i < 9 ? move({ ...st, count: left }, [[9, 36]], inv.slots) : move({ ...st, count: left }, [[0, 9]], inv.slots);
    } else {
      // из контейнера/сетки/брони в инвентарь
      left = move({ ...st, count: left }, [[0, 9], [9, 36]], inv.slots);
    }
    if (left <= 0) s.set(null); else st.count = left;
    this.updateResult(); this.refresh();
  }
  keyNumber(n) { // горячая клавиша 1..9 над слотом: обмен с хотбаром
    const s = this.hover; if (!s || !s.arr || s.type === 'result') return;
    const inv = this.g.inventory; const hb = inv.slots[n]; const cur = s.get();
    if (s.type === 'armor' && hb && !this.armorOk(s, hb)) return;
    inv.slots[n] = cur; s.set(hb); this.updateResult(); this.refresh();
  }

  updateResult() {
    if (!this.gridN) { this.result = null; return; }
    const m = matchRecipe(this.grid, this.gridN);
    this.result = m ? { id: m.id, count: m.count, dmg: 0 } : null;
  }
  // ---------- отрисовка ----------
  paint(s) {
    const st = s.get ? s.get() : null, el = s.el;
    const im = el.querySelector('.ic'), cn = el.querySelector('.cnt'), du = el.querySelector('.dur');
    if (st) {
      im.src = itemIconUrl(st.id); im.style.visibility = 'visible'; cn.textContent = st.count > 1 ? st.count : '';
      const it = getItem(st.id);
      if (it && it.dur && st.dmg > 0) { du.style.display = 'block'; const f = 1 - st.dmg / it.dur; du.firstChild.style.width = (f * 100) + '%'; du.firstChild.style.background = f > 0.5 ? '#4cd04c' : f > 0.25 ? '#e0c030' : '#d03030'; } else du.style.display = 'none';
    } else { im.style.visibility = 'hidden'; cn.textContent = ''; du.style.display = 'none'; }
  }
  refresh() {
    if (!this.open_) return;
    this.updateResult();
    for (const s of this.slots) this.paint(s);
    const c = this.cursor;
    if (c) { const im = this.cursorEl.querySelector('.ic'); im.src = itemIconUrl(c.id); this.cursorEl.querySelector('.cnt').textContent = c.count > 1 ? c.count : ''; this.cursorEl.classList.remove('hidden'); }
    else this.cursorEl.classList.add('hidden');
    this.moveCursor();
    if (this.hover) this.showTip(this.hover);
    this.g.hud && (this.g.hud.sig = '');
  }
  update(dt) {
    if (!this.open_) return;
    if (this.kind === 'furnace' && this.be) {
      const be = this.be;
      this.flame.style.setProperty('--f', be.burnMax > 0 ? Math.max(0, be.burn / be.burnMax) : 0);
      this.flame.classList.toggle('lit', be.burn > 0);
      this.progress.firstChild.style.width = (be.cook / SMELT_TIME * 100) + '%';
      for (const s of this.slots) this.paint(s);
    }
    if (this.kind === 'chest') { /* статично */ }
  }
}
