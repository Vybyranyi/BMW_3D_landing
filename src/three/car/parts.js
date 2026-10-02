import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DIM, halfWidth, yBottom } from './profile.js';
import { mirrorZ } from './patch.js';

const box = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/* ---------------------------------------------------------------- wheels */

function tireGeometry(radius, width) {
  const rimR = 0.2286 + 0.012;
  const hw = width / 2;
  const pts = [];
  // Cross-section of the tyre from inner bead around the tread to the outer bead.
  const prof = [
    [rimR, -hw * 0.86], [rimR + 0.02, -hw * 0.95], [radius - 0.05, -hw], [radius - 0.018, -hw * 0.94],
    [radius - 0.004, -hw * 0.8], [radius, -hw * 0.55], [radius, hw * 0.55], [radius - 0.004, hw * 0.8],
    [radius - 0.018, hw * 0.94], [radius - 0.05, hw], [rimR + 0.02, hw * 0.95], [rimR, hw * 0.86],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 72);
  g.rotateX(Math.PI / 2);
  return g;
}

function rimGroup(m, width) {
  const g = new THREE.Group();
  const R = 0.2286;
  const face = width / 2 - 0.012;
  // Barrel + lip
  const barrel = new THREE.CylinderGeometry(R, R, width - 0.02, 64, 1, true);
  barrel.rotateX(Math.PI / 2);
  g.add(mesh(barrel, m.darkChrome));
  const lip = new THREE.TorusGeometry(R - 0.004, 0.009, 10, 72);
  lip.translate(0, 0, face);
  g.add(mesh(lip, m.rim));
  // Dish behind the spokes
  const dish = new THREE.CircleGeometry(R - 0.01, 48);
  dish.translate(0, 0, face - 0.07);
  g.add(mesh(dish, new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.8 })));
  // 5 double spokes (M style)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    for (const off of [-0.11, 0.11]) {
      const spoke = new THREE.BoxGeometry(0.17, 0.026, 0.03);
      spoke.translate(0.105, 0, 0);
      const sm = mesh(spoke, m.rim);
      sm.rotation.z = a + off;
      sm.position.z = face - 0.022;
      // slight concavity
      sm.rotation.y = -0.18;
      g.add(sm);
    }
  }
  // Hub + centre cap
  const hub = new THREE.CylinderGeometry(0.06, 0.07, 0.05, 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, m.rim, 0, 0, face - 0.03));
  const cap = new THREE.CircleGeometry(0.034, 32);
  g.add(mesh(cap, m.roundel, 0, 0, face - 0.0045));
  // Lug bolts
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    const bolt = new THREE.CylinderGeometry(0.008, 0.008, 0.02, 10);
    bolt.rotateX(Math.PI / 2);
    g.add(mesh(bolt, m.chrome, Math.cos(a) * 0.05, Math.sin(a) * 0.05, face - 0.01));
  }
  return g;
}

export function buildWheel(m, { width, front }) {
  const wheel = new THREE.Group(); // stays still (steering); spinner rotates
  const spinner = new THREE.Group();
  spinner.add(mesh(tireGeometry(DIM.wheelR, width), m.tire));
  spinner.add(rimGroup(m, width));
  wheel.add(spinner);
  // Brake disc + caliper (do not spin)
  const disc = new THREE.CylinderGeometry(front ? 0.17 : 0.16, front ? 0.17 : 0.16, 0.026, 48);
  disc.rotateX(Math.PI / 2);
  wheel.add(mesh(disc, m.disc, 0, 0, -0.02));
  const cal = box(0.13, 0.07, 0.07, 0.015);
  const caliper = mesh(cal, m.caliper, 0, 0, 0.0);
  const calAngle = front ? Math.PI * 0.82 : Math.PI * 0.18;
  caliper.position.set(Math.cos(calAngle) * 0.15, Math.sin(calAngle) * 0.15, -0.015);
  caliper.rotation.z = calAngle - Math.PI / 2;
  wheel.add(caliper);
  return { wheel, spinner };
}

/** Dark wheel-well liner so you don't see through the arch. */
export function wellLiner(m, x) {
  const g = new THREE.Group();
  const r = DIM.archR + 0.006;
  const depth = DIM.halfWidth - DIM.wellZ + 0.02;
  const tube = new THREE.CylinderGeometry(r, r, depth, 48, 1, true, -Math.PI * 0.62, Math.PI * 1.24);
  tube.rotateX(Math.PI / 2);
  tube.rotateZ(Math.PI / 2);
  const inner = new THREE.CircleGeometry(r, 48, -0.1, Math.PI + 0.2);
  for (const side of [1, -1]) {
    const t = mesh(tube, m.under, x, DIM.archY, side * (DIM.wellZ + depth / 2 - 0.01));
    g.add(t);
    const w = mesh(inner, m.under, x, DIM.archY, side * DIM.wellZ);
    w.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(w);
  }
  return g;
}

