// Рамка выделения блока и трещины разрушения (10 стадий)
import * as THREE from 'three';
import { crackStages } from './textures.js';

export class Selection {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    const g = new THREE.BoxGeometry(1, 1, 1);
    const eg = new THREE.EdgesGeometry(g);
    this.lines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75 }));
    this.lines.renderOrder = 5;
    this.group.add(this.lines);
    // трещины
    this.crackTex = crackStages().map((d) => {
      const t = new THREE.DataTexture(new Uint8Array(d.buffer), 16, 16, THREE.RGBAFormat);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; t.flipY = false; return t;
    });
    this.crackMat = new THREE.MeshBasicMaterial({ map: this.crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.crack = new THREE.Mesh(g, this.crackMat); this.crack.visible = false; this.crack.renderOrder = 4;
    this.group.add(this.crack);
  }
  setTarget(hit) {
    if (!hit || !hit.hit) { this.group.visible = false; return; }
    this.group.visible = true;
    // охватывающий бокс из выделяемых боксов
    let x0 = 1, y0 = 1, z0 = 1, x1 = 0, y1 = 0, z1 = 0;
    for (const b of hit.boxes || [[0, 0, 0, 1, 1, 1]]) { x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); z0 = Math.min(z0, b[2]); x1 = Math.max(x1, b[3]); y1 = Math.max(y1, b[4]); z1 = Math.max(z1, b[5]); }
    const e = 0.004;
    this.group.position.set(hit.x + (x0 + x1) / 2, hit.y + (y0 + y1) / 2, hit.z + (z0 + z1) / 2);
    this.group.scale.set(x1 - x0 + e * 2, y1 - y0 + e * 2, z1 - z0 + e * 2);
  }
  setCrack(progress) { // 0..1, <=0 — скрыть
    if (progress <= 0.01) { this.crack.visible = false; return; }
    this.crack.visible = true;
    this.crackMat.map = this.crackTex[Math.min(9, Math.floor(progress * 10))];
  }
}
