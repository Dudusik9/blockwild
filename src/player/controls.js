// Ввод: клавиатура, мышь, Pointer Lock
export class Controls {
  constructor(canvas, settings) {
    this.canvas = canvas; this.settings = settings;
    this.keys = new Set(); this.pressed = new Set();
    this.mouse = [false, false, false]; this.mousePressed = [false, false, false];
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.locked = false; this.enabled = false; // enabled — игра в режиме управления
    this.forced = false; // для автотестов: принимать ввод без pointer lock
    this.onLockChange = null; this.onKey = null;
    this.sprintToggle = false; this.lastW = -10;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.active()) return;
      this.dx += e.movementX || 0; this.dy += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active()) { if (this.enabled && !this.locked) this.lock(); return; }
      this.mouse[e.button] = true; this.mousePressed[e.button] = true; e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => { this.mouse[e.button] = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.active()) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (this.active() && ['Tab', 'F5', 'F3', 'F1', 'F2'].includes(e.code)) e.preventDefault(); return; }
      if (this.onKey && this.onKey(e) === true) { e.preventDefault(); return; }
      if (!this.active()) return;
      if (['Space', 'Tab', 'F1', 'F2', 'F3', 'F5', 'ControlLeft', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyW') { const n = performance.now() / 1000; if (n - this.lastW < 0.28) this.sprintToggle = true; this.lastW = n; }
      this.keys.add(e.code); this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'KeyW') this.sprintToggle = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse = [false, false, false]; });
  }
  active() { return this.enabled && (this.locked || this.forced || this.touch); }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* игнор */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  isDown(c) { return this.keys.has(c); }
  wasPressed(c) { return this.pressed.has(c); }
  endFrame() { this.pressed.clear(); this.mousePressed[0] = this.mousePressed[1] = this.mousePressed[2] = false; this.dx = 0; this.dy = 0; this.wheel = 0; }
  input() {
    const k = this.keys;
    return {
      forward: k.has('KeyW') || k.has('ArrowUp'), back: k.has('KeyS') || k.has('ArrowDown'), left: k.has('KeyA'), right: k.has('KeyD'),
      jump: k.has('Space'), sneak: k.has('ShiftLeft') || k.has('ShiftRight'), sprint: k.has('ControlLeft') || this.sprintToggle,
    };
  }
}
