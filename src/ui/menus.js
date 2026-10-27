// Меню: главное, миры, настройки, пауза, смерть, управление, загрузка
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

const FONT = {
  B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'], L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'], C: ['.XXXX', 'X....', 'X....', 'X....', 'X....', 'X....', '.XXXX'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'], W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'], D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
};
function logo() {
  const word = 'BLOCKWILD', S = 6, gap = 1;
  const c = document.createElement('canvas'); c.className = 'logo';
  c.width = (5 + gap) * word.length * S; c.height = 7 * S + 8;
  const x = c.getContext('2d');
  [...word].forEach((ch, i) => {
    FONT[ch].forEach((row, y) => [...row].forEach((v, xx) => {
      if (v !== 'X') return;
      const px = (i * (5 + gap) + xx) * S, py = y * S;
      x.fillStyle = '#1a2a14'; x.fillRect(px + 2, py + 4, S, S);
      const g = x.createLinearGradient(0, py, 0, py + S); const t = y / 7;
      x.fillStyle = `rgb(${Math.round(120 + 40 * (1 - t))},${Math.round(200 - 40 * t)},${Math.round(80 - 20 * t)})`; x.fillRect(px, py, S, S);
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(px, py, S, 2); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + S - 2, S, 2);
    }));
  });
  return c;
}

export class Menus {
  constructor(game, root) {
    this.g = game; this.root = root; this.cur = null; this.toastEl = document.getElementById('toast'); this.toastT = null;
    this.back = 'main';
  }
  clear() { if (this.cur) { this.cur.remove(); this.cur = null; } }
  hide() { this.clear(); this.g.touch?.setUIMode(false, true); }
  toast(t, ms = 2800) { this.toastEl.textContent = t; this.toastEl.classList.add('on'); clearTimeout(this.toastT); this.toastT = setTimeout(() => this.toastEl.classList.remove('on'), ms); }
  btn(label, fn, cls) { const b = h('button', 'btn' + (cls ? ' ' + cls : ''), label); b.onclick = (e) => { this.g.sfx.resume(); this.g.sfx.play('click'); fn(e); }; return b; }
  screen(cls) { this.clear(); const s = h('div', 'menu-screen ' + (cls || '')); this.root.appendChild(s); this.cur = s; return s; }

