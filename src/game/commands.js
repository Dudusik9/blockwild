// Команды чата
import { I, ITEMS, ITEM_LIST } from './items.js';
import { BIOMES } from '../world/biomes.js';

const HELP = [
  ['/help', 'список команд'],
  ['/time set day|night|noon|midnight|<тики>', 'установить время (0 — рассвет, 6000 — полдень, 13000 — ночь)'],
  ['/time add <тики>', 'добавить время'],
  ['/tp <x> <y> <z>', 'телепорт (допускается ~ как относительная координата)'],
  ['/gamemode survival|creative', 'режим игры (s / c)'],
  ['/give <предмет> [число]', 'выдать предмет (например /give iron_pickaxe)'],
  ['/weather clear|rain|thunder', 'погода'],
  ['/seed', 'показать seed мира'],
  ['/kill', 'умереть'],
  ['/heal', 'вылечиться и наесться'],
  ['/clear', 'очистить инвентарь'],
  ['/spawn <моб> [число]', 'призвать моба: ram, hen, boar, swamper, archer, bomber'],
  ['/setspawn', 'точка возрождения здесь'],
  ['/items [фильтр]', 'список названий предметов'],
];

export function runCommand(g, line) {
  const parts = line.trim().replace(/^\//, '').split(/\s+/);
  const cmd = (parts.shift() || '').toLowerCase();
  const log = (t, c) => g.chat.log(t, c);
  const err = (t) => g.chat.log(t, '#ff7a7a');
  const p = g.player;
  switch (cmd) {
    case 'help': case '?': HELP.forEach(([a, b]) => log(`${a} — ${b}`, '#cfe8ff')); break;
    case 'time': {
      const sub = parts[0];
      if (sub === 'set') {
        const v = parts[1];
        const map = { day: 1000, morning: 0, noon: 6000, sunset: 12000, night: 13000, midnight: 18000 };
        let t = map[v] !== undefined ? map[v] : parseInt(v, 10);
        if (isNaN(t)) return err('Использование: /time set day|night|noon|midnight|<тики>');
        g.time = ((t % 24000) + 24000) % 24000; log('Время установлено: ' + Math.floor(g.time));
      } else if (sub === 'add') {
        const t = parseInt(parts[1], 10); if (isNaN(t)) return err('Использование: /time add <тики>');
        g.time += t; while (g.time >= 24000) { g.time -= 24000; g.day++; } log('Время: ' + Math.floor(g.time));
      } else log('Время: ' + Math.floor(g.time) + ', день ' + g.day);
      break;
    }
    case 'tp': case 'teleport': {
      if (parts.length < 3) return err('Использование: /tp <x> <y> <z>');
      const rel = (s, cur) => (s[0] === '~' ? cur + (s.length > 1 ? parseFloat(s.slice(1)) : 0) : parseFloat(s));
      const x = rel(parts[0], p.x), y = rel(parts[1], p.y), z = rel(parts[2], p.z);
      if ([x, y, z].some(isNaN)) return err('Неверные координаты');
      p.setPos(x, y, z); log(`Телепорт: ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`);
      break;
    }
    case 'gamemode': case 'gm': {
      const m = (parts[0] || '').toLowerCase();
      if (['survival', 's', '0', 'выживание'].includes(m)) { g.setGameMode('survival'); log('Режим: выживание'); }
      else if (['creative', 'c', '1', 'творческий'].includes(m)) { g.setGameMode('creative'); log('Режим: творческий'); }
      else err('Использование: /gamemode survival|creative');
      break;
    }
    case 'give': {
      const q = (parts[0] || '').toLowerCase(); if (!q) return err('Использование: /give <предмет> [число]');
      let it = ITEM_LIST.find((i) => i.name === q) || ITEM_LIST.find((i) => i.name.includes(q)) || ITEM_LIST.find((i) => i.title.toLowerCase().includes(q));
      if (!it) return err('Нет такого предмета: ' + q + '  (см. /items)');
      const n = Math.max(1, Math.min(2304, parseInt(parts[1] || '1', 10) || 1));
      const left = g.inventory.add(it.id, n);
      log(`Выдано: ${it.title} ×${n - left}`);
      break;
    }
    case 'weather': {
      const w = (parts[0] || '').toLowerCase();
      if (w === 'clear') { g.weather.set('clear'); log('Погода: ясно'); }
      else if (w === 'rain') { g.weather.set('rain'); log('Погода: дождь'); }
      else if (w === 'thunder') { g.weather.set('thunder'); log('Погода: гроза'); }
      else err('Использование: /weather clear|rain|thunder');
      break;
    }
    case 'seed': log('Seed: ' + g.meta.seed); break;
    case 'kill': g.survival.damage(1000, 'команда', null, true); if (p.creative) { g.survival.dead = false; g.survival.die('команда'); } break;
    case 'heal': g.survival.health = 20; g.survival.food = 20; g.survival.sat = 20; log('Вы здоровы'); break;
    case 'clear': g.inventory.clear(); log('Инвентарь очищен'); break;
    case 'setspawn': g.spawn = { x: p.x, y: p.y, z: p.z }; log('Точка возрождения установлена'); break;
    case 'spawn': {
      const kind = (parts[0] || '').toLowerCase(); const n = Math.max(1, Math.min(20, parseInt(parts[1] || '1', 10) || 1));
      if (!g.mobs.kinds[kind]) return err('Мобы: ' + Object.keys(g.mobs.kinds).join(', '));
      for (let i = 0; i < n; i++) g.mobs.spawnMob(kind, p.x + (Math.random() - 0.5) * 4 - Math.sin(p.yaw) * 3, p.y + 0.5, p.z + (Math.random() - 0.5) * 4 - Math.cos(p.yaw) * 3);
      log('Призван: ' + kind + ' ×' + n);
      break;
    }
    case 'items': {
      const f = (parts[0] || '').toLowerCase();
      log(ITEM_LIST.filter((i) => !f || i.name.includes(f) || i.title.toLowerCase().includes(f)).map((i) => i.name).join(', ').slice(0, 900), '#dddddd');
      break;
    }
    case 'biome': { const b = BIOMES[g.world.getBiome(Math.floor(p.x), Math.floor(p.z))]; log('Биом: ' + b.name); break; }
    default: err('Неизвестная команда: /' + cmd + '. Введите /help');
  }
}
