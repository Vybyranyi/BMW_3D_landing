import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DIM, lowerBody as L, greenhouse as G, glassRearX } from './profile.js';
import { buildPatch, both, mirrorZ } from './patch.js';
import { Projector, projectDecal, projectLine, smoothOutline, roundedPolygon } from './decal.js';
import { createMaterials } from './materials.js';
import {
  buildWheel, wellLiner, frontSplitter, sideBlades, rearDiffuser, mirror, doorHandle,
  interior, engineBay, trunkTub,
} from './parts.js';

const merge = (geos) => mergeGeometries(geos.flat(), false);

function add(parent, geo, mat, inner) {
  const mesh = new THREE.Mesh(geo, mat);
  parent.add(mesh);
  if (inner) parent.add(new THREE.Mesh(geo, inner));
  return mesh;
}

/** Group whose origin is a hinge; children are authored in car space. */
function hinge(parent, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const content = new THREE.Group();
  content.position.set(-x, -y, -z);
  pivot.add(content);
  parent.add(pivot);
  return { pivot, content };
}

export function buildCar({ exhaust = 'left-dual' } = {}) {
  const m = createMaterials();
  const car = new THREE.Group();
  car.name = 'F30';
  const body = new THREE.Group();
  car.add(body);
  const { xRear: xR, xFront: xF } = DIM;

  /* ------------------------------------------------ lower body */
  const underbody = both(L, { x0: xR, x1: xF, s0: 0, s1: 0.12, clipArches: true });
  const rocker = both(L, { x0: xR, x1: xF, s0: 0.12, s1: 0.27, clipArches: true });
  const quarter = both(L, { x0: xR, x1: -1.104, s0: 0.27, s1: 0.7, clipArches: true });
  const fender = both(L, { x0: 0.904, x1: xF, s0: 0.27, s1: 0.7, clipArches: true });
  const deckEdge = both(L, { x0: xR, x1: -1.76, s0: 0.7, s1: 0.72 });
  const tailTop = both(L, { x0: xR, x1: -2.37, s0: 0.72, s1: 1 });
  const frontEdge = both(L, { x0: 0.86, x1: xF, s0: 0.7, s1: 0.72 });
  const noseTop = both(L, { x0: 2.11, x1: xF, s0: 0.72, s1: 1 });

  add(body, merge(underbody), m.under);
  add(body, merge([rocker, quarter, fender, deckEdge, tailTop, frontEdge, noseTop]), m.paint, m.inner);

  /* ------------------------------------------------ greenhouse (fixed) */
  const cPillar = both(G, { x0: G.xMin, x1: (s) => glassRearX(s) - 0.029, s0: 0, s1: 0.56 });
  const band = both(G, { x0: G.xMin, x1: G.xMax, s0: 0.564, s1: 0.64 });
  const roof = both(G, { x0: -1.02, x1: 0.02, s0: 0.64, s1: 1 });
  add(body, merge([cPillar, band, roof]), m.paint, m.inner);
  const frits = [
    both(G, { x0: 0.02, x1: G.xMax, s0: 0.64, s1: 0.655 }),
    both(G, { x0: 0.02, x1: 0.045, s0: 0.655, s1: 1 }),
    both(G, { x0: G.xMin, x1: -1.02, s0: 0.64, s1: 0.655 }),
    both(G, { x0: -1.045, x1: -1.02, s0: 0.655, s1: 1 }),
  ];
  add(body, merge(frits), m.gloss);
  const glass = [
    both(G, { x0: 0.045, x1: G.xMax, s0: 0.655, s1: 1 }),
    both(G, { x0: G.xMin, x1: -1.045, s0: 0.655, s1: 1 }),
  ];
  add(body, merge(glass), m.glass);

  /* ------------------------------------------------ hood & trunk */
  const hood = hinge(car, 0.872, 0.99, 0);
  const hoodGeo = merge(both(L, { x0: 0.872, x1: 2.106, s0: 0.724, s1: 1 }));
  add(hood.content, hoodGeo, m.paint, m.inner);

  const trunk = hinge(car, -1.768, 1.05, 0);
  const trunkGeo = merge(both(L, { x0: -2.366, x1: -1.768, s0: 0.724, s1: 1 }));
  add(trunk.content, trunkGeo, m.paint, m.inner);

  /* ------------------------------------------------ doors */
  const doorParts = {
    frontPaint: [buildPatch(L, { x0: -0.087, x1: 0.9, s0: 0.274, s1: 0.7 })],
    frontTrim: [
      buildPatch(G, { x0: -0.087, x1: 0.858, s0: 0, s1: 0.025 }),
      buildPatch(G, { x0: -0.087, x1: 0.858, s0: 0.52, s1: 0.56 }),
      buildPatch(G, { x0: -0.087, x1: -0.067, s0: 0.025, s1: 0.52 }),
    ],
    frontGlass: [buildPatch(G, { x0: -0.067, x1: 0.858, s0: 0.025, s1: 0.52 })],
    rearPaint: [buildPatch(L, { x0: -1.1, x1: -0.093, s0: 0.274, s1: 0.7, clipArches: true })],
    rearTrim: [
      buildPatch(G, { x0: glassRearX(0) - 0.025, x1: -0.093, s0: 0, s1: 0.025 }),
      buildPatch(G, { x0: glassRearX(0.56) - 0.025, x1: -0.093, s0: 0.52, s1: 0.56 }),
      buildPatch(G, { x0: -0.118, x1: -0.093, s0: 0.025, s1: 0.52 }),
      buildPatch(G, { x0: (s) => glassRearX(s) - 0.025, x1: (s) => glassRearX(s), s0: 0.025, s1: 0.52 }),
    ],
    rearGlass: [buildPatch(G, { x0: (s) => glassRearX(s), x1: -0.118, s0: 0.025, s1: 0.52 })],
  };
  const doors = {};
  for (const side of [1, -1]) {
    const geo = (list) => merge(side > 0 ? list : list.map(mirrorZ));
    const f = hinge(car, 0.9, 0, side * 0.88);
    add(f.content, geo(doorParts.frontPaint), m.paint, m.inner);
    add(f.content, geo(doorParts.frontTrim), m.gloss);
    add(f.content, geo(doorParts.frontGlass), m.glass);
    f.content.add(mirror(m, side));
    f.content.add(doorHandle(m, 0.12, side));
    const r = hinge(car, -0.093, 0, side * 0.89);
    add(r.content, geo(doorParts.rearPaint), m.paint, m.inner);
    add(r.content, geo(doorParts.rearTrim), m.gloss);
    add(r.content, geo(doorParts.rearGlass), m.glass);
    r.content.add(doorHandle(m, -0.82, side));
    doors[side > 0 ? 'FR' : 'FL'] = f.pivot;
    doors[side > 0 ? 'RR' : 'RL'] = r.pivot;
  }

  /* ------------------------------------------------ decals: lights, grille, intakes */
  const frontProj = new Projector(
    [fender, noseTop, frontEdge, rocker].flat().map((g) => filterGeo(g, (x) => x > 1.55)),
    new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0),
  );
  const rearProj = new Projector(
    [quarter, tailTop, deckEdge, rocker].flat().map((g) => filterGeo(g, (x) => x < -1.85)),
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0),
  );
  const mirrored = (u) => u.map(([a, b]) => [-a, b]);
  const pair = (proj, outline, opts) => [
    projectDecal(proj, outline, opts),
    projectDecal(proj, mirrored(outline), opts),
  ];

  // Headlights (LCI LED)
  const headOutline = smoothOutline([
    [0.31, 0.765], [0.45, 0.772], [0.6, 0.768], [0.72, 0.752], [0.795, 0.728], [0.81, 0.7],
    [0.785, 0.672], [0.7, 0.668], [0.56, 0.664], [0.44, 0.655], [0.35, 0.648], [0.3, 0.67], [0.295, 0.73],
  ]);
  add(body, merge(pair(frontProj, headOutline, { lift: 0.004, bulge: 0.012, bulgeWidth: 0.03 })), m.lens);
  const headRim = [];
  for (const sgn of [1, -1]) {
    const pts = projectLine(frontProj, headOutline.map(([u, w]) => [u * sgn, w]), 0.006);
    headRim.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.0045, 6, true));
  }
  add(body, merge(headRim), m.darkChrome);
  // Angel-eye rings + eyebrow
  const rings = [];
  for (const sgn of [1, -1]) {
    for (const [u, w, r] of [[0.415, 0.711, 0.043], [0.6, 0.712, 0.043]]) {
      const hit = frontProj.cast(u * sgn, w);
      if (!hit) continue;
      const t = new THREE.TorusGeometry(r, 0.0055, 8, 48);
      t.scale(1, 0.82, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.normal);
      t.applyQuaternion(q);
      const p = hit.point.addScaledVector(hit.normal, 0.02);
      t.translate(p.x, p.y, p.z);
      rings.push(t);
    }
    const brow = [];
    for (let u = 0.33; u <= 0.74; u += 0.01) brow.push([u * sgn, 0.757 - (u - 0.33) * 0.04]);
    const pts = projectLine(frontProj, brow, 0.016);
    rings.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.004, 6, false));
  }
  add(body, merge(rings), m.drl);

  // Kidney grille
  const kidney = smoothOutline([
    [0.045, 0.585], [0.042, 0.7], [0.055, 0.755], [0.1, 0.77], [0.19, 0.77], [0.243, 0.753],
    [0.26, 0.7], [0.253, 0.62], [0.225, 0.585], [0.13, 0.578],
  ]);
  add(body, merge(pair(frontProj, kidney, { lift: 0.012 })), m.under);
  const kidneyFrames = [];
  const slats = [];
  for (const sgn of [1, -1]) {
    const pts = projectLine(frontProj, kidney.map(([u, w]) => [u * sgn, w]), 0.016);
    kidneyFrames.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 120, 0.0075, 8, true));
    for (let k = 0; k < 9; k++) {
      const u = (0.065 + k * 0.022) * sgn;
      const line = [];
      for (let w = 0.588; w <= 0.765; w += 0.01) line.push([u, w]);
      const lp = projectLine(frontProj, line, 0.018);
      if (lp.length > 2) slats.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp), 16, 0.0035, 4, false));
    }
  }
  add(body, merge(kidneyFrames), m.chrome);
  add(body, merge(slats), m.gloss);

  // M Sport bumper intakes
  const centerIntake = roundedPolygon([
    [-0.42, 0.252], [0.42, 0.252], [0.455, 0.3], [0.35, 0.425], [-0.35, 0.425], [-0.455, 0.3],
  ], 0.03);
  add(body, projectDecal(frontProj, centerIntake, { lift: 0.002 }), m.honey);
  const sideIntake = roundedPolygon([
    [0.52, 0.275], [0.75, 0.295], [0.8, 0.35], [0.795, 0.52], [0.68, 0.5], [0.52, 0.37],
  ], [0.02, 0.03, 0.04, 0.02, 0.03, 0.03]);
  // Horizontal blade across the centre intake (M Sport)
  const blade = roundedPolygon([[-0.4, 0.33], [0.4, 0.33], [0.4, 0.345], [-0.4, 0.345]], 0.006, 3);
  add(body, projectDecal(frontProj, blade, { lift: 0.008, cell: 0.01 }), m.gloss);
  add(body, merge(pair(frontProj, sideIntake, { lift: 0.002 })), m.honey);

  // Taillights (LCI LED)
  const tailOutline = smoothOutline([
    [0.4, 0.975], [0.58, 0.99], [0.76, 0.985], [0.84, 0.965], [0.862, 0.92], [0.845, 0.878],
    [0.76, 0.875], [0.62, 0.885], [0.48, 0.905], [0.395, 0.935],
  ]);
  add(body, merge(pair(rearProj, tailOutline, { lift: 0.004, bulge: 0.006 })), m.tailLens);
  const tailBars = [];
  for (const sgn of [1, -1]) {
    const upper = [];
    for (let u = 0.44; u <= 0.82; u += 0.01) upper.push([u * sgn, 0.958 + (u - 0.44) * 0.01]);
    const lower = [];
    for (let u = 0.6; u <= 0.83; u += 0.01) lower.push([u * sgn, 0.905 - (u - 0.6) * 0.02]);
    const vert = [];
    for (let w = 0.9; w <= 0.962; w += 0.006) vert.push([0.832 * sgn, w]);
    for (const line of [upper, lower, vert]) {
      const pts = projectLine(rearProj, line, 0.012);
      if (pts.length > 2) tailBars.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.005, 6, false));
    }
  }
  add(body, merge(tailBars), m.tailLed);
  // Rear reflectors
  const refl = [[0.6, 0.415], [0.78, 0.42], [0.79, 0.44], [0.6, 0.435]];
  add(body, merge(pair(rearProj, refl, { lift: 0.002 })), m.tailLens);

  // Badges
  const badge = [[0.47, 0.835], [0.66, 0.835], [0.66, 0.878], [0.47, 0.878]];
  add(body, projectDecal(rearProj, badge, { cell: 0.01, lift: 0.003 }), m.badge);
  const circle = (cu, cw, r) => Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return [cu + Math.cos(a) * r, cw + Math.sin(a) * r];
  });
  add(body, projectDecal(rearProj, circle(0, 0.935, 0.04), { cell: 0.01, lift: 0.004 }), m.roundel);
  const hoodProj = new Projector([hoodGeo], new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0));
  add(hood.content, projectDecal(hoodProj, circle(0, -2.055, 0.04), { cell: 0.01, lift: 0.004 }), m.roundel);

  /* ------------------------------------------------ aero, wheels, internals */
  car.add(frontSplitter(m));
  car.add(sideBlades(m));
  const diffuser = rearDiffuser(m, exhaust);
  car.add(diffuser.group);
  car.add(wellLiner(m, DIM.axleF));
  car.add(wellLiner(m, DIM.axleR));

  const wheels = [];
  for (const [x, z, front] of [
    [DIM.axleF, DIM.trackF, true], [DIM.axleF, -DIM.trackF, true],
    [DIM.axleR, DIM.trackR, false], [DIM.axleR, -DIM.trackR, false],
  ]) {
    const w = buildWheel(m, { width: front ? 0.225 : 0.245, front });
    w.wheel.position.set(x, DIM.wheelR, z);
    if (z < 0) w.wheel.rotation.y = Math.PI;
    car.add(w.wheel);
    wheels.push({ ...w, side: Math.sign(z), front });
  }

  const cabin = interior(m);
  car.add(cabin.group);
  // Courtesy lights: glow inside the cabin when a door opens.
  const courtesy = new THREE.PointLight(0xffe2c0, 0, 2.6, 1.6);
  courtesy.position.set(-0.3, 1.25, 0);
  car.add(courtesy);
  const footwell = new THREE.PointLight(0xffd6a8, 0, 1.6, 1.8);
  footwell.position.set(0.2, 0.5, -0.4);
  car.add(footwell);
  car.add(engineBay(m));
  car.add(trunkTub(m));

  car.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });

  /* ------------------------------------------------ state */
  const state = { hood: 0, trunk: 0, doorF: 0, doorR: 0, lights: 0, brake: 0, wheelAngle: 0, steer: 0 };
  function apply() {
    hood.pivot.rotation.z = state.hood * 0.86;
    trunk.pivot.rotation.z = -state.trunk * 1.05;
    doors.FR.rotation.y = state.doorF * 1.1;
    doors.FL.rotation.y = -state.doorF * 1.1;
    doors.RR.rotation.y = state.doorR * 1.05;
    doors.RL.rotation.y = -state.doorR * 1.05;
    for (const w of wheels) {
      w.spinner.rotation.z = w.side > 0 ? -state.wheelAngle : state.wheelAngle;
      if (w.front) w.wheel.rotation.y = (w.side > 0 ? 0 : Math.PI) + state.steer;
    }
    const doorsOpen = Math.max(state.doorF, state.doorR);
    courtesy.intensity = doorsOpen * 2.2;
    footwell.intensity = doorsOpen * 1.2;
    m.screen.emissiveIntensity = 0.2 + doorsOpen * 1.2;
    m.drl.emissiveIntensity = state.lights * 14;
    m.tailLed.emissiveIntensity = state.lights * 7 + state.brake * 10;
    m.tailLens.emissiveIntensity = state.lights * 0.35 + state.brake * 0.9;
  }
  apply();

  return {
    group: car,
    materials: m,
    exhaustTips: diffuser.tips,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}

/** Copy of a geometry with only the triangles whose centroid x passes the test. */
function filterGeo(geo, test) {
  const p = geo.attributes.position;
  const idx = geo.index.array;
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    const cx = (p.getX(idx[i]) + p.getX(idx[i + 1]) + p.getX(idx[i + 2])) / 3;
    if (test(cx)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', p);
  g.setAttribute('normal', geo.attributes.normal);
  g.setIndex(keep);
  return g;
}
