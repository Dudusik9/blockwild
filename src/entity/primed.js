// Подожжённый пороховой бочонок
import * as THREE from 'three';
import { Entity } from './entity.js';
import { moveEntity } from '../player/physics.js';
import { cubeGeometry } from './models.js';
import { BLOCKS, B } from '../world/blocks.js';

export class PrimedKeg extends Entity {
  constructor(g, x, y, z, fuse) {
    super('keg');
    this.w = 0.98; this.h = 0.98; this.x = x; this.y = y; this.z = z; this.fuse = fuse; this.vy = 3; this.vx = 0; this.vz = 0;
    this.mat = new THREE.MeshBasicMaterial({ map: g.entityAtlas, vertexColors: true });
    this.mesh = new THREE.Mesh(cubeGeometry(BLOCKS[B.keg]), this.mat); this.mesh.userData.own = true;
    this.mesh.position.set(x, y + 0.5, z);
    g.sfx?.play('fuse', { x, y, z }, 1);
  }
  update(dt, g) {
    this.vy -= 28 * dt;
    moveEntity(g.world, this, this.vx * dt, this.vy * dt, this.vz * dt, {});
    if (this.hitY) this.vy = 0; if (this.hitX) this.vx = 0; if (this.hitZ) this.vz = 0;
    this.vx *= 0.98; this.vz *= 0.98;
    this.fuse -= dt;
    const flash = Math.floor(this.fuse * 6) % 2 === 0;
    this.mat.color.setScalar(flash ? 2.2 : 1);
    const s = 1 + Math.max(0, 0.5 - this.fuse) * 0.25;
    this.mesh.scale.setScalar(s);
    this.mesh.position.set(this.x, this.y + 0.5 * s, this.z);
    if (Math.random() < dt * 14) g.particles?.smoke(this.x, this.y + 1.1, this.z, 0.2, 0.12, 0.6);
    if (this.fuse <= 0) { this.dead = true; g.explode(this.x, this.y + 0.5, this.z, 3.8, 'keg'); }
  }
}
