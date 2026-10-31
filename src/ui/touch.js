// Сенсорное управление: джойстик, осмотр перетаскиванием, тап = поставить, удержание = ломать, кнопки
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class TouchControls {
  constructor(game) {
    this.g = game; const c = game.controls;
    this.root = h('div', 'touch hidden'); document.getElementById('ui-root').appendChild(this.root);
    this.layer = h('div', 'touch-layer'); this.root.appendChild(this.layer);
    this.joy = h('div', 'joy hidden', '<div class="knob"></div>'); this.root.appendChild(this.joy);
    this.knob = this.joy.firstChild;
    const mk = (cls, label, fn, hold) => {
      const b = h('div', 'tbtn ' + cls, label);
      if (hold) {
        b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); hold(true); }, { passive: false });
        const end = (e) => { e.preventDefault(); e.stopPropagation(); b.classList.remove('on'); hold(false); };
        b.addEventListener('touchend', end, { passive: false }); b.addEventListener('touchcancel', end, { passive: false });
      } else {
        b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); }, { passive: false });
        b.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.remove('on'); fn(); }, { passive: false });
        b.addEventListener('click', (e) => { e.preventDefault(); });
      }
      this.root.appendChild(b); return b;
    };
    this.bJump = mk('jump', '⤒', null, (d) => { if (d) c.keys.add('Space'); else c.keys.delete('Space'); });
    this.sneakOn = false;
    this.bSneak = mk('sneak', '⤓', () => {
      if (game.player?.riding) { c.keys.add('ShiftLeft'); setTimeout(() => { if (!this.sneakOn) c.keys.delete('ShiftLeft'); }, 150); return; } // за рулём — просто «выйти»
      this.sneakOn = !this.sneakOn; this.bSneak.classList.toggle('latch', this.sneakOn); if (this.sneakOn) c.keys.add('ShiftLeft'); else c.keys.delete('ShiftLeft');
    });
    mk('inv', '🎒', () => { if (game.uiOpen) game.closeUI(); else if (game.state === 'playing') game.openUI('inventory'); });
    mk('chat', '💬', () => { if (game.state === 'playing' && !game.uiOpen) game.openChat(''); });
    mk('pause', '⏸', () => game.pause());
    this.bRobot = mk('robot hidden', '🤖', () => { if (game.state === 'playing' && !game.uiOpen) game.transformCar(); });
    // полупрозрачные стикеры-подсказки: где джойстик, что делает касание справа, как выйти из машинки
    this.ghost = h('div', 'stk ghost-joy', '<div class="gk"></div><b class="ga u">▲</b><b class="ga d">▼</b><b class="ga l">◀</b><b class="ga r">▶</b>');
    this.hintR = h('div', 'stk stk-right', '<div><span>👆</span><small>🧱</small></div><div><span>✊</span><small>⛏️</small></div>');
    this.hintExit = h('div', 'stk stk-exit hidden', '🚗⤵');
    for (const e of [this.ghost, this.hintR, this.hintExit]) this.root.appendChild(e);
    this.setHints(!!game.settings.controlHints);
    this.bFs = mk('fs', '⛶', () => this.fullscreen());
    if (!document.documentElement.requestFullscreen && !document.documentElement.webkitRequestFullscreen) this.bFs.classList.add('hidden');
    this.hint = h('div', 'rotate-hint', '<div>📱↻<br>Для удобной игры поверните устройство горизонтально<br><small>(нажмите, чтобы скрыть)</small></div>');
    this.hint.classList.add('gone');
    this.hint.addEventListener('click', () => this.hint.classList.add('gone'));
    document.getElementById('ui-root').appendChild(this.hint);
    // жесты и меню браузера
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.scroll, .world-list, .crgrid, .inv-panel')) e.preventDefault(); }, { passive: false });
    this.look = null; this.joyT = null;
    const L = this.layer;
    L.addEventListener('touchstart', (e) => this.start(e), { passive: false });
    L.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    L.addEventListener('touchend', (e) => this.end(e), { passive: false });
    L.addEventListener('touchcancel', (e) => this.end(e), { passive: false });
    this.dirKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
  }
  show(v) {
    this.root.classList.toggle('hidden', !v); if (!v) this.releaseAll();
    if (v && !this.hintShown) { this.hintShown = true; this.hint.classList.remove('gone'); setTimeout(() => this.hint.classList.add('gone'), 4500); }
  }
  setRobotVisible(v) { this.bRobot.classList.toggle('hidden', !v); }
  setRiding(v) { this.hintExit.classList.toggle('hidden', !v); }
  unlatchSneak() { this.sneakOn = false; this.bSneak.classList.remove('latch'); this.g.controls.keys.delete('ShiftLeft'); }
  setHints(v) { this.root.classList.toggle('nohints', !v); }
  setUIMode(on, menu) { this.root.classList.toggle('uimode', !!on); if (on) this.releaseAll(); if (menu) this.root.classList.toggle('hidden', !!on); else if (!on && this.g.state === 'playing') this.root.classList.remove('hidden'); }
  releaseAll() {
    const c = this.g.controls; for (const k of this.dirKeys) c.keys.delete(k); c.keys.delete('Space'); c.mouse[0] = false; c.mouse[2] = false; c.sprintToggle = false;
    this.joy.classList.add('hidden'); this.ghost.classList.remove('hidden'); this.look = null; this.joyT = null;
  }
  fullscreen() {
    const d = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
      else { const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ок */ } }).catch(() => {}); }
    } catch (e) { /* ок */ }
  }
  start(e) {
    e.preventDefault();
    const g = this.g, c = g.controls, W = window.innerWidth;
    for (const t of e.changedTouches) {
      if (t.clientX < W * 0.42 && this.joyT === null) {
        this.joyT = { id: t.identifier, x: t.clientX, y: t.clientY };
        this.joy.style.left = t.clientX + 'px'; this.joy.style.top = t.clientY + 'px'; this.joy.classList.remove('hidden'); this.knob.style.transform = 'translate(0,0)';
        this.ghost.classList.add('hidden');
      } else if (this.look === null) {
        this.look = { id: t.identifier, x: t.clientX, y: t.clientY, t0: performance.now(), moved: false, hold: false };
        this.look.timer = setTimeout(() => { if (this.look && !this.look.moved) { this.look.hold = true; c.mouse[0] = true; c.mousePressed[0] = true; } }, 320);
      }
    }
  }
  move(e) {
    e.preventDefault();
    const c = this.g.controls;
    for (const t of e.changedTouches) {
      if (this.joyT && t.identifier === this.joyT.id) {
        const R = 55; let dx = t.clientX - this.joyT.x, dy = t.clientY - this.joyT.y; const d = Math.hypot(dx, dy);
        const k = d > R ? R / d : 1; this.knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
        const nx = dx / R, ny = dy / R, th = 0.3;
        const set = (code, on) => { if (on) c.keys.add(code); else c.keys.delete(code); };
        set('KeyW', ny < -th); set('KeyS', ny > th); set('KeyA', nx < -th); set('KeyD', nx > th);
        c.sprintToggle = ny < -0.95 * 1.0 && d > R * 0.98;
      } else if (this.look && t.identifier === this.look.id) {
        const L = this.look, dx = t.clientX - L.x, dy = t.clientY - L.y;
        if (!L.moved && Math.hypot(t.clientX - L.x, t.clientY - L.y) > 12 && !L.hold) { L.moved = true; clearTimeout(L.timer); }
        if (L.moved || L.hold) { c.dx += dx; c.dy += dy; L.x = t.clientX; L.y = t.clientY; }
      }
    }
  }
  end(e) {
    e.preventDefault();
    const c = this.g.controls;
    for (const t of e.changedTouches) {
      if (this.joyT && t.identifier === this.joyT.id) {
        for (const k of this.dirKeys) c.keys.delete(k); c.sprintToggle = false; this.joyT = null; this.joy.classList.add('hidden'); this.ghost.classList.remove('hidden');
      } else if (this.look && t.identifier === this.look.id) {
        const L = this.look; clearTimeout(L.timer); this.look = null;
        if (L.hold) c.mouse[0] = false;
        else if (!L.moved && performance.now() - L.t0 < 320) { c.mouse[2] = true; c.mousePressed[2] = true; setTimeout(() => { c.mouse[2] = false; }, 130); }
      }
    }
  }
}
