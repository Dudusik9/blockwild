// Мобы: рогатый баран, пятнистая курица, лесной кабан, болотник, костяной лучник, грибник-подрывник; питомцы: котёнок, щенок-спасатель
import * as THREE from 'three';
import { Entity } from '../entity.js';
import { MobModel, Paint, faceRects } from '../mobmodel.js';
import { moveEntity } from '../../player/physics.js';
import { findPath, canSee } from '../ai.js';
import { isLiquid, isWater } from '../../world/blocks.js';
import { I, getItem } from '../../game/items.js';
import { lightBrightness } from '../items-drop.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const texCache = {};

// ---------- описания ----------
function paintFace(P, R, k, fn) { const r = R[k]; fn(r[0], r[1], r[2], r[3]); }
const DEFS = {
  ram: {
    title: 'Рогатый баран', w: 0.9, h: 1.3, hp: 8, speed: 1.6, tw: 64, th: 72, ai: 'passive', snd: 'ram', quad: true,
    parts: [
      { n: 'body', size: [10, 9, 16], uv: [0, 0], pivot: [0, 13, 0], off: [0, 0, 0] },
      { n: 'wool', size: [10, 9, 16], uv: [0, 26], pivot: [0, 13, 0], off: [0, 0, 0], infl: 3 },
      { n: 'head', size: [8, 8, 8], uv: [0, 52], pivot: [0, 17, 9], off: [0, 0, 4] },
      { n: 'hornL', size: [2, 3, 4], uv: [32, 52], pivot: [5, 20, 9], off: [1, 0, 1] },
      { n: 'hornR', size: [2, 3, 4], uv: [32, 52], pivot: [-5, 20, 9], off: [-1, 0, 1] },
      { n: 'legFL', size: [3, 8, 3], uv: [36, 0], pivot: [3, 8, 6], off: [0, -4, 0] }, { n: 'legFR', size: [3, 8, 3], uv: [36, 0], pivot: [-3, 8, 6], off: [0, -4, 0] },
      { n: 'legBL', size: [3, 8, 3], uv: [36, 0], pivot: [3, 8, -6], off: [0, -4, 0] }, { n: 'legBR', size: [3, 8, 3], uv: [36, 0], pivot: [-3, 8, -6], off: [0, -4, 0] },
    ],
    paint(P) {
      P.box(0, 0, 10, 9, 16, '#d8c8b0'); P.box(0, 26, 10, 9, 16, '#f2f0ea', 0.08); // шерсть
      const R = P.box(0, 52, 8, 8, 8, '#cdb496');
      paintFace(P, R, 'front', (x, y) => { P.rect(x + 1, y + 3, 2, 2, '#222'); P.rect(x + 5, y + 3, 2, 2, '#222'); P.rect(x + 3, y + 5, 2, 2, '#a07860'); });
      P.box(32, 52, 2, 3, 4, '#8a7a60', 0.2); P.box(36, 0, 3, 8, 3, '#5a4a40');
      for (let i = 0; i < 20; i++) P.px(P.r() * 64 | 0, 26 + (P.r() * 26 | 0), '#dcd8ce');
    },
    drops: () => [[I.raw_mutton, rnd(1, 2)], [I.hide, rnd(0, 1)]],
  },
  hen: {
    title: 'Пятнистая курица', w: 0.4, h: 0.7, hp: 4, speed: 1.4, tw: 32, th: 32, ai: 'passive', snd: 'hen', quad: false,
    parts: [
      { n: 'body', size: [6, 6, 8], uv: [0, 0], pivot: [0, 7, 0], off: [0, 0, 0] },
      { n: 'head', size: [4, 5, 3], uv: [0, 14], pivot: [0, 10, 4], off: [0, 1, 1] },
      { n: 'beak', size: [2, 1, 2], uv: [14, 14], pivot: [0, 11, 6], off: [0, 0, 1] },
      { n: 'wattle', size: [2, 2, 1], uv: [14, 18], pivot: [0, 9, 6], off: [0, 0, 0] },
      { n: 'legL', size: [1, 4, 1], uv: [22, 0], pivot: [1.5, 4, 0], off: [0, -2, 0] }, { n: 'legR', size: [1, 4, 1], uv: [22, 0], pivot: [-1.5, 4, 0], off: [0, -2, 0] },
      { n: 'wingL', size: [1, 4, 6], uv: [0, 22], pivot: [3.5, 9, 0], off: [0, -2, 0] }, { n: 'wingR', size: [1, 4, 6], uv: [14, 22], pivot: [-3.5, 9, 0], off: [0, -2, 0] },
    ],
    paint(P) {
      P.box(0, 0, 6, 6, 8, '#f0eee6'); for (let i = 0; i < 26; i++) P.rect(P.r() * 30 | 0, P.r() * 14 | 0, 2, 1, '#7a4e2c');
      const R = P.box(0, 14, 4, 5, 3, '#f3f1ea'); paintFace(P, R, 'front', (x, y) => { P.px(x, y + 1, '#111'); P.px(x + 3, y + 1, '#111'); });
      P.box(14, 14, 2, 1, 2, '#e8a020'); P.box(14, 18, 2, 2, 1, '#c82020'); P.box(22, 0, 1, 4, 1, '#d89020');
      P.box(0, 22, 1, 4, 6, '#e6e2d6'); P.box(14, 22, 1, 4, 6, '#e6e2d6'); for (let i = 0; i < 8; i++) P.px(P.r() * 24 | 0, 22 + (P.r() * 10 | 0), '#7a4e2c');
    },
    drops: () => [[I.raw_chicken, 1], [I.feather, rnd(0, 2)]],
  },
  boar: {
    title: 'Лесной кабан', w: 0.9, h: 0.9, hp: 10, speed: 1.9, tw: 64, th: 48, ai: 'passive', snd: 'boar', quad: true,
    parts: [
      { n: 'body', size: [10, 8, 14], uv: [0, 0], pivot: [0, 9, 0], off: [0, 0, 0] },
      { n: 'head', size: [8, 7, 6], uv: [0, 24], pivot: [0, 10, 8], off: [0, 0, 3] },
      { n: 'snout', size: [4, 3, 2], uv: [28, 24], pivot: [0, 9, 14], off: [0, 0, 1] },
      { n: 'tuskL', size: [1, 2, 1], uv: [40, 24], pivot: [2.5, 9, 14], off: [0, 1, 0] }, { n: 'tuskR', size: [1, 2, 1], uv: [40, 24], pivot: [-2.5, 9, 14], off: [0, 1, 0] },
      { n: 'legFL', size: [3, 6, 3], uv: [0, 38], pivot: [3, 6, 5], off: [0, -3, 0] }, { n: 'legFR', size: [3, 6, 3], uv: [0, 38], pivot: [-3, 6, 5], off: [0, -3, 0] },
      { n: 'legBL', size: [3, 6, 3], uv: [0, 38], pivot: [3, 6, -5], off: [0, -3, 0] }, { n: 'legBR', size: [3, 6, 3], uv: [0, 38], pivot: [-3, 6, -5], off: [0, -3, 0] },
    ],
    paint(P) {
      P.box(0, 0, 10, 8, 14, '#5a4030', 0.18); for (let i = 0; i < 40; i++) P.px(P.r() * 50 | 0, P.r() * 22 | 0, '#2e2018');
      const R = P.box(0, 24, 8, 7, 6, '#6a4c38', 0.15); paintFace(P, R, 'front', (x, y) => { P.rect(x + 1, y + 2, 2, 2, '#111'); P.rect(x + 5, y + 2, 2, 2, '#111'); });
      const S = P.box(28, 24, 4, 3, 2, '#c8908a'); paintFace(P, S, 'front', (x, y) => { P.px(x + 1, y + 1, '#401818'); P.px(x + 2, y + 1, '#401818'); });
      P.box(40, 24, 1, 2, 1, '#f0ead0'); P.box(0, 38, 3, 6, 3, '#3a2a20');
    },
    drops: () => [[I.raw_pork, rnd(1, 3)], [I.hide, rnd(0, 1)]],
  },
  swamper: {
    title: 'Болотник', w: 0.6, h: 1.8, hp: 20, speed: 3.0, tw: 64, th: 64, ai: 'melee', snd: 'swamper', biped: true, dmg: 3,
    parts: [
      { n: 'head', size: [8, 8, 8], uv: [0, 0], pivot: [0, 24, 0], off: [0, 4, 0] },
      { n: 'body', size: [8, 12, 4], uv: [0, 16], pivot: [0, 24, 0], off: [0, -6, 0] },
      { n: 'armL', size: [4, 12, 4], uv: [32, 16], pivot: [6, 23, 0], off: [0, -4, 0] }, { n: 'armR', size: [4, 12, 4], uv: [32, 32], pivot: [-6, 23, 0], off: [0, -4, 0] },
      { n: 'legL', size: [4, 12, 4], uv: [0, 32], pivot: [2, 12, 0], off: [0, -6, 0] }, { n: 'legR', size: [4, 12, 4], uv: [16, 32], pivot: [-2, 12, 0], off: [0, -6, 0] },
    ],
    paint(P) {
      const moss = (x, y, w, h) => { for (let i = 0; i < w * h / 3; i++) P.px(x + (P.r() * w | 0), y + (P.r() * h | 0), P.r() < 0.5 ? '#3f6a2a' : '#567a34'); };
      const R = P.box(0, 0, 8, 8, 8, '#6e8a5a', 0.15); paintFace(P, R, 'front', (x, y) => { P.rect(x + 1, y + 3, 2, 1, '#ffdc40'); P.rect(x + 5, y + 3, 2, 1, '#ffdc40'); P.rect(x + 2, y + 6, 4, 1, '#2a2a20'); });
      moss(0, 0, 32, 8);
      const B_ = P.box(0, 16, 8, 12, 4, '#4a5a3a', 0.2); moss(0, 16, 24, 16);
      P.box(32, 16, 4, 12, 4, '#6e8a5a', 0.15); P.box(32, 32, 4, 12, 4, '#6e8a5a', 0.15); moss(32, 16, 16, 28);
      P.box(0, 32, 4, 12, 4, '#3a4a3a', 0.2); P.box(16, 32, 4, 12, 4, '#3a4a3a', 0.2);
    },
    drops: () => [[I.hide, rnd(0, 2)], [I.stick, rnd(0, 2)], [Math.random() < 0.12 ? I.iron_ingot : I.coal, Math.random() < 0.5 ? 1 : 0]],
  },
  archer: {
    title: 'Костяной лучник', w: 0.6, h: 1.8, hp: 14, speed: 2.6, tw: 64, th: 64, ai: 'ranged', snd: 'archer', biped: true, burn: true,
    parts: [
      { n: 'head', size: [8, 8, 8], uv: [0, 0], pivot: [0, 24, 0], off: [0, 4, 0] },
      { n: 'body', size: [8, 12, 4], uv: [0, 16], pivot: [0, 24, 0], off: [0, -6, 0] },
      { n: 'armL', size: [2, 12, 2], uv: [32, 16], pivot: [5, 23, 0], off: [0, -4, 0] }, { n: 'armR', size: [2, 12, 2], uv: [40, 16], pivot: [-5, 23, 0], off: [0, -4, 0] },
      { n: 'legL', size: [2, 12, 2], uv: [0, 32], pivot: [2, 12, 0], off: [0, -6, 0] }, { n: 'legR', size: [2, 12, 2], uv: [8, 32], pivot: [-2, 12, 0], off: [0, -6, 0] },
      { n: 'bow', size: [1, 12, 4], uv: [16, 32], pivot: [-5, 14, 4], off: [0, 0, 0] },
    ],
    paint(P) {
      const bone = '#dcd8c8';
      const R = P.box(0, 0, 8, 8, 8, bone, 0.08); paintFace(P, R, 'front', (x, y) => { P.rect(x + 1, y + 3, 2, 2, '#1a1a1a'); P.rect(x + 5, y + 3, 2, 2, '#1a1a1a'); P.rect(x + 3, y + 5, 2, 1, '#8a8678'); for (let i = 1; i < 8; i += 2) P.px(x + i, y + 7, '#222'); });
      const Bd = P.box(0, 16, 8, 12, 4, '#2a2a2a', 0.05); paintFace(P, Bd, 'front', (x, y) => { for (let j = 1; j < 12; j += 3) P.rect(x, y + j, 8, 2, bone); P.rect(x + 3, y, 2, 12, bone); });
      paintFace(P, Bd, 'back', (x, y) => { for (let j = 1; j < 12; j += 3) P.rect(x, y + j, 8, 2, bone); P.rect(x + 3, y, 2, 12, bone); });
      P.box(32, 16, 2, 12, 2, bone); P.box(40, 16, 2, 12, 2, bone); P.box(0, 32, 2, 12, 2, bone); P.box(8, 32, 2, 12, 2, bone); P.box(16, 32, 1, 12, 4, '#7a5a30', 0.2);
    },
    drops: () => [[I.bone, rnd(0, 2)], [I.arrow, rnd(0, 2)]],
  },
  bomber: {
    title: 'Грибник-подрывник', w: 0.6, h: 1.4, hp: 10, speed: 3.0, tw: 64, th: 64, ai: 'bomber', snd: 'bomber', biped: true,
    parts: [
      { n: 'cap', size: [12, 6, 12], uv: [0, 0], pivot: [0, 22, 0], off: [0, 3, 0] },
      { n: 'head', size: [8, 6, 8], uv: [0, 18], pivot: [0, 17, 0], off: [0, 3, 0] },
      { n: 'body', size: [8, 8, 6], uv: [0, 32], pivot: [0, 17, 0], off: [0, -4, 0] },
      { n: 'armL', size: [2, 6, 2], uv: [32, 32], pivot: [5, 16, 0], off: [0, -3, 0] }, { n: 'armR', size: [2, 6, 2], uv: [40, 32], pivot: [-5, 16, 0], off: [0, -3, 0] },
      { n: 'legL', size: [3, 6, 3], uv: [0, 48], pivot: [2, 9, 0], off: [0, -3, 0] }, { n: 'legR', size: [3, 6, 3], uv: [12, 48], pivot: [-2, 9, 0], off: [0, -3, 0] },
    ],
    paint(P) {
      const R = P.box(0, 0, 12, 6, 12, '#b8302a', 0.1);
      for (let i = 0; i < 14; i++) { const x = 12 + (P.r() * 10 | 0), y = 12 + (P.r() * 12 | 0); P.rect(x, y - 6, 2, 2, '#f4eee0'); }
      for (let i = 0; i < 14; i++) P.rect(12 + (P.r() * 8 | 0), P.r() * 10 | 0, 2, 2, '#f4eee0');
      const H = P.box(0, 18, 8, 6, 8, '#e8dcc0', 0.06); paintFace(P, H, 'front', (x, y) => { P.rect(x + 1, y + 2, 2, 2, '#111'); P.rect(x + 5, y + 2, 2, 2, '#111'); P.rect(x + 2, y + 4, 4, 1, '#111'); });
      P.box(0, 32, 8, 8, 6, '#d8ccac', 0.08); P.box(32, 32, 2, 6, 2, '#d8ccac'); P.box(40, 32, 2, 6, 2, '#d8ccac'); P.box(0, 48, 3, 6, 3, '#b8a888'); P.box(12, 48, 3, 6, 3, '#b8a888');
    },
    drops: () => [[I.powder, rnd(0, 2)]],
  },
  // ---- питомцы: приручаются лакомством, ходят следом, не получают урона
  kitten: {
    title: 'Котёнок', w: 0.45, h: 0.65, hp: 10, speed: 1.8, tw: 64, th: 32, ai: 'pet', snd: 'kitten', quad: true,
    treats: ['fish', 'raw_chicken', 'cooked_chicken', 'egg'],
    variants: [
      { title: 'Рыжик', fur: '#e8924a', fur2: '#c06a28', belly: '#f6d8b0', eye: '#58b040', stripes: true },
      { title: 'Дымок', fur: '#9a9aa4', fur2: '#6a6a76', belly: '#d8d8de', eye: '#d8b030', stripes: true },
      { title: 'Снежок', fur: '#f4f2ee', fur2: '#e2ddd4', belly: '#ffffff', eye: '#4a90e0' },
      { title: 'Носочек', fur: '#2e2e34', fur2: '#202024', belly: '#f2f2f2', eye: '#9ad040', paws: '#f2f2f2', tux: true },
    ],
    parts: [
      { n: 'body', size: [5, 5, 11], uv: [0, 0], pivot: [0, 6.5, 0], off: [0, 0, 0] },
      { n: 'head', size: [6, 5, 5], uv: [32, 0], pivot: [0, 9, 6], off: [0, 0, 2] },
      { n: 'earL', size: [1, 2, 1], uv: [54, 0], pivot: [1.8, 11.5, 7], off: [0, 1, 0] }, { n: 'earR', size: [1, 2, 1], uv: [54, 0], pivot: [-1.8, 11.5, 7], off: [0, 1, 0] },
      { n: 'tail', size: [1, 1, 7], uv: [0, 16], pivot: [0, 8.5, -5.5], off: [0, 0, -3.5] },
      { n: 'legFL', size: [2, 4, 2], uv: [16, 16], pivot: [1.5, 4, 4], off: [0, -2, 0] }, { n: 'legFR', size: [2, 4, 2], uv: [16, 16], pivot: [-1.5, 4, 4], off: [0, -2, 0] },
      { n: 'legBL', size: [2, 4, 2], uv: [16, 16], pivot: [1.5, 4, -4], off: [0, -2, 0] }, { n: 'legBR', size: [2, 4, 2], uv: [16, 16], pivot: [-1.5, 4, -4], off: [0, -2, 0] },
    ],
    paint(P, v) {
      const B_ = P.box(0, 0, 5, 5, 11, v.fur, 0.06);
      if (v.stripes) {
        for (let z = 1; z < 11; z += 3) P.rect(B_.top[0], B_.top[1] + z, 5, 1, v.fur2);
        for (const k of ['left', 'right']) for (let x = 1; x < 11; x += 3) P.rect(B_[k][0] + x, B_[k][1], 1, 3, v.fur2);
      }
      P.rect(B_.bottom[0], B_.bottom[1], 5, 11, v.belly);
      if (v.tux) P.rect(B_.front[0], B_.front[1], 5, 5, v.belly);
      const H = P.box(32, 0, 6, 5, 5, v.fur, 0.05);
      paintFace(P, H, 'front', (x, y) => {
        if (v.tux) P.rect(x + 1, y + 3, 4, 2, v.belly);
        if (v.stripes) { P.px(x + 2, y, v.fur2); P.px(x + 3, y, v.fur2); }
        P.rect(x + 1, y + 1, 1, 2, v.eye); P.rect(x + 4, y + 1, 1, 2, v.eye); P.px(x + 1, y + 2, '#151515'); P.px(x + 4, y + 2, '#151515');
        P.rect(x + 2, y + 3, 2, 1, '#f08a9a'); P.px(x + 2, y + 4, '#5a3a3a'); P.px(x + 3, y + 4, '#5a3a3a');
      });
      const E = P.box(54, 0, 1, 2, 1, v.fur, 0); paintFace(P, E, 'front', (x, y) => P.px(x, y + 1, '#f0a0b0'));
      P.box(0, 16, 1, 1, 7, v.fur, 0.06); if (v.stripes) for (let z = 1; z < 7; z += 2) P.px(1 + z, 16, v.fur2);
      P.box(16, 16, 2, 4, 2, v.paws || v.fur, 0.05);
    },
    drops: () => [],
  },
  puppy: {
    title: 'Щенок-спасатель', w: 0.6, h: 0.95, hp: 14, speed: 2.0, tw: 64, th: 48, ai: 'pet', snd: 'puppy', quad: true,
    treats: ['dog_treat', 'bone', 'raw_pork', 'cooked_pork', 'raw_mutton', 'cooked_mutton', 'raw_chicken', 'cooked_chicken'],
    variants: [
      { title: 'Огонёк', fur: '#f4f2ee', fur2: '#222226', vest: '#d83a2a', hat: '#d83a2a', pack: '#b82a20', badge: '#ffd23a', snout: '#f4f2ee', spots: true },
      { title: 'Дозор', fur: '#a8743a', fur2: '#3a2a1e', vest: '#2a5ad8', hat: '#2a4ab8', pack: '#2448a8', badge: '#ffd23a', snout: '#3a2a1e' },
      { title: 'Кирпичик', fur: '#d8b88a', fur2: '#a08060', vest: '#f0c020', hat: '#f0c020', pack: '#d89a10', badge: '#3a3a3a', snout: '#f0e0c8' },
    ],
    parts: [
      { n: 'body', size: [6, 6, 10], uv: [0, 0], pivot: [0, 8, 0], off: [0, 0, 0] },
      { n: 'head', size: [6, 6, 6], uv: [32, 0], pivot: [0, 12, 6], off: [0, 0, 2] },
      { n: 'snout', size: [3, 2, 2], uv: [0, 32], pivot: [0, 10.5, 11], off: [0, 0, 1] },
      { n: 'earL', size: [2, 3, 1], uv: [56, 0], pivot: [3.5, 14.5, 7], off: [0, -1.5, 0] }, { n: 'earR', size: [2, 3, 1], uv: [56, 0], pivot: [-3.5, 14.5, 7], off: [0, -1.5, 0] },
      { n: 'hat', size: [5, 2, 5], uv: [28, 16], pivot: [0, 15, 8], off: [0, 1, 0] },
      { n: 'pack', size: [4, 3, 3], uv: [48, 16], pivot: [0, 11, -1], off: [0, 1.5, 0] },
      { n: 'tail', size: [1, 1, 4], uv: [16, 16], pivot: [0, 10, -5], off: [0, 0, -2] },
      { n: 'legFL', size: [2, 5, 2], uv: [0, 16], pivot: [1.8, 5, 3.5], off: [0, -2.5, 0] }, { n: 'legFR', size: [2, 5, 2], uv: [0, 16], pivot: [-1.8, 5, 3.5], off: [0, -2.5, 0] },
      { n: 'legBL', size: [2, 5, 2], uv: [0, 16], pivot: [1.8, 5, -3.5], off: [0, -2.5, 0] }, { n: 'legBR', size: [2, 5, 2], uv: [0, 16], pivot: [-1.8, 5, -3.5], off: [0, -2.5, 0] },
    ],
    paint(P, v) {
      const spots = (x, y, w, h, n) => { if (v.spots) for (let i = 0; i < n; i++) P.px(x + (P.r() * w | 0), y + (P.r() * h | 0), v.fur2); };
      const B_ = P.box(0, 0, 6, 6, 10, v.fur, 0.06); spots(0, 0, 32, 16, 22);
      P.rect(B_.top[0], B_.top[1] + 2, 6, 6, v.vest);
      for (const k of ['left', 'right']) P.rect(B_[k][0] + 2, B_[k][1], 6, 4, v.vest);
      P.rect(B_.front[0], B_.front[1], 6, 4, v.vest); P.rect(B_.front[0] + 2, B_.front[1] + 1, 2, 2, v.badge);
      const H = P.box(32, 0, 6, 6, 6, v.fur, 0.05); spots(32, 0, 24, 12, 8);
      paintFace(P, H, 'front', (x, y) => {
        P.rect(x + 1, y + 2, 1, 2, '#1a1410'); P.rect(x + 4, y + 2, 1, 2, '#1a1410'); P.px(x + 1, y + 2, '#ffffff'); P.px(x + 4, y + 2, '#ffffff');
      });
      P.box(56, 0, 2, 3, 1, v.fur2, 0.05);
      const S = P.box(0, 32, 3, 2, 2, v.snout, 0.04); paintFace(P, S, 'front', (x, y) => { P.rect(x + 1, y, 1, 1, '#141010'); P.px(x + 1, y + 1, '#c04050'); });
      paintFace(P, S, 'top', (x, y) => P.px(x + 1, y + 1, '#141010'));
      const Hat = P.box(28, 16, 5, 2, 5, v.hat, 0.04); paintFace(P, Hat, 'front', (x, y) => P.rect(x + 2, y, 1, 2, v.badge));
      const Pk = P.box(48, 16, 4, 3, 3, v.pack, 0.06); paintFace(P, Pk, 'back', (x, y) => P.rect(x + 1, y + 1, 2, 1, v.badge));
      P.box(16, 16, 1, 1, 4, v.fur, 0.05);
      P.box(0, 16, 2, 5, 2, v.fur, 0.05); spots(0, 16, 8, 7, 4);
    },
    drops: () => [],
  },
};
export const MOB_KINDS = Object.keys(DEFS);