/* ---------------------------------------------------------------- M Performance aero */

function planShape(outer, inner) {
  const s = new THREE.Shape();
  outer.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
  for (let i = inner.length - 1; i >= 0; i--) s.lineTo(inner[i][0], inner[i][1]);
  s.closePath();
  return s;
}

/** Shape in plan (x, z) extruded downward by `thick`, top face at y. */
function planSlab(shape, y, thick, bevel = 0.004) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 24,
  });
  g.rotateX(Math.PI / 2); // shape (x, z) → car plan, extrusion goes downward
  g.translate(0, y, 0);
  return g;
}

export function frontSplitter(m) {
  const outer = [];
  const inner = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // -side → nose → +side
    const a = (t - 0.5) * Math.PI; // -90°..90°
    const x = 1.66 + (DIM.xFront - 1.66) * Math.pow(Math.cos(a), 0.55);
    const zSign = Math.sign(a) || 0;
    const xx = Math.min(x, DIM.xFront - 0.0001);
    const W = halfWidth(xx) * 0.95;
    outer.push([x + 0.035 * Math.pow(Math.cos(a), 2), zSign * (W + 0.03)]);
    inner.push([x - 0.12 * Math.pow(Math.cos(a), 1.5) - 0.02, zSign * Math.max(0, W - 0.1)]);
  }
  const g = planSlab(planShape(outer, inner), yBottom(2.1) - 0.004, 0.012);
  return mesh(g, m.gloss);
}

export function sideBlades(m) {
  const grp = new THREE.Group();
  const outer = [
    [-1.03, 0.905], [-0.95, 0.935], [0.6, 0.93], [0.93, 0.918], [0.98, 0.9],
  ];
  const inner = [
    [-1.03, 0.8], [-0.95, 0.8], [0.6, 0.8], [0.93, 0.8], [0.98, 0.8],
  ];
  const g = planSlab(planShape(outer, inner), 0.186, 0.012);
  grp.add(mesh(g, m.gloss));
  grp.add(mesh(mirrorZ(g), m.gloss));
  return grp;
}

export function rearDiffuser(m, exhaust = 'left-dual') {
  const g = new THREE.Group();
  // Side profile (x, y) of the diffuser shell, extruded across the width.
  const prof = new THREE.Shape();
  prof.moveTo(-2.1, 0.205);
  prof.lineTo(-2.4, 0.232);
  prof.lineTo(-2.447, 0.268);
  prof.lineTo(-2.45, 0.375);
  prof.lineTo(-2.428, 0.385);
  prof.lineTo(-2.425, 0.3);
  prof.lineTo(-2.39, 0.255);
  prof.lineTo(-2.1, 0.222);
  prof.closePath();
  const width = 1.5;
  const pg = new THREE.ExtrudeGeometry(prof, { depth: width, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.01, bevelSegments: 2 });
  pg.translate(0, 0, -width / 2);
  g.add(mesh(pg, m.gloss));
  // Fins
  for (const z of [-0.3, -0.12, 0.12, 0.3]) {
    const fin = box(0.3, 0.07, 0.012, 0.004);
    const f = mesh(fin, m.gloss, -2.3, 0.215, z);
    f.rotation.z = -0.1;
    g.add(f);
  }
  // Exhaust tips
  const tips = [];
  const zs = exhaust === 'left-dual' ? [-0.47, -0.6] : [-0.55, 0.55];
  for (const z of zs) {
    const outerT = new THREE.CylinderGeometry(0.045, 0.045, 0.16, 32, 1, true);
    outerT.rotateZ(Math.PI / 2);
    g.add(mesh(outerT, m.chrome, -2.39, 0.27, z));
    const innerT = new THREE.CylinderGeometry(0.036, 0.036, 0.15, 24, 1, true);
    innerT.rotateZ(Math.PI / 2);
    g.add(mesh(innerT, m.under, -2.39, 0.27, z));
    const lipT = new THREE.TorusGeometry(0.0405, 0.0045, 8, 32);
    lipT.rotateY(Math.PI / 2);
    g.add(mesh(lipT, m.chrome, -2.47, 0.27, z));
    tips.push(new THREE.Vector3(-2.48, 0.27, z));
  }
  return { group: g, tips };
}

/* ---------------------------------------------------------------- mirrors / handles */

