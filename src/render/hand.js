// Рука и предмет от первого лица: покачивание, анимация удара, смена слота
import * as THREE from 'three';
import { itemModel } from '../entity/models.js';
import { lightBrightness } from '../entity/items-drop.js';

export class Hand {
  constructor(game) {
    this.g = game;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.armMat = new THREE.MeshBasicMaterial({ color: 0xc89464 });
    this.sleeveMat = new THREE.MeshBasicMaterial({ color: 0x3c7a52 });
    this.arm = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.4), this.armMat); a.position.z = -0.12;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.3), this.sleeveMat); s.position.z = 0.2;
    this.arm.add(a); this.arm.add(s);
    this.root.add(this.arm);
    this.itemGroup = new THREE.Group(); this.root.add(this.itemGroup);
    this.itemMat = new THREE.MeshBasicMaterial({ map: game.entityAtlas, vertexColors: true, alphaTest: 0.5 });
    this.itemMesh = null; this.curId = -2; this.swing = 0; this.swinging = false; this.dip = 0; this.lastSel = -1;
    this.bobT = 0; this.eat = 0; this.bright = 1;
  }
  resize(aspect) { this.cam.aspect = aspect; this.cam.updateProjectionMatrix(); }
  punch() { if (!this.swinging) { this.swinging = true; this.swing = 0; } }
  setItem(id) {
    if (id === this.curId) return;
    this.curId = id;
    if (this.itemMesh) { this.itemGroup.remove(this.itemMesh); this.itemMesh = null; }
    if (id < 0) return;
    const m = itemModel(id);
    this.itemMesh = new THREE.Mesh(m.geo, this.itemMat);
    this.flat = m.flat;
    this.itemGroup.add(this.itemMesh);
  }
  update(dt) {
    const g = this.g, p = g.player, inv = g.inventory;
    const st = inv.slots[inv.selected];
    if (inv.selected !== this.lastSel) { this.lastSel = inv.selected; this.dip = 1; }
    if (this.dip > 0) { this.dip -= dt * 5; if (this.dip < 0.5 && this.curId !== (st ? st.id : -1)) this.setItem(st ? st.id : -1); }
    else if (this.curId !== (st ? st.id : -1)) this.setItem(st ? st.id : -1);
    if (this.swinging) { this.swing += dt * 4.2; if (this.swing >= 1) { this.swinging = false; this.swing = 0; } }
    const sp = Math.hypot(p.vx, p.vz) * (p.onGround ? 1 : 0);
    this.bobT += dt * sp * 2.1;
    const bx = Math.sin(this.bobT) * 0.018 * Math.min(1, sp / 4), by = -Math.abs(Math.cos(this.bobT)) * 0.02 * Math.min(1, sp / 4);
    const sw = Math.sin(this.swing * Math.PI), sw2 = Math.sin(Math.sqrt(this.swing) * Math.PI);
    const dip = Math.max(0, this.dip) * 0.5;
    const eatAnim = this.eat > 0 ? Math.sin(g.clock * 22) * 0.02 : 0;
    this.root.position.set(0.34 + bx - sw2 * 0.1, -0.3 + by - dip - sw * 0.07 + eatAnim, -0.5 - sw * 0.14);
    this.root.rotation.set(-sw * 0.9 + (this.eat > 0 ? -0.6 : 0), -sw2 * 0.4, sw2 * 0.15);
    // руку видно только без предмета или всегда? — показываем всегда, предмет поверх
    this.arm.position.set(0.08, -0.1, 0.2); this.arm.rotation.set(0.3, 0.2, 0);
    this.arm.visible = !this.itemMesh || !this.flat || true;
    if (this.itemMesh) {
      if (this.flat) {
        this.itemGroup.position.set(0.0, 0.08, -0.22); this.itemGroup.rotation.set(0.1, 1.0, -0.15); this.itemGroup.scale.setScalar(0.5);
      } else {
        this.itemGroup.position.set(-0.02, 0.0, -0.16); this.itemGroup.rotation.set(0.1, -0.7, 0.05); this.itemGroup.scale.setScalar(0.26);
      }
    }
    this.bright += (lightBrightness(g.world, p.x, p.y + 1, p.z, g.sky.daylight) - this.bright) * Math.min(1, dt * 5);
    this.itemMat.color.setScalar(this.bright); this.armMat.color.setRGB(0.78 * this.bright, 0.58 * this.bright, 0.39 * this.bright); this.sleeveMat.color.setRGB(0.24 * this.bright, 0.48 * this.bright, 0.32 * this.bright);
  }
  render(renderer) {
    renderer.autoClear = false; renderer.clearDepth();
    renderer.render(this.scene, this.cam);
    renderer.autoClear = true;
  }
}
