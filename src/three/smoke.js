import * as THREE from 'three';

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = 64 + (Math.random() - 0.5) * 50;
    const y = 64 + (Math.random() - 0.5) * 50;
    const r = 22 + Math.random() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Exhaust smoke: a pool of billboard sprites that drift back, rise, grow and fade. */
export class Smoke {
  constructor(scene, emitters, max = 90) {
    this.emitters = emitters;
    this.rate = 0;
    this.acc = 0;
    this.pool = [];
    const map = puffTexture();
    for (let i = 0; i < max; i++) {
      const mat = new THREE.SpriteMaterial({ map, color: 0xaab0b8, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      s.userData = { life: 0, ttl: 1, vel: new THREE.Vector3(), spin: 0, size: 1 };
      scene.add(s);
      this.pool.push(s);
    }
    this.next = 0;
  }

  /** One puff per emitter right now (used for the "rev" burst). */
  burst(count = 6) {
    for (let i = 0; i < count; i++) this.emitters.forEach((e) => this.spawn(e, 1.6));
  }

  spawn(origin, power = 1) {
    const s = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    const d = s.userData;
    d.life = 0;
    d.ttl = 1.6 + Math.random() * 1.4;
    d.vel.set(-0.8 - Math.random() * 0.9 * power, 0.04 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3);
    d.spin = (Math.random() - 0.5) * 1.2;
    d.size = 0.6 + Math.random() * 0.7;
    d.power = power;
    s.position.copy(origin);
    s.material.rotation = Math.random() * Math.PI * 2;
    s.visible = true;
  }

  update(dt) {
    this.acc += dt * this.rate * 14;
    while (this.acc > 1) {
      this.acc -= 1;
      this.emitters.forEach((e) => this.spawn(e));
    }
    for (const s of this.pool) {
      if (!s.visible) continue;
      const d = s.userData;
      d.life += dt;
      const t = d.life / d.ttl;
      if (t >= 1) {
        s.visible = false;
        continue;
      }
      d.vel.multiplyScalar(1 - dt * 1.1);
      d.vel.y += dt * 0.22;
      s.position.addScaledVector(d.vel, dt);
      s.material.rotation += d.spin * dt;
      const scale = (0.06 + t * 0.9) * d.size;
      s.scale.set(scale, scale, scale);
      s.material.opacity = Math.min(1, t * 5) * Math.pow(1 - t, 1.6) * 0.2 * Math.min(1, d.power);
    }
  }
}
