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
const WHEEL_CENTER = new Vector3(-0.02217, -0.07727, 0.25581); // rim centre of the chosen wheel

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
const tmpV = new Vector3();
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
    // Vertices in source world space (with the placement offset) and in car space.
    const tmp = [];
    const srcPos = [];
    const carPos = [];
    const carNor = [];
    for (let i = 0; i < P.getCount(); i++) {
      v.fromArray(P.getElement(i, tmp)).applyMatrix4(world).add(off);
      srcPos.push(v.clone());
      carPos.push(toCar(v, e.part));
      if (N) {
        n.fromArray(N.getElement(i, tmp)).applyMatrix3(nmat).normalize();
        carNor.push([n.z, n.y, -n.x]);
      } else carNor.push([0, 1, 0]);
    }
    // Mask regions are convex (intersection of half-spaces n·(v−p) ≤ 0); triangles crossing a
    // boundary are clipped exactly, so painted edges are straight instead of following the mesh.
    const masks = (e.masks || []).map((mk) => ({
      mat: mk.mat,
      planes: mk.planes
        ? mk.planes.map(({ n: pn, p: pp }) => ({ n: new Vector3(...pn).normalize(), p: new Vector3(...pp) }))
        : [0, 1, 2].flatMap((a) => {
            const lo = new Vector3();
            const hi = new Vector3();
            lo.setComponent(a, -1);
            hi.setComponent(a, 1);
            const pmin = new Vector3(...mk.min);
            const pmax = new Vector3(...mk.max);
            return [{ n: lo, p: pmin }, { n: hi, p: pmax }];
          }),
    }));
    const vert = (k) => ({ s: srcPos[k], c: carPos[k], n: carNor[k], k });
    const lerpV = (a, b, t) => ({
      s: a.s.clone().lerp(b.s, t),
      c: a.c.map((x, i) => x + (b.c[i] - x) * t),
      n: a.n.map((x, i) => x + (b.n[i] - x) * t),
    });
    const split = (poly, pl) => {
      const inside = [];
      const outside = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const da = pl.n.dot(tmpV.copy(a.s).sub(pl.p));
        const db = pl.n.dot(tmpV.copy(b.s).sub(pl.p));
        (da <= 0 ? inside : outside).push(a);
        if ((da <= 0) !== (db <= 0)) {
          const cut = lerpV(a, b, da / (da - db));
          inside.push(cut);
          outside.push(cut);
        }
      }
      return [inside, outside];
    };
    const remap = new Map();
    const emit = (poly, mat) => {
      if (mat === 'skip' || poly.length < 3) return;
      const b = bucket(e.part, mat);
      const ids = poly.map((vx) => {
        if (vx.k !== undefined) {
          const key = `${b.part}|${b.mat}|${vx.k}`;
          let idx = remap.get(key);
          if (idx === undefined) {
            idx = b.pos.length / 3;
            b.pos.push(...vx.c);
            b.nor.push(...vx.n);
            remap.set(key, idx);
          }
          return idx;
        }
        const idx = b.pos.length / 3;
        b.pos.push(...vx.c);
        b.nor.push(...vx.n);
        return idx;
      });
      for (let t = 1; t < ids.length - 1; t++) b.idx.push(ids[0], ids[t], ids[t + 1]);
    };
    const count = I ? I.getCount() : P.getCount();
    for (let i = 0; i < count; i += 3) {
      let tri = [I ? I.getScalar(i) : i, I ? I.getScalar(i + 1) : i + 1, I ? I.getScalar(i + 2) : i + 2];
      if (flip) tri = [tri[0], tri[2], tri[1]];
      let pieces = [tri.map(vert)];
      for (const mk of masks) {
        const rest = [];
        for (const piece of pieces) {
          let cur = piece;
          for (const pl of mk.planes) {
            const [inside, outside] = split(cur, pl);
            if (outside.length >= 3) rest.push(outside);
            cur = inside;
            if (cur.length < 3) break;
          }
          if (cur.length >= 3) emit(cur, mk.mat);
        }
        pieces = rest;
      }
      for (const piece of pieces) emit(piece, e.mat);
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
