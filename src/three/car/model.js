import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import MODEL_URL from '../../assets/models/f30.glb?url';
import { roundelTexture } from './materials.js';
import { CAR } from '../../content.js';

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
    // window surrounds (Shadowline): black, but not a mirror for the studio lights
    trim: new THREE.MeshPhysicalMaterial({ color: 0x060607, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.35 }),
    blade: new THREE.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.15 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.5 }),
    satin: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6, metalness: 0.1 }),
    under: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.45, metalness: 0.75 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe2e5ea, roughness: 0.1, metalness: 1 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.02, metalness: 1 }),
    headInner: new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.25, metalness: 0.8 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.62, metalness: 0.02 }),
    headliner: new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.95 }), // black headliner
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0d1116, roughness: 0.04, transparent: true, opacity: 0.72, envMapIntensity: 0.9, depthWrite: false,
    }),
    glassRoof: new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 }),
    glassClear: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.18, envMapIntensity: 1.4, depthWrite: false,
    }),
    drl: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe4f0ff, emissiveIntensity: 0 }),
    indicator: new THREE.MeshStandardMaterial({ color: 0x7a4a00, emissive: 0xff8a00, emissiveIntensity: 0.2 }),
    fog: new THREE.MeshStandardMaterial({ color: 0x6f767e, roughness: 0.18, metalness: 1 }), // unlit fog lamp reflector
    reflector: new THREE.MeshPhysicalMaterial({ color: 0x7a0008, roughness: 0.25, clearcoat: 1, emissive: 0x300003 }),
    tailDark: new THREE.MeshStandardMaterial({ color: 0x1a0204, roughness: 0.35, metalness: 0.3 }),
    tailLed: new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff0000, emissiveIntensity: 0 }),
    tailLens: new THREE.MeshPhysicalMaterial({
      color: 0x5c0006, roughness: 0.06, transparent: true, opacity: 0.9, clearcoat: 1, emissive: 0x9a0008, emissiveIntensity: 0, depthWrite: false,
    }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 }),
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
  // Extra things that ride on the panel are authored in car space (glTF nodes carry meshopt
  // dequantisation transforms, so they can't be parents for car-space objects).
  pivot.userData.space = new THREE.Group();
  pivot.userData.space.position.copy(at).negate();
  pivot.add(pivot.userData.space);
  return pivot;
}

/** Ukrainian number plate (520×110 mm): blue UA band on the left, black characters. */
function plateTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1040;
  c.height = 220;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.beginPath();
  g.roundRect(0, 0, 1040, 220, 22);
  g.fill();
  g.fillStyle = '#f7f7f4';
  g.beginPath();
  g.roundRect(8, 8, 1024, 204, 16);
  g.fill();
  g.fillStyle = '#1d4fa5';
  g.beginPath();
  g.roundRect(14, 14, 112, 192, 10);
  g.fill();
  g.fillStyle = '#0057b7';
  g.fillRect(34, 40, 72, 26);
  g.fillStyle = '#ffd500';
  g.fillRect(34, 66, 72, 26);
  g.fillStyle = '#fff';
  g.font = 'bold 56px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('UA', 70, 170);
  g.fillStyle = '#111';
  g.textBaseline = 'middle';
  g.font = 'bold 168px "DIN Condensed", "Arial Narrow", Arial, sans-serif';
  const w = g.measureText(text).width;
  g.save();
  g.translate(583, 116);
  g.scale(Math.min(1, 860 / w), 1);
  g.fillText(text, 0, 0);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Flat badge/plate placed on a surface point, facing along its normal. */
function stick(mesh, pos, normal, lift = 0.004) {
  const n = new THREE.Vector3(...normal).normalize();
  mesh.position.set(...pos).addScaledVector(n, lift);
  // +z of the badge along the normal, keeping it upright (+y as close to world up as possible)
  const x = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const y = n.clone().cross(x);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  return mesh;
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
    const rim = new THREE.Group();
    rim.add(template.clone());
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

  // Smoke emitters at the real exhaust tips (rear chrome on the body), one per side.
  const sides = [new THREE.Box3(), new THREE.Box3()];
  const tv = new THREE.Vector3();
  parts.body.updateMatrixWorld(true);
  parts.body.traverse((o) => {
    if (!o.isMesh || o.material !== m.chrome) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      tv.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (tv.x < -2.2 && tv.y < 0.6) sides[tv.z < 0 ? 0 : 1].expandByPoint(tv);
    }
  });
  const exhaustTips = sides
    .filter((b) => !b.isEmpty())
    .map((b) => new THREE.Vector3(b.min.x - 0.02, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2));
  if (!exhaustTips.length) exhaustTips.push(new THREE.Vector3(-2.5, 0.33, -0.45));

  // BMW roundels (bonnet nose + trunk) and number plates — measured on the model surfaces.
  const roundelMat = new THREE.MeshStandardMaterial({ map: roundelTexture(), roughness: 0.25, metalness: 0.35 });
  const trunkSpace = trunk.userData.space;
  car.add(stick(new THREE.Mesh(new THREE.CircleGeometry(0.041, 48), roundelMat), [2.124, 0.745, 0], [0.634, 0.774, 0], 0.012));
  trunkSpace.add(stick(new THREE.Mesh(new THREE.CircleGeometry(0.046, 48), roundelMat), [-2.3497, 0.9788, 0], [-0.99, -0.14, 0], 0.004));
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture(CAR.plate), roughness: 0.45, metalness: 0.05 });
  const plate = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), plateMat));
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.535, 0.125, 0.012, 2, 0.006), m.satin);
    back.position.z = -0.007;
    g.add(back);
    return g;
  };
  car.add(stick(plate(), [2.168, 0.49, 0], [1, -0.05, 0], 0.012));
  trunkSpace.add(stick(plate(), [-2.3171, 0.7859, 0], [-0.967, 0.256, 0], 0.012));

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
