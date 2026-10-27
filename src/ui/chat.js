// Чат: сообщения, ввод, история, подсказки
import { runCommand } from '../game/commands.js';

export class Chat {
  constructor(game) {
    this.g = game;
    this.box = document.getElementById('chat');
    this.box.innerHTML = '<input id="chat-input" type="text" maxlength="200" autocomplete="off" spellcheck="false">';
    this.input = this.box.firstChild;
    this.logEl = null; this.msgs = []; this.history = []; this.hi = -1; this.openFlag = false;
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') { this.submit(); }
      else if (e.code === 'Escape') { this.close(); }
      else if (e.code === 'ArrowUp') { if (this.history.length) { this.hi = Math.min(this.history.length - 1, this.hi + 1); this.input.value = this.history[this.history.length - 1 - this.hi]; } e.preventDefault(); }
      else if (e.code === 'ArrowDown') { this.hi = Math.max(-1, this.hi - 1); this.input.value = this.hi < 0 ? '' : this.history[this.history.length - 1 - this.hi]; e.preventDefault(); }
      else if (e.code === 'Tab') {
        e.preventDefault();
        const cmds = ['help', 'time', 'tp', 'gamemode', 'give', 'weather', 'seed', 'kill', 'heal', 'clear', 'spawn', 'setspawn', 'items', 'biome'];
        const v = this.input.value;
        if (v.startsWith('/') && !v.includes(' ')) { const m = cmds.filter((c) => c.startsWith(v.slice(1))); if (m.length === 1) this.input.value = '/' + m[0] + ' '; }
      }
    });
    this.input.addEventListener('keyup', (e) => e.stopPropagation());
  }
  attach() { this.logEl = document.getElementById('chat-log'); this.render(); }
  get isOpen() { return this.openFlag; }
  open(prefill = '') {
    this.openFlag = true; this.box.classList.remove('hidden'); this.input.value = prefill; this.hi = -1;
    this.g.controls.unlock();
    setTimeout(() => this.input.focus(), 0);
    this.showAll = true; this.render();
  }
  close() {
    this.openFlag = false; this.box.classList.add('hidden'); this.input.blur(); this.showAll = false; this.render();
    this.g.afterChatClose();
  }
  submit() {
    const v = this.input.value.trim();
    if (v) { this.history.push(v); if (v[0] === '/') { try { runCommand(this.g, v); } catch (e) { this.log('Ошибка команды: ' + e.message, '#ff7a7a'); console.error(e); } } else this.log('<' + (this.g.meta?.playerName || 'Игрок') + '> ' + v); }
    this.close();
  }
  log(text, color) {
    this.msgs.push({ text, color: color || '#ffffff', t: performance.now() });
    if (this.msgs.length > 100) this.msgs.shift();
    this.render();
  }
  render() {
    if (!this.logEl) return;
    const now = performance.now();
    const list = this.showAll ? this.msgs.slice(-14) : this.msgs.filter((m) => now - m.t < 7000).slice(-6);
    this.logEl.innerHTML = '';
    for (const m of list) {
      const d = document.createElement('div'); d.className = 'chat-line'; d.textContent = m.text; d.style.color = m.color;
      if (!this.showAll) d.style.opacity = Math.max(0, Math.min(1, (7000 - (now - m.t)) / 1500));
      this.logEl.appendChild(d);
    }
  }
  update() { if (!this.showAll && this.msgs.length && performance.now() - this.msgs[this.msgs.length - 1].t < 8000 || this.dirty) this.render(); }
}