function getTex(kind, vi = 0) {
  const key = kind + ':' + vi;
  if (!texCache[key]) { const d = DEFS[kind]; const P = new Paint(d.tw, d.th, kind.length * 997 + vi); d.paint(P, d.variants ? d.variants[vi] : null); texCache[key] = P.tex(); }
  return texCache[key];
}

export class Mob extends Entity {
  constructor(g, kind, x, y, z, variant) {
    super('mob'); this.g = g;
    const d = this.def = DEFS[kind]; this.kind = kind; this.isMob = true;
    this.w = d.w; this.h = d.h; this.x = x; this.y = y; this.z = z;
    this.hp = this.maxHp = d.hp; this.yaw = Math.random() * 6.28; this.walk = 0; this.walkAmt = 0;
    this.variant = d.variants ? (variant !== undefined && d.variants[variant] ? variant : (Math.random() * d.variants.length) | 0) : 0;
    this.tamed = false; this.sitting = false; this.lost = false;
    this.model = new MobModel(d, getTex(kind, this.variant)); this.mesh = this.model.group; this.mesh.position.set(x, y, z);
    if (d.ai === 'pet') { // уши, нос и шапка поворачиваются вместе с головой
      const P = this.model.parts, hd = P.head;
      for (const k of ['earL', 'earR', 'snout', 'hat']) if (P[k]) { P[k].position.sub(hd.position); hd.add(P[k]); }
    }
    this.hurtT = 0; this.deathT = 0; this.wishX = 0; this.wishZ = 0; this.speed = d.speed; this.aiT = Math.random() * 3; this.idle = true;
    this.path = null; this.pathT = 0; this.attackT = 0; this.panic = 0; this.lt = 0; this.burnT = 0; this.sheared = false; this.eggT = 240 + Math.random() * 300;
    this.fuse = -1; this.shootT = 1 + Math.random(); this.soundT = 5 + Math.random() * 10; this.wool = 'white'; this.noDespawn = false;
    if (kind === 'ram') { const r = Math.random(); this.wool = r < 0.05 ? 'black' : r < 0.08 ? 'red' : 'white'; this.tintWool(); this.woolT = 0; }
    this.bright = 1;
  }
  tintWool() { const c = { white: 0xffffff, black: 0x555560, red: 0xd88070 }[this.wool]; const w = this.model.parts.wool; if (w) w.userData.tint = c; }
  get eye() { return this.y + this.h * 0.85; }
  get title() { return this.def.variants ? this.def.variants[this.variant].title : this.def.title; }
  hurt(dmg, kb, src) {
    if (this.deathT > 0) return;
    if (this.def.ai === 'pet') { // питомцы неуязвимы: только подпрыгивают и пищат
      if (this.onGround) this.vy = 4;
      this.g.sfx?.play('mob:' + this.def.snd, { x: this.x, y: this.y, z: this.z }, 0.9, 1.25);
      return;
    }
    this.hp -= dmg; this.hurtT = 0.4; this.panic = this.def.ai === 'passive' ? 5 : 0;
    if (kb) { this.vx += kb.x * 5; this.vz += kb.z * 5; this.vy = 4.5; this.onGround = false; }
    this.g.sfx?.play('mob:hurt', { x: this.x, y: this.y, z: this.z }, 1);
    this.g.particles?.hurt(this.x, this.y + this.h * 0.5, this.z, 6);
    if (src === 'player' && this.def.ai !== 'passive') this.aggro = 12;
    if (this.hp <= 0) this.die(src);
  }
  die(src) {
    this.deathT = 0.01; const g = this.g;
    g.sfx?.play('mob:death', { x: this.x, y: this.y, z: this.z }, 1);
    for (const [id, n] of this.def.drops()) if (n > 0 && id) g.dropItem(this.x, this.y + 0.4, this.z, { id, count: n, dmg: 0 });
    if (this.kind === 'ram' && !this.sheared) g.dropItem(this.x, this.y + 0.4, this.z, { id: I['wool_' + this.wool], count: 1, dmg: 0 });
  }
  // ПКМ по мобу: true — действие выполнено
  interact(g, stack) {
    if (this.def.ai !== 'pet' || this.deathT > 0) return false;
    const it = stack ? getItem(stack.id) : null, pos = { x: this.x, y: this.y + this.h, z: this.z };
    if (this.lost) { this.tame(g); return true; } // потерявшегося достаточно обнять
    if (it && this.def.treats.includes(it.name)) {
      if (!g.player.creative) g.inventory.decrementSelected();
      g.sfx?.play('eat', pos, 0.8);
      if (!this.tamed) this.tame(g);
      else g.particles?.hearts(this.x, this.y + this.h, this.z, 5);
      g.onPetFed?.(this);
      return true;
    }
    if (this.tamed) { this.sitting = !this.sitting; this.path = null; }
    g.particles?.hearts(this.x, this.y + this.h, this.z, 3);
    g.sfx?.play('mob:' + this.def.snd, pos, 1);
    if (this.kind === 'kitten' && this.tamed) g.sfx?.play('mob:purr', pos, 0.8);
    this.soundT = 6 + Math.random() * 10;
    return true;
  }
  tame(g) {
    this.tamed = true; this.noDespawn = true; this.sitting = false; this.lost = false;
    g.particles?.hearts(this.x, this.y + this.h, this.z, 14);
    g.sfx?.play('mob:' + this.def.snd, { x: this.x, y: this.y + this.h, z: this.z }, 1.1);
    g.onPetTamed?.(this);
  }
  shear(g, stack) {
    if (this.kind !== 'ram' || this.sheared || this.deathT > 0) return false;
    this.sheared = true; this.woolT = 180;
    g.dropItem(this.x, this.y + 0.8, this.z, { id: I['wool_' + this.wool], count: rnd(1, 3), dmg: 0 });
    g.sfx?.play('step:cloth', { x: this.x, y: this.y, z: this.z }, 1.3);
    if (!g.player.creative && g.inventory.damageSelected(1)) g.sfx?.play('break_tool');
    return true;
  }
  update(dt, g) {
    this.g = g;
    const w = g.world, p = g.player, d = this.def;
    if (this.deathT > 0) {
      this.deathT += dt; this.mesh.rotation.z = Math.min(1.5, this.deathT * 5);
      if (this.deathT > 0.9) { this.dead = true; g.particles?.poof(this.x, this.y, this.z, 12); }
      return;
    }
    if (!w.isLoaded(Math.floor(this.x), Math.floor(this.z))) return;
    this.hurtT = Math.max(0, this.hurtT - dt);
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz), dy = p.y - this.y;
    this.wishX = 0; this.wishZ = 0; this.speedMul = 1;
    // ИИ
    if (d.ai === 'passive') this.aiPassive(dt, g);
    else if (d.ai === 'pet') this.aiPet(dt, g, dist);
    else this.aiHostile(dt, g, dx, dz, dist, dy);
    // жидкость / горение
    const inW = isWater(w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.3), Math.floor(this.z)));
    if (d.burn && g.sky.daylight > 0.7 && !inW && g.rain < 0.3) {
      const sunny = (w.getLight(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z)) >> 4) >= 14;
      if (sunny) this.burnT = 6;
    }
    if (this.burnT > 0) {
      this.burnT -= dt; this.burnDmg = (this.burnDmg || 0) + dt;
      if (Math.random() < dt * 12) g.particles?.flame(this.x + (Math.random() - 0.5) * 0.4, this.y + Math.random() * this.h, this.z + (Math.random() - 0.5) * 0.4);
      if (this.burnDmg >= 1) { this.burnDmg = 0; this.hurt(1, null, 'fire'); }
      if (inW) this.burnT = 0;
    }
    // физика
    const sp = this.speed * this.speedMul;
    const tvx = this.wishX * sp, tvz = this.wishZ * sp;
    const a = (this.onGround ? 40 : 10) * dt;
    this.vx += Math.max(-a, Math.min(a, tvx - this.vx)); this.vz += Math.max(-a, Math.min(a, tvz - this.vz));
    if (inW) { this.vy += (this.vy < 2 ? 14 : 0) * dt; this.vy *= 0.9; } else this.vy -= 28 * dt;
    if (this.kind === 'hen' && this.vy < -2) this.vy = -2;
    if (this.vy < -50) this.vy = -50;
    moveEntity(w, this, this.vx * dt, this.vy * dt, this.vz * dt, { step: 0.05 });
    if (this.hitY) this.vy = 0;
    if ((this.hitX || this.hitZ) && this.onGround && (this.wishX || this.wishZ)) this.vy = 8.4;
    if (this.y < -20) this.dead = true;
    // анимация
    const hs = Math.hypot(this.vx, this.vz);
    this.walkAmt += (Math.min(1, hs / 2) - this.walkAmt) * Math.min(1, dt * 10);
    this.walk += hs * dt * 3.2;
    if (hs > 0.2) { const ty = Math.atan2(this.vx, this.vz); let df = ty - this.yaw; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283; this.yaw += df * Math.min(1, dt * 9); }
    this.animate(dt, g, dist);
    // звук
    this.soundT -= dt;
    if (this.soundT <= 0) {
      this.soundT = this.lost ? 2.5 + Math.random() * 2 : 6 + Math.random() * 14;
      if (dist < (this.lost ? 48 : 24)) g.sfx?.play('mob:' + d.snd, { x: this.x, y: this.y + 1, z: this.z }, this.lost ? 1.2 : 0.8);
    }
    if (this.kind === 'hen') { this.eggT -= dt; if (this.eggT <= 0) { this.eggT = 240 + Math.random() * 300; g.dropItem(this.x, this.y + 0.3, this.z, { id: I.egg, count: 1, dmg: 0 }); g.sfx?.play('mob:hen', { x: this.x, y: this.y, z: this.z }); } }
    if (this.kind === 'ram' && this.sheared) { this.woolT -= dt; if (this.woolT <= 0) this.sheared = false; }
    // освещение
    this.lt -= dt; if (this.lt <= 0) { this.lt = 0.4; this.bright = lightBrightness(w, this.x, this.y + 0.5, this.z, g.sky.daylight); }
  }
  wander(dt) {
    this.aiT -= dt;
    if (this.aiT <= 0) {
      if (this.idle) { this.idle = false; this.dirYaw = Math.random() * 6.283; this.aiT = 1.5 + Math.random() * 3; }
      else { this.idle = true; this.aiT = 1.5 + Math.random() * 4; }
    }
    if (!this.idle) { this.wishX = Math.sin(this.dirYaw); this.wishZ = Math.cos(this.dirYaw); this.speedMul = 0.6; }
  }
  aiPassive(dt, g) {
    if (this.panic > 0) {
      this.panic -= dt; const p = g.player;
      let ax = this.x - p.x, az = this.z - p.z; const l = Math.hypot(ax, az) || 1;
      if (!this.fleeDir || Math.random() < dt * 0.8) this.fleeDir = [ax / l + (Math.random() - 0.5), az / l + (Math.random() - 0.5)];
      const fl = Math.hypot(...this.fleeDir) || 1;
      this.wishX = this.fleeDir[0] / fl; this.wishZ = this.fleeDir[1] / fl; this.speedMul = 1.9;
    } else this.wander(dt);
  }
  aiPet(dt, g, dist) {
    const p = g.player;
    this.yawLook = Math.atan2(p.x - this.x, p.z - this.z);
    if (this.sitting) { this.path = null; return; }
    if (this.tamed) {
      // застрял или отстал — прыжок к игроку
      const moved = Math.hypot(this.x - (this.lastX ?? this.x), this.z - (this.lastZ ?? this.z)) / Math.max(dt, 1e-3);
      this.lastX = this.x; this.lastZ = this.z;
      this.stuckT = dist > 5 && moved < 0.4 ? (this.stuckT || 0) + dt : 0;
      if ((dist > 24 || this.stuckT > 2.5) && p.onGround && !p.flying && this.teleportNear(g)) { this.stuckT = 0; return; }
      if (dist > 3.2) this.goTo(dt, g, p.x, p.y, p.z, dist > 10 ? 2.8 : 1.6);
      else this.path = null;
      return;
    }
    // дикий: идёт к игроку, если у того в руке лакомство
    const st = g.inventory.held, it = st ? getItem(st.id) : null;
    if (it && this.def.treats.includes(it.name) && dist < 8) { if (dist > 1.6) this.goTo(dt, g, p.x, p.y, p.z, 1.2); return; }
    if (!this.lost) this.wander(dt); // потерявшийся сидит на месте и зовёт
  }
  // прыжок к игроку, если тот убежал далеко
  teleportNear(g) {
    const p = g.player, w = g.world;
    const free = (x, y, z) => !SOLID[w.getBlock(x, y, z)] && !SOLID[w.getBlock(x, y + 1, z)] && SOLID[w.getBlock(x, y - 1, z)];
    // за спиной игрока, затем вокруг, в крайнем случае — у ног
    const spots = [];
    for (const r of [1.6, 1.1]) for (let i = 0; i < 8; i++) { const a = p.yaw + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.6; spots.push([p.x + Math.sin(a) * r, p.z + Math.cos(a) * r]); }
    spots.push([p.x, p.z]);
    const py = Math.floor(p.y + 0.01);
    for (const [x, z] of spots) {
      const bx = Math.floor(x), bz = Math.floor(z);
      for (const by of [py, py + 1, py - 1, py - 2]) {
        if (!free(bx, by, bz)) continue;
        this.x = bx + 0.5; this.y = by; this.z = bz + 0.5; this.vx = this.vy = this.vz = 0; this.path = null;
        g.particles?.poof(this.x, this.y, this.z, 6);
        return true;
      }
    }
    return false;
  }
  // движение к точке: напрямую или по A*
  goTo(dt, g, tx, ty, tz, mul) {
    this.pathT -= dt;
    const dd = Math.hypot(tx - this.x, tz - this.z);
    if (this.hitX || this.hitZ || dd > 6 && (!this.path || this.pathT <= 0)) {
      if (this.pathT <= 0 && g.pathBudget > 0) { g.pathBudget--; this.path = findPath(g.world, this.x, this.y, this.z, tx, ty, tz, 400); this.pathT = 1.0; }
    }
    let gx = tx, gz = tz;
    if (this.path && this.path.length) {
      const n = this.path[0]; if (Math.hypot(n.x - this.x, n.z - this.z) < 0.5) this.path.shift();
      if (this.path.length) { gx = this.path[0].x; gz = this.path[0].z; if (this.path[0].y > this.y + 0.6 && this.onGround) this.vy = 8.4; }
    }
    const l = Math.hypot(gx - this.x, gz - this.z) || 1;
    this.wishX = (gx - this.x) / l; this.wishZ = (gz - this.z) / l; this.speedMul = mul;
  }
  aiHostile(dt, g, dx, dz, dist, dy) {
    const p = g.player, w = g.world, d = this.def;
    this.attackT -= dt; this.aggro = Math.max(0, (this.aggro || 0) - dt);
    const targetable = !p.creative && !g.survival.dead && g.state === 'playing';
    const range = this.aggro > 0 ? 28 : (d.ai === 'ranged' ? 20 : 16);
    const sees = targetable && dist < range && Math.abs(dy) < 12 && (dist < 5 || canSee(w, this.x, this.eye, this.z, p.x, p.y + 1.5, p.z));
    this.target = sees;
    if (!sees) { this.fuse = -1; this.path = null; this.wander(dt); return; }
    const toward = (tx, tz, mul) => this.goTo(dt, g, tx, p.y, tz, mul);
    if (d.ai === 'melee') {
      toward(p.x, p.z, 1.15);
      if (dist < 1.4 && Math.abs(dy) < 1.6 && this.attackT <= 0) { this.attackT = 1.0; g.survival.damage(d.dmg + (Math.random() < 0.3 ? 1 : 0), 'болотник', { x: dx / (dist || 1), z: dz / (dist || 1) }); this.armUp = 0.3; }
    } else if (d.ai === 'ranged') {
      if (dist < 6) { const l = dist || 1; this.wishX = -dx / l; this.wishZ = -dz / l; this.speedMul = 1.1; }
      else if (dist > 11) toward(p.x, p.z, 1);
      else { this.wishX = -dz / (dist || 1) * 0.5; this.wishZ = dx / (dist || 1) * 0.5; this.speedMul = 0.6; }
      this.yawLook = Math.atan2(dx, dz);
      this.shootT -= dt;
      if (this.shootT <= 0 && dist < 22) { this.shootT = 1.6 + Math.random() * 0.8; this.shoot(g); }
    } else if (d.ai === 'bomber') {
      if (this.fuse < 0) {
        toward(p.x, p.z, 1.1);
        if (dist < 3) { this.fuse = 1.5; g.sfx?.play('fuse', { x: this.x, y: this.y, z: this.z }, 1); }
      } else {
        this.speedMul = 0; this.fuse -= dt;
        if (dist > 6) { this.fuse = -1; }
        else if (this.fuse <= 0) { this.dead = true; g.explode(this.x, this.y + 0.7, this.z, 2.8, 'bomber'); }
      }
    }
  }
  shoot(g) {
    const p = g.player;
    const ox = this.x, oy = this.y + 1.5, oz = this.z;
    const tx = p.x + (Math.random() - 0.5) * 1.2, ty = p.y + 1.2 + (Math.random() - 0.5) * 0.6, tz = p.z + (Math.random() - 0.5) * 1.2;
    const dx = tx - ox, dy = ty - oy, dz = tz - oz, d = Math.hypot(dx, dy, dz), sp = 20;
    g.entities.add(new Arrow(g, ox, oy, oz, dx / d * sp, dy / d * sp + d * 0.12, dz / d * sp));
    g.sfx?.play('arrow', { x: ox, y: oy, z: oz }, 1);
    this.drawT = 0.4;
  }
  animate(dt, g, dist) {
    const P = this.model.parts, d = this.def;
    const sw = Math.sin(this.walk) * 0.9 * this.walkAmt;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.yaw;
    let look = 0;
    if (d.ai !== 'passive' && this.target && this.yawLook !== undefined) { let df = this.yawLook - this.yaw; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283; look = Math.max(-0.8, Math.min(0.8, df)); }
    if (d.quad) { P.legFL.rotation.x = sw; P.legBR.rotation.x = sw; P.legFR.rotation.x = -sw; P.legBL.rotation.x = -sw; }
    if (d.ai === 'pet') {
      const sit = this.sitting ? 1 : 0;
      P.body.rotation.x = -0.4 * sit; if (P.pack) P.pack.rotation.x = -0.4 * sit;
      if (sit) { P.legBL.rotation.x = P.legBR.rotation.x = -1.3; P.legFL.rotation.x = P.legFR.rotation.x = 0.1; }
      const happy = this.tamed && dist < 5;
      P.tail.rotation.x = (this.kind === 'kitten' ? -0.9 : -0.6) + sit * 0.7;
      P.tail.rotation.y = Math.sin(this.age * (happy ? 14 : 4)) * (happy ? 0.6 : 0.25);
      let df = (this.yawLook || 0) - this.yaw; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283;
      const hl = dist < 6 ? Math.max(-0.9, Math.min(0.9, df)) : 0;
      P.head.rotation.y = hl;
    }
    else if (this.kind === 'hen') { P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.wingL.rotation.z = -(this.onGround ? 0.05 : 1) ; P.wingR.rotation.z = (this.onGround ? 0.05 : 1); P.head.position.z = 4 / 16 + Math.max(0, Math.sin(this.walk * 2)) * 0.02 * this.walkAmt; }
    else if (d.biped) {
      P.legL.rotation.x = sw; P.legR.rotation.x = -sw;
      this.armUp = Math.max(0, (this.armUp || 0) - dt);
      const raise = d.ai === 'melee' && this.target ? -1.4 : d.ai === 'ranged' && this.target ? -1.45 : 0;
      P.armL.rotation.x = raise ? raise + (this.armUp > 0 ? Math.sin(this.armUp * 10) * 0.5 : 0) : -sw; P.armR.rotation.x = raise ? raise : sw;
      if (d.ai === 'ranged') { P.armR.rotation.y = this.target ? -0.1 : 0; if (P.bow) P.bow.visible = true; }
      if (P.head) P.head.rotation.y = look;
    }
    if (this.kind === 'ram' && P.wool) P.wool.visible = !this.sheared;
    // вспышка урона и свет
    const f = this.model.mat;
    let flash = this.hurtT > 0 ? 1 : 0;
    if (this.fuse >= 0) { flash = Math.floor(this.fuse * 8) % 2 === 0 ? 0.6 : 0; const s = 1 + (1.5 - this.fuse) * 0.18; this.mesh.scale.set(s, s, s); }
    if (flash > 0 && this.hurtT > 0) f.color.setRGB(1, 0.35, 0.35); else if (flash > 0) f.color.setRGB(2, 2, 2); else f.color.setScalar(this.bright || 1);
    if (this.burnT > 0) f.color.setRGB(1.2, 0.7, 0.4);
  }
}

