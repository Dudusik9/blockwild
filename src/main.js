// Точка входа Blockwild
import { Game } from './game/game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__bw = game;
import('./world/blocks.js').then((m) => { window.__B = m.B; window.__BLOCKS = m.BLOCKS; });
const q = new URLSearchParams(location.search);
if (q.get('autostart')) {
  game.controls.forced = q.get('force') === '1';
  game.startWorld({ id: q.get('save') ? 'w_test' : 'test', name: 'Тест', seed: parseInt(q.get('seed') || '12345', 10), mode: q.get('mode') || 'survival', worldType: q.get('world') || undefined, cityVer: parseInt(q.get('cityver') || '2', 10) });
}
window.addEventListener('error', (e) => console.error('window error', e.message));
