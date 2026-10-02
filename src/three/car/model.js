import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import MODEL_URL from '../../assets/models/f30.glb?url';

/* Axle/tyre geometry of the built model (metres, car frame: +x forward, +y up, +z right). */
const AXLE_X = 1.4046;
const AXLE_Y = 0.3548;
const TRACK_F = 0.772;
const TRACK_R = 0.79;
const TYRE_R = 0.3548;
const RIM_R = 0.2535; // outer lip of the rim
const TYRE_W = 0.25; // = rim width, so the beads sit right behind the lips

function createMaterials() {
  const m = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xf4f5f3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
    gloss: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
    blade: new THREE.MeshPhysicalMaterial({ color: 0x040405, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.35 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.5 }),
    satin: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6, metalness: 0.1 }),
    under: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.45, metalness: 0.75 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe2e5ea, roughness: 0.1, metalness: 1 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.02, metalness: 1 }),
    headInner: new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.25, metalness: 0.8 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.62, metalness: 0.02 }),
    headliner: new THREE.MeshStandardMaterial({ color: 0xece9e2, roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0d1116, roughness: 0.04, transparent: true, opacity: 0.72, envMapIntensity: 0.9, depthWrite: false,
    }),
    glassRoof: new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 }),
    glassClear: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.18, envMapIntensity: 1.4, depthWrite: false,
    }),
    drl: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe4f0ff, emissiveIntensity: 0 }),
    indicator: new THREE.MeshStandardMaterial({ color: 0x7a4a00, emissive: 0xff8a00, emissiveIntensity: 0.2 }),
    tailDark: new THREE.MeshStandardMaterial({ color: 0x1a0204, roughness: 0.35, metalness: 0.3 }),
    tailLed: new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff0000, emissiveIntensity: 0 }),
    tailLens: new THREE.MeshPhysicalMaterial({
      color: 0x5c0006, roughness: 0.06, transparent: true, opacity: 0.9, clearcoat: 1, emissive: 0x9a0008, emissiveIntensity: 0, depthWrite: false,
    }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0x9fa3a9, roughness: 0.28, metalness: 0.9, clearcoat: 0.5 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x6e7176, roughness: 0.4, metalness: 0.9 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.9, side: THREE.DoubleSide }),
    caliper: new THREE.MeshPhysicalMaterial({ color: 0x2b2d31, roughness: 0.4, metalness: 0.4, clearcoat: 0.6 }),
  };
  for (const mat of Object.values(m)) mat.side = THREE.DoubleSide;
  return m;
}