export function mirror(m, side) {
  const g = new THREE.Group();
  const housing = new THREE.SphereGeometry(0.5, 32, 20);
  housing.scale(0.13, 0.105, 0.21);
  const h = mesh(housing, m.paint, 0, 0, 0);
  g.add(h);
  const cut = new THREE.CircleGeometry(0.5, 32);
  cut.scale(0.18, 0.085, 1);
  const glass = mesh(cut, m.chrome, -0.064, 0.0, 0);
  glass.rotation.y = -Math.PI / 2;
  glass.scale.set(1, 1, 1);
  g.add(glass);
  const base = box(0.1, 0.04, 0.08, 0.012);
  g.add(mesh(base, m.gloss, 0.01, -0.04, -side * 0.09));
  // Indicator strip
  const ind = box(0.016, 0.01, 0.13, 0.004);
  g.add(mesh(ind, m.tailLed, 0.06, -0.03, side * 0.02));
  g.position.set(0.7, 1.05, side * 0.915);
  g.rotation.y = side * 0.05;
  return g;
}

export function doorHandle(m, x, side) {
  const geo = new THREE.CapsuleGeometry(0.018, 0.13, 6, 16);
  geo.rotateZ(Math.PI / 2);
  geo.scale(1, 0.9, 0.45);
  const h = mesh(geo, m.paint, x, 0.885, side * 0.905);
  return h;
}

/* ---------------------------------------------------------------- interior */

function seat(m, x, z, front = true) {
  const g = new THREE.Group();
  const cushion = box(0.5, 0.12, 0.5, 0.05);
  g.add(mesh(cushion, m.leather, 0, 0, 0));
  const back = box(0.11, 0.62, 0.5, 0.05);
  const b = mesh(back, m.leather, -0.26, 0.3, 0);
  b.rotation.z = 0.24;
  g.add(b);
  if (front) {
    for (const s of [-1, 1]) {
      const bol = box(0.13, 0.5, 0.08, 0.035);
      const bb = mesh(bol, m.leather, -0.24, 0.28, s * 0.23);
      bb.rotation.z = 0.24;
      g.add(bb);
      const cb = box(0.45, 0.09, 0.07, 0.03);
      g.add(mesh(cb, m.leather, 0.02, 0.05, s * 0.23));
    }
    const head = box(0.08, 0.17, 0.26, 0.04);
    const hm = mesh(head, m.leather, -0.36, 0.68, 0);
    hm.rotation.z = 0.24;
    g.add(hm);
    // M tri-colour stripe on the backrest
    const cols = [0x81c4ff, 0x16588e, 0xe7222e];
    cols.forEach((c, i) => {
      const st = box(0.004, 0.3, 0.012, 0.002);
      const sm = mesh(st, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), -0.2, 0.32, (i - 1) * 0.016);
      sm.rotation.z = 0.24;
      g.add(sm);
    });
  }
  g.position.set(x, 0.43, z);
  return g;
}

function steeringWheel(m) {
  const g = new THREE.Group();
  const rimG = new THREE.TorusGeometry(0.185, 0.021, 14, 64);
  g.add(mesh(rimG, m.alcantara));
  // red 12 o'clock marker (M Performance)
  const marker = new THREE.TorusGeometry(0.185, 0.0225, 14, 8, 0.16);
  const mk = mesh(marker, m.mRed);
  mk.rotation.z = Math.PI / 2 - 0.08;
  g.add(mk);
  // carbon-ish grips are implied by darker tone; spokes
  for (const a of [0, Math.PI, -Math.PI / 2]) {
    const sp = box(0.16, 0.035, 0.02, 0.01);
    const s = mesh(sp, m.leather, Math.cos(a) * 0.09, Math.sin(a) * 0.09, -0.01);
    s.rotation.z = a;
    g.add(s);
  }
  const hub = new THREE.CylinderGeometry(0.07, 0.075, 0.05, 32);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, m.leather, 0, -0.01, -0.02));
  const logo = new THREE.CircleGeometry(0.024, 24);
  g.add(mesh(logo, m.roundel, 0, -0.01, 0.006));
  // M stitching hint at the bottom spoke
  const cols = [0x81c4ff, 0x16588e, 0xe7222e];
  cols.forEach((c, i) => {
    const st = box(0.008, 0.03, 0.022, 0.003);
    g.add(mesh(st, new THREE.MeshStandardMaterial({ color: c }), (i - 1) * 0.009, -0.13, -0.008));
  });
  return g;
}

