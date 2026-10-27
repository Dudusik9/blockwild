// HUD: прицел, хотбар, сердца, голод, броня, кислород, названия, эффекты урона
import { itemIconUrl } from './icons.js';
import { getItem } from '../game/items.js';

function px(w, h, draw, scale = 2) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x);
  return c.toDataURL();
}
const HEART = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
function heart(kind) { // full | half | empty
  return px(9, 9, (x) => {
    for (let y = 0; y < HEART.length; y++) for (let i = 0; i < 9; i++) {
      if (HEART[y][i] !== 'X') continue;
      const left = i < 4.5;
      let fill = '#d02828';
      if (kind === 'empty' || (kind === 'half' && !left)) fill = '#3a2424';
      if (kind !== 'empty' && y === 1 && (i === 1 || i === 2) && !(kind === 'half' && !left)) fill = '#ff8c8c';
      x.fillStyle = fill; x.fillRect(i, y, 1, 1);
    }
    // контур
    x.fillStyle = '#1e0808';
    for (let y = 0; y < 9; y++) for (let i = 0; i < 9; i++) {
      if (HEART[y] && HEART[y][i] === 'X') continue;
      const n = (a, b) => HEART[y + b] && HEART[y + b][i + a] === 'X';
      if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) x.fillRect(i, y, 1, 1);
    }
  });
}
function food(kind) {
  return px(9, 9, (x) => {
    const full = kind === 'full', half = kind === 'half';
    const body = (cx, cy, r, col) => { x.fillStyle = col; for (let y = 0; y < 9; y++) for (let i = 0; i < 9; i++) if ((i - cx) ** 2 + (y - cy) ** 2 <= r * r) x.fillRect(i, y, 1, 1); };
    x.fillStyle = '#1e1008';
    body(5.2, 3.2, 3.6, '#1e1008');
    const colr = (i) => (kind === 'empty' || (half && i > 4) ? '#3a3028' : '#c0702c');
    for (let y = 0; y < 9; y++) for (let i = 0; i < 9; i++) if ((i - 5.2) ** 2 + (y - 3.2) ** 2 <= 2.6 * 2.6) { x.fillStyle = colr(i); x.fillRect(i, y, 1, 1); }
    if (!(kind === 'empty')) { x.fillStyle = '#e8a05c'; x.fillRect(5, 2, 2, 1); }
    x.fillStyle = '#1e1008'; x.fillRect(1, 6, 1, 1); x.fillRect(2, 5, 1, 1); x.fillRect(3, 4, 1, 1); x.fillRect(0, 7, 2, 1); x.fillRect(1, 8, 1, 1); x.fillRect(0, 8, 1, 1);
    x.fillStyle = '#ece4cc'; x.fillRect(1, 7, 1, 1); x.fillRect(2, 6, 1, 1); x.fillRect(3, 5, 1, 1);
  });
}
function armorIcon(kind) {
  return px(9, 9, (x) => {
    const col = kind === 'full' ? '#cfd6e0' : kind === 'half' ? '#8b94a0' : '#3a3d44';
    x.fillStyle = '#16181c';
    const rows = ['XX.....XX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '...XXX...'];
    for (let y = 0; y < rows.length; y++) for (let i = 0; i < 9; i++) if (rows[y][i] === 'X') { x.fillStyle = col; x.fillRect(i, y, 1, 1); }
    if (kind !== 'empty') { x.fillStyle = '#fff'; x.fillRect(2, 2, 2, 1); }
  });
}
function bubble(full) {
  return px(9, 9, (x) => {
    x.fillStyle = full ? '#7fc4ff' : '#294660';
    for (let y = 0; y < 9; y++) for (let i = 0; i < 9; i++) { const d = (i - 4) ** 2 + (y - 4) ** 2; if (d <= 12) { x.fillStyle = d > 8 ? '#183a66' : (full ? '#9bd6ff' : '#2a4c6c'); x.fillRect(i, y, 1, 1); } }
    if (full) { x.fillStyle = '#fff'; x.fillRect(3, 2, 1, 1); x.fillRect(2, 3, 1, 1); }
  });
}

export class HUD {
  constructor(game, root) {
    this.g = game; this.root = root;
    this.icons = { heart: { full: heart('full'), half: heart('half'), empty: heart('empty') }, food: { full: food('full'), half: food('half'), empty: food('empty') }, armor: { full: armorIcon('full'), half: armorIcon('half'), empty: armorIcon('empty') }, bubble: { full: bubble(true), empty: bubble(false) } };
    root.innerHTML = `
      <div id="crosshair"></div>
      <div id="hud-bottom">
        <div id="hud-name"></div>
        <div id="stats">
          <div class="row"><div id="armor-row" class="icons"></div><div id="air-row" class="icons right"></div></div>
          <div class="row"><div id="hearts" class="icons"></div><div id="foods" class="icons right"></div></div>
        </div>
        <div id="hotbar"></div>
      </div>
      <div id="chat-log"></div>`;
    this.hotbar = root.querySelector('#hotbar'); this.hearts = root.querySelector('#hearts'); this.foods = root.querySelector('#foods');
    this.armorRow = root.querySelector('#armor-row'); this.airRow = root.querySelector('#air-row'); this.nameEl = root.querySelector('#hud-name');
    this.slots = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div'); s.className = 'slot hb';
      s.innerHTML = '<img class="ic" draggable="false"><span class="cnt"></span><div class="dur"><i></i></div>';
      const idx = i; s.addEventListener('pointerdown', (e) => { if (this.g.state === 'playing' && !this.g.uiOpen) { this.g.inventory.selected = idx; e.stopPropagation(); } });
      this.hotbar.appendChild(s); this.slots.push(s);
    }
    this.mk(this.hearts, 10); this.mk(this.foods, 10); this.mk(this.armorRow, 10); this.mk(this.airRow, 10);
    this.sig = ''; this.nameT = 0; this.lastSel = -1; this.fxEl = document.getElementById('overlay-fx');
    this.fxEl.innerHTML = '<div id="fx-hurt"></div><div id="fx-water"></div><div id="fx-fire"></div><div id="fx-dark"></div>';
    this.fxHurt = this.fxEl.querySelector('#fx-hurt'); this.fxWater = this.fxEl.querySelector('#fx-water'); this.fxFire = this.fxEl.querySelector('#fx-fire'); this.fxDark = this.fxEl.querySelector('#fx-dark');
    this.statSig = '';
  }
  mk(el, n) { for (let i = 0; i < n; i++) { const im = document.createElement('img'); im.draggable = false; el.appendChild(im); } }
  show(v) { this.root.classList.toggle('hidden', !v); }
  update(dt) {
    const g = this.g, inv = g.inventory, s = g.survival, p = g.player;
    // хотбар
    let sig = inv.selected + '|';
    for (let i = 0; i < 9; i++) { const st = inv.slots[i]; sig += st ? st.id + ':' + st.count + ':' + (st.dmg || 0) : '-'; sig += ','; }
    if (sig !== this.sig) {
      this.sig = sig;
      for (let i = 0; i < 9; i++) {
        const st = inv.slots[i], el = this.slots[i];
        el.classList.toggle('sel', i === inv.selected);
        const im = el.querySelector('.ic'), cn = el.querySelector('.cnt'), du = el.querySelector('.dur');
        if (st) { im.src = itemIconUrl(st.id); im.style.visibility = 'visible'; cn.textContent = st.count > 1 ? st.count : ''; const it = getItem(st.id); if (it && it.dur && st.dmg > 0) { du.style.display = 'block'; const f = 1 - st.dmg / it.dur; du.firstChild.style.width = (f * 100) + '%'; du.firstChild.style.background = f > 0.5 ? '#4cd04c' : f > 0.25 ? '#e0c030' : '#d03030'; } else du.style.display = 'none'; }
        else { im.style.visibility = 'hidden'; cn.textContent = ''; du.style.display = 'none'; }
      }
      if (inv.selected !== this.lastSel) {
        this.lastSel = inv.selected; const st = inv.slots[inv.selected];
        this.nameEl.textContent = st ? (getItem(st.id) || {}).title || '' : ''; this.nameT = 2.2;
      }
    }
    if (this.nameT > 0) { this.nameT -= dt; this.nameEl.style.opacity = Math.min(1, this.nameT); }
    // статы
    const creative = p.creative;
    const stats = this.root.querySelector('#stats'); stats.style.display = creative ? 'none' : 'block';
    if (!creative) {
      const hp = Math.ceil(s.health), fd = s.food, ar = s.armorPoints, air = s.air;
      const sg = hp + ':' + fd + ':' + ar + ':' + (p.headInWater ? Math.ceil(air / 30) : -1) + ':' + (s.hurtT > 0 ? 1 : 0);
      if (sg !== this.statSig) {
        this.statSig = sg;
        const set = (el, n, val, icons, shake) => { for (let i = 0; i < n; i++) { const im = el.children[i]; const v = val - i * 2; im.src = v >= 2 ? icons.full : v === 1 ? icons.half : icons.empty; } };
        set(this.hearts, 10, hp, this.icons.heart);
        // справа налево заполняется голод
        for (let i = 0; i < 10; i++) { const v = fd - (9 - i) * 2; this.foods.children[i].src = v >= 2 ? this.icons.food.full : v === 1 ? this.icons.food.half : this.icons.food.empty; }
        for (let i = 0; i < 10; i++) { const v = ar - i * 2; this.armorRow.children[i].src = v >= 2 ? this.icons.armor.full : v === 1 ? this.icons.armor.half : this.icons.armor.empty; this.armorRow.children[i].style.visibility = ar > 0 ? 'visible' : 'hidden'; }
        const nb = Math.ceil(air / 30);
        for (let i = 0; i < 10; i++) { const im = this.airRow.children[i]; im.src = (9 - i) < nb ? this.icons.bubble.full : this.icons.bubble.empty; im.style.visibility = p.headInWater || air < 300 ? 'visible' : 'hidden'; }
      }
      this.hearts.classList.toggle('low', s.health <= 4);
    }
    // эффекты
    this.fxHurt.style.opacity = s.hurtT > 0 ? Math.min(0.6, s.hurtT * 1.6) : 0;
    this.fxWater.style.opacity = p.headInWater ? 0.5 : 0;
    this.fxFire.style.opacity = s.burn > 0 ? 0.35 : 0;
    this.fxDark.style.opacity = s.dead ? 0.7 : 0;
  }
}
