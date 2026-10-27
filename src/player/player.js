// Игрок: состояние и физика движения
import { moveEntity, boxIntersects } from './physics.js';
import { B, isLiquid, isLava, isWater } from '../world/blocks.js';
import { clamp } from '../core/math.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.x = 0; this.y = 100; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.w = 0.6; this.h = 1.8;
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.flying = false; this.sneaking = false; this.sprinting = false;
    this.inWater = false; this.headInWater = false; this.inLava = false;
    this.mode = 'survival';
    this.peakY = 0; this.fell = 0; this.landed = 0; // landed — «сила» приземления для звука/урона
    this.walkDist = 0; this.stepAcc = 0;
    this.jumpHeld = false; this.lastJumpTap = -10; this.spaceWasDown = false;
    this.sneakAmt = 0;
    this.moving = false;
    this.swing = 0;
    this.stepEvent = false;
  }
  get eye() { return 1.62 - this.sneakAmt * 0.12; }
  get creative() { return this.mode === 'creative'; }
  setPos(x, y, z) { this.x = x; this.y = y; this.z = z; this.vx = this.vy = this.vz = 0; this.peakY = y; }
  fluidAt(dy) {
    const id = this.world.getBlock(Math.floor(this.x), Math.floor(this.y + dy), Math.floor(this.z));
    return id;
  }
  update(dt, inp, time) {
    const world = this.world;
    this.sneaking = inp.sneak && !this.flying;
    this.sneakAmt += ((this.sneaking ? 1 : 0) - this.sneakAmt) * Math.min(1, dt * 14);
    const f1 = this.fluidAt(0.1), f2 = this.fluidAt(0.9), fh = this.fluidAt(this.eye);
    this.inWater = isWater(f1) || isWater(f2);
    this.inLava = isLava(f1) || isLava(f2);
    this.headInWater = isWater(fh);
    this.headInLava = isLava(fh);
    // двойной пробел — полёт в творческом режиме
    if (inp.jump && !this.spaceWasDown) {
      if (this.creative) {
        if (time - this.lastJumpTap < 0.3) { this.flying = !this.flying; this.lastJumpTap = -10; this.vy = 0; }
        else this.lastJumpTap = time;
      }
    }
    this.spaceWasDown = inp.jump;
    if (!this.creative) this.flying = false;
    if (this.flying && this.onGround && !inp.jump) { /* оставаться в полёте */ }

    // желаемое направление
    let fx = 0, fz = 0;
    if (inp.forward) fz -= 1; if (inp.back) fz += 1; if (inp.left) fx -= 1; if (inp.right) fx += 1;
    const len = Math.hypot(fx, fz);
    this.moving = len > 0;
    if (len > 0) { fx /= len; fz /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = fx * cos + fz * sin, wz = -fx * sin + fz * cos;
    this.sprinting = inp.sprint && inp.forward && !this.sneaking && (this.food === undefined || this.food > 6 || this.creative);
    let speed = this.sneaking ? 1.35 : this.sprinting ? 5.7 : 4.3;
    if (this.flying) speed = this.sprinting ? 21 : 10.9;
    if (this.inWater && !this.flying) speed *= 0.55;
    if (this.inLava && !this.flying) speed *= 0.35;

    if (this.flying) {
      const tvx = wx * speed, tvz = wz * speed;
      const a = 14 * dt;
      this.vx += clamp(tvx - this.vx, -a * 4, a * 4); this.vz += clamp(tvz - this.vz, -a * 4, a * 4);
      const tvy = inp.jump ? 8 : inp.sneak ? -8 : 0;
      this.vy += clamp(tvy - this.vy, -a * 4, a * 4);
    } else {
      const acc = this.onGround ? 70 : (this.inWater ? 22 : 18);
      const tvx = wx * speed, tvz = wz * speed;
      const mx = clamp(tvx - this.vx, -acc * dt, acc * dt), mz = clamp(tvz - this.vz, -acc * dt, acc * dt);
      this.vx += mx; this.vz += mz;
      if (!this.onGround && !this.inWater && !this.inLava && len === 0) { this.vx *= Math.pow(0.9, dt * 20); this.vz *= Math.pow(0.9, dt * 20); }
      if (this.inWater || this.inLava) {
        const g = this.inLava ? 4 : 7;
        this.vy -= g * dt;
        this.vy *= Math.pow(this.inLava ? 0.6 : 0.82, dt * 20);
        if (inp.jump) this.vy += (this.inLava ? 14 : 22) * dt * (this.vy < 3.4 ? 1 : 0.2);
        if (this.headInWater === false && inp.jump && this.vy > 0 && this.vy < 4) { /* выход из воды */ }
        if (inp.sneak) this.vy -= 12 * dt;
      } else {
        this.vy -= 32 * dt;
        if (this.vy < -78) this.vy = -78;
        if (inp.jump && this.onGround) { this.vy = 9.0; this.onGround = false; this.stepEvent = false; this.jumped = true; }
      }
    }

    // перемещение
    const wasGround = this.onGround;
    moveEntity(world, this, this.vx * dt, this.vy * dt, this.vz * dt, { step: (this.flying || this.inWater) ? 0.05 : 0.55, sneakEdge: this.sneaking && !this.flying });
    if (this.hitX) this.vx = 0;
    if (this.hitZ) this.vz = 0;
    if (this.hitY) this.vy = 0;
    if (this.onGround && this.flying && !inp.jump && this.creative) { /* остаёмся в полёте — спуск при sneak */ }
    if (this.flying && this.onGround && inp.sneak) this.flying = false;

    // падение
    if (this.onGround || this.inWater || this.flying || this.inLava) {
      if (this.onGround && !wasGround && !this.flying) { this.landed = Math.max(0, this.peakY - this.y); this.fell = this.landed; }
      else this.fell = 0;
      if (this.inWater || this.flying) { this.peakY = this.y; this.fell = 0; }
      if (this.onGround) this.peakY = this.y;
    } else { if (this.y > this.peakY) this.peakY = this.y; this.fell = 0; }

    // шаги
    this.stepEvent = false;
    if (this.onGround && !this.flying) {
      const sp = Math.hypot(this.vx, this.vz);
      this.stepAcc += sp * dt;
      const stride = this.sneaking ? 2.4 : this.sprinting ? 1.7 : 2.0;
      if (this.stepAcc > stride) { this.stepAcc = 0; this.stepEvent = true; }
      this.walkDist += sp * dt;
    } else if (this.inWater) {
      const sp = Math.hypot(this.vx, this.vz, this.vy * 0.3);
      this.stepAcc += sp * dt; if (this.stepAcc > 2.2) { this.stepAcc = 0; this.stepEvent = true; }
    }
    // не проваливаться под мир
    if (this.y < -30) { this.y = -30; this.vy = 0; this.voidDamage = true; }
  }
  intersects() { return boxIntersects(this.world, this.x, this.y, this.z, this.w, this.h); }
  dirVec(out) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    out.x = -Math.sin(this.yaw) * cp; out.y = sp; out.z = -Math.cos(this.yaw) * cp; return out;
  }
}
