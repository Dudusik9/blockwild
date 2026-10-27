// Биомы: параметры, цвета травы/листвы/воды, классификация
export const BIOME = { OCEAN: 0, BEACH: 1, MEADOW: 2, BIRCH: 3, TAIGA: 4, DESERT: 5, SAVANNA: 6, SWAMP: 7, TUNDRA: 8, MOUNTAINS: 9 };
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
export const BIOMES = [
  { id: 0, key: 'ocean', name: 'Океан', temp: 0.5, grass: hex(0x78b45a), foliage: hex(0x62a043), water: hex(0x3a6ee0), cold: false },
  { id: 1, key: 'beach', name: 'Пляж', temp: 0.8, grass: hex(0x91bd59), foliage: hex(0x77ab2f), water: hex(0x3f78e4), cold: false },
  { id: 2, key: 'meadow', name: 'Луга', temp: 0.6, grass: hex(0x79c05a), foliage: hex(0x59ae30), water: hex(0x3f76e4), cold: false },
  { id: 3, key: 'birch', name: 'Берёзовая роща', temp: 0.55, grass: hex(0x88bb67), foliage: hex(0x6ba941), water: hex(0x3d7ee0), cold: false },
  { id: 4, key: 'taiga', name: 'Хвойная тайга', temp: 0.15, grass: hex(0x86b783), foliage: hex(0x68a464), water: hex(0x3a64d8), cold: true },
  { id: 5, key: 'desert', name: 'Пустыня', temp: 1.0, grass: hex(0xbfb755), foliage: hex(0xaea42a), water: hex(0x32a8a0), cold: false },
  { id: 6, key: 'savanna', name: 'Саванна', temp: 0.95, grass: hex(0xbfb755), foliage: hex(0xaea42a), water: hex(0x3f88d0), cold: false },
  { id: 7, key: 'swamp', name: 'Болото', temp: 0.7, grass: hex(0x6a7039), foliage: hex(0x4c7a30), water: hex(0x5d7c64), cold: false },
  { id: 8, key: 'tundra', name: 'Заснеженная тундра', temp: -0.1, grass: hex(0x80b497), foliage: hex(0x60a17b), water: hex(0x3a5fd0), cold: true },
  { id: 9, key: 'mountains', name: 'Каменистые горы', temp: 0.2, grass: hex(0x8ab172), foliage: hex(0x6a9c52), water: hex(0x3a68dc), cold: true },
];
export const BIOME_CODE = BIOMES.map((b) => b); // совместимость

// Классификация по климату и рельефу. t,h в [-1,1]
export function classify(t, h, height, sea, rugged) {
  if (height < sea - 1) return BIOME.OCEAN;
  if (height > 100 || (rugged > 0.55 && height > 84)) return BIOME.MOUNTAINS;
  if (height <= sea + 2) {
    if (t < -0.55) return BIOME.TUNDRA;
    return BIOME.BEACH;
  }
  if (t < -0.52) return BIOME.TUNDRA;
  if (t < -0.12) return h > -0.4 ? BIOME.TAIGA : BIOME.TUNDRA;
  if (t > 0.38) return h < -0.05 ? BIOME.DESERT : h < 0.3 ? BIOME.SAVANNA : BIOME.MEADOW;
  if (h > 0.4 && height < sea + 7) return BIOME.SWAMP;
  if (h > 0.12) return BIOME.BIRCH;
  return BIOME.MEADOW;
}