function tyreGeometry() {
  const hw = TYRE_W / 2;
  const R = TYRE_R;
  const r = RIM_R - 0.006; // bead tucked under the rim lip — no daylight between rim and tyre
  const prof = [
    [r, -hw * 0.96], [RIM_R + 0.004, -hw * 0.99], [RIM_R + 0.03, -hw * 1.03], [R - 0.03, -hw * 1.04], [R - 0.01, -hw * 0.96],
    [R - 0.002, -hw * 0.8], [R, -hw * 0.55], [R, hw * 0.55], [R - 0.002, hw * 0.8], [R - 0.01, hw * 0.96], [R - 0.03, hw * 1.04],
    [RIM_R + 0.03, hw * 1.03], [RIM_R + 0.004, hw * 0.99], [r, hw * 0.96],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  const g = new THREE.LatheGeometry(prof, 96);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Pivot group whose origin is the hinge; content stays in car coordinates. */
function hinge(car, object, at) {
  const pivot = new THREE.Group();
  pivot.position.copy(at);
  object.position.sub(at);
  pivot.add(object);
  car.add(pivot);
  return pivot;
}

export async function loadCar({ onProgress } = {}) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(MODEL_URL, (e) => e.total && onProgress?.(e.loaded / e.total));
  const m = createMaterials();
  const car = new THREE.Group();
  car.name = 'F30';
  const parts = {};
  for (const node of [...gltf.scene.children]) {
    node.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material?.name;
      o.material = m[name] || m.paint;
      if (name === 'glass' || name === 'glassClear' || name === 'tailLens') o.renderOrder = 2;
    });
    parts[node.name] = node;
  }

  // Body + engine/interior
  car.add(parts.body);

  // Opening panels: hinge positions from their own bounds.
  const box = (o) => new THREE.Box3().setFromObject(o);
  const hb = box(parts.hood);
  const hood = hinge(car, parts.hood, new THREE.Vector3(hb.min.x + 0.02, hb.max.y - 0.01, 0));
  const tb = box(parts.trunk);
  const trunk = hinge(car, parts.trunk, new THREE.Vector3(tb.max.x - 0.02, tb.max.y - 0.01, 0));
  const doors = {};
  for (const id of ['doorFL', 'doorFR', 'doorRL', 'doorRR']) {
    const b = box(parts[id]);
    const left = id.endsWith('L');
    doors[id] = hinge(car, parts[id], new THREE.Vector3(b.max.x - 0.03, 0, left ? b.min.z + 0.07 : b.max.z - 0.07));
  }

  // Wheels: rim template ×4 + generated tyre + caliper.
  const template = parts.wheel;
  const tyre = tyreGeometry();
  const caliperGeo = new RoundedBoxGeometry(0.13, 0.07, 0.07, 3, 0.015);
  const wheels = [];
  for (const [x, z, front] of [
    [AXLE_X, TRACK_F, true], [AXLE_X, -TRACK_F, true], [-AXLE_X, TRACK_R, false], [-AXLE_X, -TRACK_R, false],
  ]) {
    const wheel = new THREE.Group();
    wheel.position.set(x, AXLE_Y, z);
    const spinner = new THREE.Group();
    const rim = template.clone();
    // Template faces the car's left (-z); right-hand wheels are turned around.
    if (z > 0) rim.rotation.y = Math.PI;
    spinner.add(rim);
    spinner.add(new THREE.Mesh(tyre, m.tire));
    wheel.add(spinner);
    const cal = new THREE.Mesh(caliperGeo, m.caliper);
    const a = front ? Math.PI * 0.85 : Math.PI * 0.15;
    cal.position.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, z > 0 ? -0.03 : 0.03);
    cal.rotation.z = a - Math.PI / 2;
    wheel.add(cal);
    car.add(wheel);
    wheels.push({ wheel, spinner, side: Math.sign(z), front });
  }

  // Smoke emitters at the real exhaust tips (rear chrome on the body).
  const tipBox = new THREE.Box3();
  const tv = new THREE.Vector3();
  parts.body.updateMatrixWorld(true);
  parts.body.traverse((o) => {
    if (!o.isMesh || o.material !== m.chrome) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      tv.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (tv.x < -2.2 && tv.y < 0.6) tipBox.expandByPoint(tv);
    }
  });
  const tipW = tipBox.max.z - tipBox.min.z;
  const tipY = (tipBox.min.y + tipBox.max.y) / 2;
  const exhaustTips = tipBox.isEmpty()
    ? [new THREE.Vector3(-2.5, 0.33, -0.4), new THREE.Vector3(-2.5, 0.33, -0.5)]
    : [
        new THREE.Vector3(tipBox.min.x - 0.02, tipY, tipBox.min.z + tipW * 0.25),
        new THREE.Vector3(tipBox.min.x - 0.02, tipY, tipBox.max.z - tipW * 0.25),
      ];

  // Courtesy lights for the open-door shot.
  const courtesy = new THREE.PointLight(0xffe2c0, 0, 2.6, 1.6);
  courtesy.position.set(-0.3, 1.2, 0);
  car.add(courtesy);

  const state = { hood: 0, trunk: 0, doorF: 0, doorR: 0, lights: 0, brake: 0, wheelAngle: 0, steer: 0 };
  function apply() {
    hood.rotation.z = state.hood * 0.9;
    trunk.rotation.z = -state.trunk * 1.05;
    doors.doorFL.rotation.y = -state.doorF * 1.1;
    doors.doorFR.rotation.y = state.doorF * 1.1;
    doors.doorRL.rotation.y = -state.doorR * 1.05;
    doors.doorRR.rotation.y = state.doorR * 1.05;
    for (const w of wheels) {
      w.spinner.rotation.z = -state.wheelAngle;
      if (w.front) w.wheel.rotation.y = state.steer;
    }
    courtesy.intensity = Math.max(state.doorF, state.doorR) * 2.2;
    m.drl.emissiveIntensity = state.lights * 5;
    m.tailLed.emissiveIntensity = state.lights * 1.6 + state.brake * 5;
    m.tailLens.emissiveIntensity = state.lights * 0.3 + state.brake * 0.9;
  }
  apply();

  return {
    group: car,
    materials: m,
    exhaustTips,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
