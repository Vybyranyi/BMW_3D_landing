import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Honeycomb mesh for the M Sport bumper intakes. */
function honeycomb() {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#050506';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2c30';
    g.lineWidth = 5;
    const r = 16;
    const dx = r * Math.sqrt(3);
    for (let row = -1; row < h / (r * 1.5) + 1; row++) {
      for (let col = -1; col < w / dx + 1; col++) {
        const cx = col * dx + (row % 2 ? dx / 2 : 0);
        const cy = row * r * 1.5;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          if (k) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.closePath();
        g.stroke();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 2);
  return t;
}

/** BMW-style roundel for hood/trunk/wheel caps. */
export function roundelTexture() {
  return canvasTexture(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#0a0a0a';
    g.beginPath();
    g.arc(c, c, c - 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c9ccd1';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(c, c, c - 6, 0, Math.PI * 2);
    g.stroke();
    const r = c * 0.62;
    const quads = ['#ffffff', '#1c69d4', '#ffffff', '#1c69d4'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = quads[i];
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, r, -Math.PI / 2 + (i * Math.PI) / 2, (i * Math.PI) / 2);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = '#c9ccd1';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#e8e8e8';
    g.font = '700 46px Manrope, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const letters = ['B', 'M', 'W'];
    letters.forEach((l, i) => {
      const a = -Math.PI / 2 - 0.62 + i * 0.62;
      g.save();
      g.translate(c + Math.cos(a) * c * 0.8, c + Math.sin(a) * c * 0.8);
      g.rotate(a + Math.PI / 2);
      g.fillText(l, 0, 0);
      g.restore();
    });
  });
}

export function badgeTexture(text) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#e9ecef';
    g.font = '600 92px Manrope, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

export function engineCoverTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#121315';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1b1c1f';
    g.lineWidth = 10;
    for (let x = -h; x < w; x += 28) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + h, 0);
      g.stroke();
    }
    g.fillStyle = '#16171a';
    g.fillRect(w * 0.18, h * 0.3, w * 0.64, h * 0.4);
    g.fillStyle = '#c7cbd1';
    g.font = '600 38px Manrope, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TwinPower Turbo', w / 2, h / 2);
  });
}

export function createMaterials() {
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xf4f5f3,
    roughness: 0.32,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.0,
  });
  const inner = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9, side: THREE.BackSide });
  const gloss = new THREE.MeshPhysicalMaterial({
    color: 0x040405,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  });
  const satin = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.55, metalness: 0.1 });
  const under = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.95, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0b0e12,
    roughness: 0.05,
    metalness: 0.0,
    transparent: true,
    opacity: 0.8,
    envMapIntensity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.08, metalness: 1 });
  const darkChrome = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.18, metalness: 1 });
  const honey = new THREE.MeshStandardMaterial({ map: honeycomb(), roughness: 0.6, metalness: 0.2 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x121213, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const rim = new THREE.MeshPhysicalMaterial({
    color: 0x9a9da3,
    roughness: 0.3,
    metalness: 0.9,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
  });
  const disc = new THREE.MeshStandardMaterial({ color: 0x7c7f84, roughness: 0.42, metalness: 0.9 });
  const caliper = new THREE.MeshPhysicalMaterial({ color: 0x1a4fa3, roughness: 0.35, clearcoat: 1 });
  const lens = new THREE.MeshPhysicalMaterial({
    color: 0x0d0f12,
    roughness: 0.05,
    metalness: 0.6,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  const drl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeeff, emissiveIntensity: 0 });
  const tailLens = new THREE.MeshPhysicalMaterial({
    color: 0x3a0306,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    emissive: 0xff1020,
    emissiveIntensity: 0,
  });
  const tailLed = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2a1a, emissiveIntensity: 0 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.55, metalness: 0.05 });
  const alcantara = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.95 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x050608, emissive: 0x1b4a8a, emissiveIntensity: 0.2, roughness: 0.2 });
  const mRed = new THREE.MeshStandardMaterial({ color: 0xc8102e, emissive: 0x400008, roughness: 0.4 });
  const roundel = new THREE.MeshStandardMaterial({ map: roundelTexture(), roughness: 0.25, metalness: 0.3, transparent: true });
  const badge = new THREE.MeshStandardMaterial({ map: badgeTexture('330i'), roughness: 0.15, metalness: 1, transparent: true });
  const engineCover = new THREE.MeshStandardMaterial({ map: engineCoverTexture(), roughness: 0.6, metalness: 0.1 });
  const engineMetal = new THREE.MeshStandardMaterial({ color: 0x3c3f44, roughness: 0.5, metalness: 0.7 });
  const reservoir = new THREE.MeshStandardMaterial({ color: 0xd9d6c8, roughness: 0.5, transparent: true, opacity: 0.9 });
  const capYellow = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.4 });
  const capBlue = new THREE.MeshStandardMaterial({ color: 0x1d5fd1, roughness: 0.4 });
  return {
    paint, inner, gloss, satin, under, glass, chrome, darkChrome, honey, tire, rim, disc, caliper,
    lens, drl, tailLens, tailLed, leather, alcantara, screen, mRed, roundel, badge, engineCover,
    engineMetal, reservoir, capYellow, capBlue,
  };
}
