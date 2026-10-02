// Builds public/models/f30.glb from the source kit + tools/f30-selection.json (exported by tools/inspector.js).
//   node tools/build-model.mjs
import fs from 'node:fs';
import { Document, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplifyPrimitive, meshopt, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { Matrix4, Matrix3, Vector3 } from 'three';

const SRC = 'bmw-3-series-f30-2011-2018/source/model (2).glb';
const OUT = 'src/assets/models/f30.glb';
const { frame: F, entries } = JSON.parse(fs.readFileSync('tools/f30-selection.json', 'utf8'));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});
const src = await io.read(SRC);
const srcNodes = src.getRoot().listNodes();

const s = F.scale;
const midZ = (F.frontAxleZ + F.rearAxleZ) / 2;
const groundY = F.axleY - F.tireRadius;
// Wheel template sits at the centre of the source car; re-centre it on its own hub.
const WHEEL_CENTER = new Vector3(-0.02254, -0.07727, 0.25581);

/** source world point → car frame (metres; +x forward, +y up, +z right) */
function toCar(p, part) {
  if (part === 'wheel') {
    return [(p.z - WHEEL_CENTER.z) * s, (p.y - WHEEL_CENTER.y) * s, -(p.x - WHEEL_CENTER.x) * s];
  }
  return [(p.z - midZ) * s, (p.y - groundY) * s, -(p.x - F.centerX) * s];
}

// Collect triangles per (part, material).
const buckets = new Map();
const bucket = (part, mat) => {
  const key = `${part}|${mat}`;
  if (!buckets.has(key)) buckets.set(key, { part, mat, pos: [], nor: [], idx: [] });
  return buckets.get(key);
};

const world = new Matrix4();
const nmat = new Matrix3();
const v = new Vector3();
const n = new Vector3();
for (const e of entries) {
  const node = srcNodes[e.node];
  const mesh = node.getMesh();
  if (!mesh) continue;
  world.fromArray(node.getWorldMatrix());
  nmat.getNormalMatrix(world);
  const flip = world.determinant() < 0;
  const off = new Vector3(...e.off);
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION');
    const N = prim.getAttribute('NORMAL');
    const I = prim.getIndices();
    const b = bucket(e.part, e.mat);
    const base = b.pos.length / 3;
    const tmp = [];
    for (let i = 0; i < P.getCount(); i++) {
      v.fromArray(P.getElement(i, tmp)).applyMatrix4(world).add(off);
      b.pos.push(...toCar(v, e.part));
      if (N) {
        n.fromArray(N.getElement(i, tmp)).applyMatrix3(nmat).normalize();
        b.nor.push(n.z, n.y, -n.x);
      } else b.nor.push(0, 1, 0);
    }
    const count = I ? I.getCount() : P.getCount();
    for (let i = 0; i < count; i += 3) {
      const a = I ? I.getScalar(i) : i;
      const c1 = I ? I.getScalar(i + 1) : i + 1;
      const c2 = I ? I.getScalar(i + 2) : i + 2;
      if (flip) b.idx.push(base + a, base + c2, base + c1);
      else b.idx.push(base + a, base + c1, base + c2);
    }
  }
}

// Build the output document.
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('F30');
const mats = new Map();
const partNodes = new Map();
let tris = 0;
for (const b of buckets.values()) {
  if (!mats.has(b.mat)) mats.set(b.mat, doc.createMaterial(b.mat).setDoubleSided(true));
  if (!partNodes.has(b.part)) {
    const node = doc.createNode(b.part).setMesh(doc.createMesh(b.part));
    scene.addChild(node);
    partNodes.set(b.part, node);
  }
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.pos)).setBuffer(buffer);
  const nor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.nor)).setBuffer(buffer);
  const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(b.idx)).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('NORMAL', nor).setIndices(idx).setMaterial(mats.get(b.mat));
  partNodes.get(b.part).getMesh().addPrimitive(prim);
  tris += b.idx.length / 3;
}
console.log('parts', [...partNodes.keys()].join(', '));
console.log('materials', [...mats.keys()].join(', '));
console.log('triangles in', Math.round(tris));

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await doc.transform(
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
  weld({ tolerance: 0.00005 }),
  prune(),
);
// Only simplify what the camera never studies closely; exterior panels stay pristine.
const SIMPLIFY = { interior: 0.45, satin: 0.5, metal: 0.45, under: 0.4, black: 0.7 };
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const ratio = SIMPLIFY[prim.getMaterial().getName()];
    if (ratio) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: true });
  }
}
await doc.transform(prune());
let out = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) out += p.getIndices().getCount() / 3;
console.log('triangles out', Math.round(out));

await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
fs.mkdirSync('src/assets/models', { recursive: true });
await io.write(OUT, doc);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