  show(name, arg) {
    const g = this.g;
    g.touch?.setUIMode(true, true);
    switch (name) {
      case 'main': return this.main();
      case 'worlds': return this.worlds();
      case 'new': return this.newWorld();
      case 'settings': return this.settings(arg);
      case 'pause': return this.pause();
      case 'death': return this.death(arg);
      case 'help': return this.help(arg);
    }
  }
  main() {
    const s = this.screen('main');
    s.appendChild(logo());
    s.appendChild(h('div', 'tagline', 'Кубическая песочница выживания'));
    const col = h('div', 'btn-col');
    col.appendChild(this.btn('Играть', () => this.worlds()));
    col.appendChild(this.btn('Настройки', () => this.settings('main')));
    col.appendChild(this.btn('Управление', () => this.help('main')));
    s.appendChild(col);
    s.appendChild(h('div', 'foot', 'Blockwild · оригинальная воксельная игра · v1.0'));
  }
  async worlds() {
    const s = this.screen('worlds'); const g = this.g;
    s.appendChild(h('h2', '', 'Выбор мира'));
    const list = h('div', 'world-list'); s.appendChild(list);
    list.appendChild(h('div', 'dim', 'Загрузка…'));
    const bar = h('div', 'btn-row');
    bar.appendChild(this.btn('Создать новый мир', () => this.newWorld(), 'green'));
    bar.appendChild(this.btn('Назад', () => this.main()));
    s.appendChild(bar);
    let worlds = [];
    try { await g.storage.open(); worlds = await g.storage.listWorlds(); } catch (e) { list.innerHTML = '<div class="dim">Хранилище недоступно (IndexedDB): сохранения отключены.</div>'; return; }
    list.innerHTML = '';
    if (!worlds.length) list.appendChild(h('div', 'dim', 'Миров пока нет. Создайте первый!'));
    for (const w of worlds) {
      const row = h('div', 'world-row');
      const d = new Date(w.lastPlayed || w.created);
      row.appendChild(h('div', 'wname', `<b>${w.name.replace(/</g, '&lt;')}</b><br><span class="dim">seed ${w.seed} · ${w.mode === 'creative' ? 'творческий' : 'выживание'} · ${d.toLocaleString('ru-RU')}</span>`));
      const b = h('div', 'wbtn');
      b.appendChild(this.btn('Играть', () => g.startWorld(w), 'green'));
      b.appendChild(this.btn('Удалить', async () => { if (confirm('Удалить мир «' + w.name + '»?')) { await g.storage.deleteWorld(w.id); this.worlds(); } }, 'red'));
      row.appendChild(b); list.appendChild(row);
    }
  }
  newWorld() {
    const s = this.screen('new'); const g = this.g;
    s.appendChild(h('h2', '', 'Новый мир'));
    const f = h('div', 'form');
    f.innerHTML = `<label>Название<input id="nw-name" value="Мир ${Math.floor(Math.random() * 900 + 100)}" maxlength="30"></label>
      <label>Seed (пусто — случайный)<input id="nw-seed" placeholder="например 12345 или любой текст"></label>
      <label>Режим<select id="nw-mode"><option value="survival">Выживание</option><option value="creative">Творческий</option></select></label>`;
    s.appendChild(f);
    f.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    const bar = h('div', 'btn-row');
    bar.appendChild(this.btn('Создать', async () => {
      const name = f.querySelector('#nw-name').value.trim() || 'Мир';
      const st = f.querySelector('#nw-seed').value.trim();
      const { seedFromString } = await import('../core/noise.js');
      const seed = st ? seedFromString(st) : Math.floor(Math.random() * 2147483647) - 1073741824;
      const mode = f.querySelector('#nw-mode').value;
      const meta = { id: 'w' + Date.now().toString(36), name, seed, mode, created: Date.now(), lastPlayed: Date.now() };
      try { await g.storage.open(); await g.storage.saveWorld(meta); } catch (e) { /* без сохранений */ }
      g.startWorld(meta);
    }, 'green'));
    bar.appendChild(this.btn('Назад', () => this.worlds()));
    s.appendChild(bar);
  }
  settings(back) {
    this.back = back || this.back;
    const s = this.screen('settings'); const g = this.g, st = g.settings;
    s.appendChild(h('h2', '', 'Настройки'));
    const f = h('div', 'form scroll'); s.appendChild(f);
    const slider = (label, key, min, max, step, fmt, onch) => {
      const l = h('label', '', ''); const v = h('span', 'val', fmt(st[key])); l.appendChild(document.createTextNode(label + ': ')); l.appendChild(v);
      const i = h('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = st[key];
      i.oninput = () => { st[key] = parseFloat(i.value); v.textContent = fmt(st[key]); if (onch) onch(); g.saveSettings(); };
      i.onchange = () => { g.applySettings(); };
      i.addEventListener('keydown', (e) => e.stopPropagation()); l.appendChild(i); f.appendChild(l);
    };
    const toggle = (label, key) => {
      const l = h('label', 'tog', ''); const b = this.btn('', () => { st[key] = !st[key]; b.textContent = st[key] ? 'Вкл' : 'Выкл'; g.applySettings(); }, 'small');
      b.textContent = st[key] ? 'Вкл' : 'Выкл'; l.appendChild(document.createTextNode(label)); l.appendChild(b); f.appendChild(l);
    };
    slider('Дальность прорисовки', 'renderDistance', 4, 16, 1, (v) => v + ' чанк.');
    slider('Поле зрения (FOV)', 'fov', 50, 110, 1, (v) => v + '°', () => { g.camera.fov = st.fov; g.fovCur = st.fov; g.camera.updateProjectionMatrix(); });
    slider('Чувствительность', 'sensitivity', 0.2, 3, 0.1, (v) => v.toFixed(1));
    slider('Громкость', 'masterVolume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%', () => g.sfx.applyVolumes());
    slider('Музыка', 'musicVolume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%', () => g.sfx.applyVolumes());
    slider('Ограничение FPS (0 — без)', 'fpsLimit', 0, 120, 10, (v) => (v === 0 ? '∞' : v));
    slider('Разрешение (pixel ratio)', 'pixelRatio', 0.5, 2, 0.25, (v) => v.toFixed(2));
    toggle('Ambient occlusion', 'ao'); toggle('Плавное освещение', 'smoothLight'); toggle('Облака', 'clouds'); toggle('Частицы', 'particles'); toggle('Покачивание камеры', 'bobbing');
    const bar = h('div', 'btn-row'); bar.appendChild(this.btn('Готово', () => { g.applySettings(); this.show(this.back === 'pause' ? 'pause' : 'main'); })); s.appendChild(bar);
  }
  pause() {
    const s = this.screen('pause'); const g = this.g;
    s.appendChild(h('h2', '', 'Пауза'));
    const col = h('div', 'btn-col');
    col.appendChild(this.btn('Продолжить', () => g.resume(), 'green'));
    col.appendChild(this.btn('Настройки', () => this.settings('pause')));
    col.appendChild(this.btn('Управление', () => this.help('pause')));
    col.appendChild(this.btn('Сохранить и выйти в меню', () => g.exitToMenu(), 'red'));
    s.appendChild(col);
  }
  death(cause) {
    const s = this.screen('death'); const g = this.g;
    s.appendChild(h('h1', 'dead', 'Вы погибли'));
    s.appendChild(h('div', 'tagline', cause ? 'Причина: ' + cause : ''));
    const col = h('div', 'btn-col');
    col.appendChild(this.btn('Возродиться', () => g.respawn(), 'green'));
    col.appendChild(this.btn('В главное меню', () => g.exitToMenu()));
    s.appendChild(col);
  }
  help(back) {
    this.back = back || this.back;
    const s = this.screen('help');
    s.appendChild(h('h2', '', 'Управление'));
    const t = h('div', 'scroll helptext');
    t.innerHTML = this.g.isTouch ? `
      <p><b>Касания</b></p><ul>
      <li>Левый джойстик — движение (до упора вперёд — бег)</li>
      <li>Перетаскивание по правой части экрана — осмотр</li>
      <li>Короткое касание блока — поставить / использовать (верстак, печь, сундук, дверь)</li>
      <li>Касание с удержанием — ломать блок / бить моба</li>
      <li>Кнопки: ⤒ прыжок (двойное нажатие в творческом режиме — полёт), ⤓ красться, 🎒 инвентарь, 💬 чат и команды, ⏸ пауза, ⛶ полный экран</li>
      <li>Хотбар — касание по слоту; в инвентаре: касание — взять/положить, двойное касание — быстро переместить, кнопка «½» — брать половину / класть по одному</li></ul>` : `
      <p><b>Клавиатура и мышь</b></p><ul>
      <li>WASD — движение, Пробел — прыжок (двойной в творческом — полёт), Shift — красться, Ctrl или двойное W — бег</li>
      <li>ЛКМ — ломать / бить, ПКМ — поставить / использовать, СКМ — выбрать блок, колесо или 1–9 — хотбар</li>
      <li>E — инвентарь, Q — выбросить предмет (Ctrl — весь стак), T или / — чат и команды</li>
      <li>F1 — скрыть HUD, F2 — скриншот PNG, F3 — отладка, F5 — вид от 3-го лица, Esc — пауза</li></ul>`;
    s.appendChild(t);
    const bar = h('div', 'btn-row'); bar.appendChild(this.btn('Назад', () => this.show(this.back === 'pause' ? 'pause' : 'main'))); s.appendChild(bar);
  }
  showLoading(text) {
    const s = this.screen('loading'); s.appendChild(h('h2', '', text));
    this.lbar = h('div', 'lbar', '<i></i>'); s.appendChild(this.lbar);
    s.appendChild(h('div', 'tagline', 'Генерация рельефа, пещер и деревьев…'));
    this.g.touch?.setUIMode(true, true);
  }
  setLoadingProgress(f) { if (this.lbar && this.lbar.firstChild) this.lbar.firstChild.style.width = (f * 100) + '%'; }
}
