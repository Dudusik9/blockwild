// Звук: WebAudio, всё синтезируется на лету (никаких файлов)
import { clamp } from '../core/math.js';

export class Sfx {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.lastPlay = new Map(); this.rainGain = null; this.enabled = true;
  }
  init() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { return false; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.settings.masterVolume;
    this.sfxBus = c.createGain(); this.musicBus = c.createGain(); this.musicBus.gain.value = this.settings.musicVolume;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    this.sfxBus.connect(comp); this.musicBus.connect(comp); comp.connect(this.master); this.master.connect(c.destination);
    // белый шум
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // реверберация
    const rl = Math.floor(c.sampleRate * 2.4), imp = c.createBuffer(2, rl, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const dd = imp.getChannelData(ch); for (let i = 0; i < rl; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6); }
    this.reverb = c.createConvolver(); this.reverb.buffer = imp;
    this.reverbGain = c.createGain(); this.reverbGain.gain.value = 0.45;
    this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.musicBus);
    return true;
  }
  resume() { if (!this.init()) return; if (this.ctx.state === 'suspended') this.ctx.resume(); }
  applyVolumes() { if (!this.ctx) return; this.master.gain.value = this.settings.masterVolume; this.musicBus.gain.value = this.settings.musicVolume; }
  setListener(x, y, z, yaw) { const l = this.listener; l.x = x; l.y = y; l.z = z; l.yaw = yaw; }

  // --- примитивы ---
  _out(pos, vol) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = vol;
    let node = g;
    if (pos) {
      const l = this.listener, dx = pos.x - l.x, dy = pos.y - l.y, dz = pos.z - l.z;
      const dist = Math.hypot(dx, dy, dz);
      const att = clamp(1 - dist / 28, 0, 1); g.gain.value = vol * att * att;
      if (c.createStereoPanner && dist > 0.5) {
        const p = c.createStereoPanner();
        // правая сторона: ось (cos yaw, -sin yaw) в мировых координатах
        const rx = Math.cos(l.yaw), rz = -Math.sin(l.yaw);
        p.pan.value = clamp((dx * rx + dz * rz) / dist, -1, 1) * 0.8;
        g.connect(p); node = p;
      }
    }
    node.connect(this.sfxBus);
    return g;
  }
  noise(o) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = this._out(o.pos, 1);
    const env = c.createGain();
    const a = o.attack || 0.004;
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.3), t + a);
    env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(env); env.connect(g);
    src.start(t, Math.random()); src.stop(t + o.dur + 0.05);
  }
  tone(o) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    if (o.vib) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = o.vib; lg.gain.value = o.f0 * 0.04; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + o.dur + 0.05); }
    const env = c.createGain(); const a = o.attack || 0.005;
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.2), t + a);
    env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(env); env.connect(this._out(o.pos, 1));
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  // --- именованные звуки ---
  play(name, pos, vol = 1, pitch = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) || 0;
    if (now - last < 0.025) return;
    this.lastPlay.set(name, now);
    const v = vol, p = pitch * (0.92 + Math.random() * 0.16);
    const P = pos;
    const [kind, mat] = name.split(':');
    switch (kind) {
      case 'step': this.step(mat, P, v, p); break;
      case 'break': this.digSound(mat, P, v, p, true); break;
      case 'place': this.digSound(mat, P, v, p, false); break;
      case 'hit': this.noise({ pos: P, type: 'lowpass', f0: 600, f1: 120, dur: 0.12, gain: 0.5 * v }); this.tone({ pos: P, f0: 140 * p, f1: 60, dur: 0.12, type: 'triangle', gain: 0.4 * v }); break;
      case 'hurt': this.tone({ pos: P, f0: 330 * p, f1: 120, dur: 0.28, type: 'sawtooth', gain: 0.22 * v, lp: 1400 }); this.noise({ pos: P, type: 'bandpass', f0: 500, f1: 200, dur: 0.2, gain: 0.25 * v }); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise({ pos: P, type: 'bandpass', f0: 1800 * p, q: 3, dur: 0.06, gain: 0.35 * v, delay: i * 0.09 }); break;
      case 'burp': this.tone({ pos: P, f0: 110, f1: 70, dur: 0.35, type: 'sawtooth', gain: 0.25 * v, lp: 500 }); break;
      case 'pop': this.tone({ pos: P, f0: 520 * p, f1: 1000 * p, dur: 0.09, type: 'sine', gain: 0.25 * v }); break;
      case 'click': this.tone({ f0: 880, f1: 660, dur: 0.04, type: 'square', gain: 0.08 * v, lp: 3000 }); break;
      case 'splash': this.noise({ pos: P, type: 'bandpass', f0: 1400, f1: 400, q: 0.7, dur: 0.35, gain: 0.5 * v }); this.noise({ pos: P, type: 'highpass', f0: 3000, dur: 0.15, gain: 0.2 * v }); break;
      case 'explode': this.noise({ pos: P, type: 'lowpass', f0: 2200, f1: 50, dur: 1.5, gain: 1.0 * v, attack: 0.01 }); this.tone({ pos: P, f0: 70, f1: 28, dur: 1.2, type: 'sine', gain: 0.9 * v }); this.noise({ pos: P, type: 'bandpass', f0: 800, f1: 200, dur: 0.6, gain: 0.5 * v, delay: 0.05 }); break;
      case 'fuse': this.noise({ pos: P, type: 'highpass', f0: 3500, dur: 1.2, gain: 0.18 * v, attack: 0.2 }); break;
      case 'thunder': this.noise({ pos: P, type: 'lowpass', f0: 350, f1: 90, dur: 3.2, gain: 0.9 * v, attack: 0.08, delay: 0 }); this.noise({ pos: P, type: 'bandpass', f0: 160, q: 1, dur: 2.2, gain: 0.6 * v, delay: 0.5 }); this.noise({ pos: P, type: 'lowpass', f0: 1500, f1: 200, dur: 0.3, gain: 0.8 * v }); break;
      case 'door': this.tone({ pos: P, f0: 180 * p, f1: 110 * p, dur: 0.14, type: 'triangle', gain: 0.3 * v }); this.noise({ pos: P, type: 'bandpass', f0: 700, dur: 0.1, gain: 0.2 * v }); break;
      case 'chest': this.tone({ pos: P, f0: 130 * p, f1: 200 * p, dur: 0.18, type: 'sawtooth', gain: 0.12 * v, lp: 600 }); this.noise({ pos: P, type: 'bandpass', f0: 500, dur: 0.12, gain: 0.25 * v }); break;
      case 'drip': this.tone({ pos: P, f0: 1500 * p, f1: 700, dur: 0.12, type: 'sine', gain: 0.18 * v }); this.tone({ pos: P, f0: 3000 * p, f1: 1400, dur: 0.05, type: 'sine', gain: 0.05 * v, delay: 0.01 }); break;
      case 'arrow': this.noise({ pos: P, type: 'bandpass', f0: 2500, f1: 800, q: 1.5, dur: 0.25, gain: 0.25 * v }); break;
      case 'arrowhit': this.noise({ pos: P, type: 'lowpass', f0: 900, dur: 0.07, gain: 0.4 * v }); this.tone({ pos: P, f0: 300, f1: 200, dur: 0.06, type: 'square', gain: 0.1 * v }); break;
      case 'craft': this.tone({ f0: 500 * p, f1: 800 * p, dur: 0.08, type: 'triangle', gain: 0.15 * v }); this.noise({ type: 'bandpass', f0: 2000, dur: 0.05, gain: 0.1 }); break;
      case 'break_tool': this.tone({ pos: P, f0: 420, f1: 120, dur: 0.25, type: 'sawtooth', gain: 0.2 * v, lp: 1200 }); this.noise({ pos: P, type: 'highpass', f0: 2000, dur: 0.15, gain: 0.3 * v }); break;
      case 'death': this.tone({ f0: 200, f1: 40, dur: 1.2, type: 'sawtooth', gain: 0.25, lp: 700 }); break;
      case 'mob': this.mobSound(mat, P, v, p); break;
    }
  }
  step(mat, P, v, p) {
    const g = 0.22 * v;
    switch (mat) {
      case 'stone': this.noise({ pos: P, type: 'bandpass', f0: 1100 * p, q: 1.2, dur: 0.07, gain: g }); this.tone({ pos: P, f0: 150 * p, f1: 90, dur: 0.06, type: 'triangle', gain: g * 0.8 }); break;
      case 'wood': this.noise({ pos: P, type: 'lowpass', f0: 900 * p, dur: 0.06, gain: g }); this.tone({ pos: P, f0: 220 * p, f1: 150, dur: 0.07, type: 'triangle', gain: g * 0.9 }); break;
      case 'grass': case 'plant': this.noise({ pos: P, type: 'highpass', f0: 1800 * p, dur: 0.09, gain: g * 0.7, attack: 0.02 }); this.noise({ pos: P, type: 'lowpass', f0: 500, dur: 0.07, gain: g * 0.5 }); break;
      case 'sand': this.noise({ pos: P, type: 'bandpass', f0: 2600 * p, q: 0.6, dur: 0.1, gain: g * 0.7, attack: 0.015 }); break;
      case 'gravel': this.noise({ pos: P, type: 'bandpass', f0: 1500 * p, q: 0.8, dur: 0.05, gain: g }); this.noise({ pos: P, type: 'bandpass', f0: 2300 * p, dur: 0.05, gain: g * 0.7, delay: 0.04 }); break;
      case 'cloth': this.noise({ pos: P, type: 'lowpass', f0: 500 * p, dur: 0.08, gain: g * 0.6, attack: 0.02 }); break;
      case 'glass': this.tone({ pos: P, f0: 2400 * p, f1: 2100, dur: 0.09, type: 'sine', gain: g * 0.4 }); this.noise({ pos: P, type: 'highpass', f0: 4000, dur: 0.03, gain: g * 0.4 }); break;
      case 'snow': this.noise({ pos: P, type: 'bandpass', f0: 3000 * p, q: 0.5, dur: 0.1, gain: g * 0.6, attack: 0.02 }); this.noise({ pos: P, type: 'lowpass', f0: 400, dur: 0.06, gain: g * 0.5 }); break;
      case 'water': this.noise({ pos: P, type: 'bandpass', f0: 900 * p, f1: 500, q: 1.5, dur: 0.14, gain: g * 0.9 }); break;
      default: this.noise({ pos: P, type: 'bandpass', f0: 1000 * p, dur: 0.07, gain: g });
    }
  }
  digSound(mat, P, v, p, brk) {
    const g = (brk ? 0.5 : 0.38) * v, n = brk ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const dly = i * 0.045;
      switch (mat) {
        case 'stone': this.noise({ pos: P, type: 'bandpass', f0: (900 + i * 300) * p, q: 1.5, dur: 0.1, gain: g, delay: dly }); if (i === 0) this.tone({ pos: P, f0: 120 * p, f1: 70, dur: 0.1, type: 'triangle', gain: g * 0.7 }); break;
        case 'wood': this.noise({ pos: P, type: 'lowpass', f0: 1000 * p, dur: 0.08, gain: g, delay: dly }); this.tone({ pos: P, f0: (260 - i * 30) * p, f1: 150, dur: 0.09, type: 'triangle', gain: g * 0.7, delay: dly }); break;
        case 'grass': case 'plant': this.noise({ pos: P, type: 'highpass', f0: 1600 * p, dur: 0.1, gain: g * 0.7, delay: dly, attack: 0.015 }); break;
        case 'sand': this.noise({ pos: P, type: 'bandpass', f0: 2400 * p, q: 0.6, dur: 0.12, gain: g * 0.7, delay: dly, attack: 0.02 }); break;
        case 'gravel': this.noise({ pos: P, type: 'bandpass', f0: (1300 + i * 400) * p, dur: 0.07, gain: g, delay: dly }); break;
        case 'cloth': this.noise({ pos: P, type: 'lowpass', f0: 600 * p, dur: 0.1, gain: g * 0.6, delay: dly, attack: 0.02 }); break;
        case 'glass': this.tone({ pos: P, f0: (2200 + i * 500) * p, f1: 1800, dur: 0.15, type: 'sine', gain: g * 0.4, delay: dly }); this.noise({ pos: P, type: 'highpass', f0: 3500, dur: 0.1, gain: g * 0.6, delay: dly }); break;
        case 'snow': this.noise({ pos: P, type: 'bandpass', f0: 3200 * p, q: 0.5, dur: 0.1, gain: g * 0.6, delay: dly, attack: 0.02 }); break;
        default: this.noise({ pos: P, type: 'bandpass', f0: 1000 * p, dur: 0.08, gain: g, delay: dly });
      }
    }
  }
  mobSound(kind, P, v, p) {
    const g = 0.25 * v;
    switch (kind) {
      case 'ram': this.tone({ pos: P, f0: 330 * p, f1: 250 * p, dur: 0.5, type: 'sawtooth', gain: g * 0.7, vib: 18, lp: 1100 }); break;
      case 'hen': this.tone({ pos: P, f0: 900 * p, f1: 700, dur: 0.07, type: 'square', gain: g * 0.4, lp: 2500 }); this.tone({ pos: P, f0: 1000 * p, f1: 800, dur: 0.07, type: 'square', gain: g * 0.4, lp: 2500, delay: 0.1 }); break;
      case 'boar': this.tone({ pos: P, f0: 200 * p, f1: 110, dur: 0.3, type: 'sawtooth', gain: g * 0.8, lp: 700 }); this.noise({ pos: P, type: 'bandpass', f0: 400, dur: 0.25, gain: g * 0.4 }); break;
      case 'swamper': this.tone({ pos: P, f0: 95 * p, f1: 70, dur: 0.7, type: 'sawtooth', gain: g * 0.9, vib: 6, lp: 500 }); break;
      case 'archer': for (let i = 0; i < 4; i++) this.noise({ pos: P, type: 'highpass', f0: 3000, dur: 0.04, gain: g * 0.5, delay: i * 0.06 }); break;
      case 'bomber': this.noise({ pos: P, type: 'highpass', f0: 3800, dur: 1.4, gain: g * 0.7, attack: 0.3 }); break;
      case 'kitten': // мяу: подъём и спад высоты
        this.tone({ pos: P, f0: 620 * p, f1: 980 * p, dur: 0.16, type: 'triangle', gain: g * 0.55, lp: 2600, attack: 0.03 });
        this.tone({ pos: P, f0: 980 * p, f1: 540 * p, dur: 0.34, type: 'triangle', gain: g * 0.5, lp: 2200, vib: 7, delay: 0.15 });
        break;
      case 'puppy': // гав-гав
        for (let i = 0; i < 2; i++) {
          this.tone({ pos: P, f0: 520 * p, f1: 330 * p, dur: 0.11, type: 'sawtooth', gain: g * 0.45, lp: 1600, delay: i * 0.2 });
          this.noise({ pos: P, type: 'bandpass', f0: 900 * p, q: 1.2, dur: 0.08, gain: g * 0.3, delay: i * 0.2 });
        }
        break;
      case 'purr': for (let i = 0; i < 3; i++) this.tone({ pos: P, f0: 48, f1: 44, dur: 0.45, type: 'sawtooth', gain: g * 0.35, lp: 320, vib: 22, attack: 0.08, delay: i * 0.5 }); break;
      case 'hurt': this.tone({ pos: P, f0: 260 * p, f1: 130, dur: 0.22, type: 'sawtooth', gain: g, lp: 900 }); break;
      case 'death': this.tone({ pos: P, f0: 240 * p, f1: 50, dur: 0.5, type: 'sawtooth', gain: g, lp: 800 }); break;
    }
  }

  // --- постоянные источники ---
  setRain(level) {
    const c = this.ctx; if (!c) return;
    if (!this.rainGain) {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.35;
      const f2 = c.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 800;
      this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
      src.connect(f); f.connect(f2); f2.connect(this.rainGain); this.rainGain.connect(this.sfxBus); src.start();
      // ветер
      const w = c.createBufferSource(); w.buffer = this.noiseBuf; w.loop = true; w.playbackRate.value = 0.3;
      const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 400;
      this.windGain = c.createGain(); this.windGain.gain.value = 0; w.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.sfxBus); w.start();
    }
    this.rainGain.gain.setTargetAtTime(level * 0.2, c.currentTime, 0.3);
  }
  setWind(level) { if (this.windGain) this.windGain.gain.setTargetAtTime(level * 0.1, this.ctx.currentTime, 0.5); }
  // нота для музыки
  note(freq, t, dur, gain = 0.12, type = 'sine') {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2.001;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = c.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.musicBus); g.connect(this.reverb);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
}