export class Arrow extends Entity {
  constructor(g, x, y, z, vx, vy, vz) {
    super('arrow'); this.x = x; this.y = y; this.z = z; this.vx = vx; this.vy = vy; this.vz = vz; this.w = 0.1; this.h = 0.1; this.stuck = 0;
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.6);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xcdbb90 })); this.mesh.userData.own = true;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.08), new THREE.MeshBasicMaterial({ color: 0x777777 })); tip.position.z = 0.3; this.mesh.add(tip);
  }
  update(dt, g) {
    if (this.stuck > 0) { this.stuck -= dt; if (this.stuck <= 0) this.dead = true; return; }
    if (this.age > 12) { this.dead = true; return; }
    this.vy -= 12 * dt;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, nz = this.z + this.vz * dt;
    const id = g.world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
    if (id && !isLiquid(id) && g.world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)) !== 0 && !require_nonsolid(id)) { this.stuck = 3; g.sfx?.play('arrowhit', { x: nx, y: ny, z: nz }); this.vx = this.vy = this.vz = 0; return; }
    this.x = nx; this.y = ny; this.z = nz;
    const p = g.player;
    if (!p.creative && Math.abs(p.x - nx) < 0.45 && Math.abs(p.z - nz) < 0.45 && ny > p.y && ny < p.y + 1.8) {
      const l = Math.hypot(this.vx, this.vz) || 1;
      g.survival.damage(3 + Math.floor(Math.random() * 2), 'стрела', { x: this.vx / l, z: this.vz / l }); g.sfx?.play('arrowhit', { x: nx, y: ny, z: nz }); this.dead = true; return;
    }
    this.mesh.position.set(nx, ny, nz);
    this.mesh.lookAt(nx + this.vx, ny + this.vy, nz + this.vz);
  }
}
import { SOLID } from '../../world/blocks.js';
function require_nonsolid(id) { return !SOLID[id]; }
