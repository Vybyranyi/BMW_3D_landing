// Dump per-mesh world bounding boxes of the source model (dev tool).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { Matrix4, Vector3 } from 'three';
import fs from 'fs';

const src = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
const out = [];
const meshIndex = new Map(root.listMeshes().map((m, i) => [m, i]));
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const world = new Matrix4().fromArray(node.getWorldMatrix());
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let tris = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const a = pos.getMin([]);
    const b = pos.getMax([]);
    for (let k = 0; k < 8; k++) {
      const p = new Vector3(k & 1 ? b[0] : a[0], k & 2 ? b[1] : a[1], k & 4 ? b[2] : a[2]).applyMatrix4(world).toArray();
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], p[c]);
        max[c] = Math.max(max[c], p[c]);
      }
    }
    tris += (prim.getIndices()?.getCount() ?? pos.getCount()) / 3;
  }
  let chain = [];
  let p = node;
  while (p) {
    chain.unshift(p.getName());
    p = p.getParentNode();
  }
  out.push({ mesh: meshIndex.get(mesh), node: node.getName(), chain: chain.slice(1, 3).join('/'), min, max, tris });
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
const gmin = [0, 1, 2].map((c) => Math.min(...out.map((o) => o.min[c])));
const gmax = [0, 1, 2].map((c) => Math.max(...out.map((o) => o.max[c])));
console.log('meshes', out.length, 'bbox', gmin.map((v) => v.toFixed(2)), gmax.map((v) => v.toFixed(2)));