export function interior(m) {
  const g = new THREE.Group();
  // floor & tunnel
  g.add(mesh(box(2.5, 0.06, 1.5, 0.02), m.leather, -0.45, 0.3, 0));
  g.add(mesh(box(1.9, 0.22, 0.24, 0.05), m.leather, -0.2, 0.42, 0));
  // seats
  g.add(seat(m, -0.28, -0.37));
  g.add(seat(m, -0.28, 0.37));
  const rear = seat(m, -1.15, 0, false);
  rear.scale.set(1, 1, 2.6);
  g.add(rear);
  // dashboard
  const dash = box(0.55, 0.28, 1.56, 0.08);
  g.add(mesh(dash, m.leather, 0.6, 0.82, 0));
  const dashTop = box(0.35, 0.05, 1.5, 0.02);
  const dt = mesh(dashTop, m.alcantara, 0.58, 0.97, 0);
  g.add(dt);
  // floating iDrive screen
  const scr = box(0.03, 0.12, 0.24, 0.01);
  const sc = mesh(scr, m.screen, 0.42, 1.04, 0.02);
  sc.rotation.z = 0.12;
  g.add(sc);
  // centre console + gear selector
  g.add(mesh(box(0.7, 0.16, 0.22, 0.04), m.leather, 0.05, 0.6, 0));
  const lever = box(0.08, 0.08, 0.05, 0.02);
  g.add(mesh(lever, m.gloss, 0.1, 0.7, 0));
  // steering wheel (left-hand drive) on a column
  const col = new THREE.CylinderGeometry(0.035, 0.045, 0.3, 16);
  col.rotateZ(Math.PI / 2 + 0.42);
  g.add(mesh(col, m.leather, 0.34, 0.8, -0.37));
  const sw = steeringWheel(m);
  sw.position.set(0.18, 0.88, -0.37);
  sw.rotation.y = -Math.PI / 2;
  sw.rotation.x = 0;
  sw.rotateX(-0.42);
  g.add(sw);
  // instrument cluster hood
  g.add(mesh(box(0.12, 0.09, 0.36, 0.03), m.leather, 0.42, 1.0, -0.37));
  const cluster = box(0.01, 0.07, 0.3, 0.005);
  const cl = mesh(cluster, m.screen, 0.355, 0.98, -0.37);
  cl.rotation.z = 0.25;
  g.add(cl);
  // door cards (inside) – painted onto the door backs via inner material, add armrests
  return { group: g, steering: sw };
}

/* ---------------------------------------------------------------- engine bay */

export function engineBay(m) {
  const g = new THREE.Group();
  g.add(mesh(box(1.25, 0.04, 1.3, 0.02), m.under, 1.5, 0.36, 0));
  // block + head
  g.add(mesh(box(0.7, 0.36, 0.4, 0.04), m.engineMetal, 1.48, 0.58, 0.02));
  // engine cover
  const coverGeo = box(0.66, 0.07, 0.44, 0.035, 4);
  const cover = mesh(coverGeo, m.engineCover, 1.5, 0.8, 0.02);
  g.add(cover);
  // label plane on the cover (texture on top face)
  const lbl = new THREE.PlaneGeometry(0.6, 0.3);
  lbl.rotateX(-Math.PI / 2);
  const lm = mesh(lbl, m.engineCover, 1.5, 0.837, 0.02);
  lm.rotation.y = Math.PI / 2;
  g.add(lm);
  // intake / airbox (driver side)
  g.add(mesh(box(0.42, 0.18, 0.26, 0.05), m.satin, 1.6, 0.72, -0.44));
  const pipe = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 20);
  pipe.rotateZ(Math.PI / 2);
  g.add(mesh(pipe, m.satin, 1.28, 0.74, -0.3));
  // strut towers
  for (const s of [-1, 1]) {
    const tower = new THREE.CylinderGeometry(0.085, 0.1, 0.18, 24);
    g.add(mesh(tower, m.satin, 1.42, 0.78, s * 0.6));
    const capG = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20);
    g.add(mesh(capG, m.engineMetal, 1.42, 0.875, s * 0.6));
  }
  // coolant reservoir + caps
  const res = new THREE.CylinderGeometry(0.07, 0.07, 0.14, 24);
  g.add(mesh(res, m.reservoir, 1.86, 0.74, 0.46));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), m.satin, 1.86, 0.825, 0.46));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), m.capBlue, 1.95, 0.76, -0.62));
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), m.capYellow, 1.0, 0.86, -0.5));
  g.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 16), m.capYellow, 1.62, 0.84, 0.18));
  // cowl/cabin filter cover + front support
  g.add(mesh(box(0.2, 0.06, 1.45, 0.02), m.satin, 0.97, 0.88, 0));
  g.add(mesh(box(0.08, 0.1, 1.25, 0.02), m.satin, 2.02, 0.72, 0));
  return g;
}

export function trunkTub(m) {
  const g = new THREE.Group();
  g.add(mesh(box(0.46, 0.04, 1.06, 0.02), m.alcantara, -2.04, 0.56, 0));
  g.add(mesh(box(0.04, 0.4, 1.06, 0.02), m.alcantara, -1.8, 0.76, 0));
  for (const s of [-1, 1]) g.add(mesh(box(0.46, 0.4, 0.04, 0.02), m.alcantara, -2.04, 0.76, s * 0.52));
  return g;
}
