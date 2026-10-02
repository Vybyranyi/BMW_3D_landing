import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3, CatmullRomCurve3 } from 'three';

/*
 * Projects flat 2D outlines onto the curved body, like a decal gun.
 * Rays travel along `dir`; outlines live in the (uAxis, wAxis) plane.
 */
export class Projector {
  constructor(geometries, dir, uAxis, wAxis, cell = 0.04) {
    this.dir = dir.clone().normalize();
    this.u = uAxis.clone().normalize();
    this.w = wAxis.clone().normalize();
    this.cell = cell;
    this.tris = [];
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (const g of geometries) {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const index = g.index ? g.index.array : null;
      const count = index ? index.length : p.count;
      for (let i = 0; i < count; i += 3) {
        const ia = index ? index[i] : i;
        const ib = index ? index[i + 1] : i + 1;
        const ic = index ? index[i + 2] : i + 2;
        a.fromBufferAttribute(p, ia);
        b.fromBufferAttribute(p, ib);
        c.fromBufferAttribute(p, ic);
        this.tris.push({
          a: a.clone(), b: b.clone(), c: c.clone(),
          na: new Vector3().fromBufferAttribute(n, ia),
          nb: new Vector3().fromBufferAttribute(n, ib),
          nc: new Vector3().fromBufferAttribute(n, ic),
        });
      }
    }
    this.grid = new Map();
    this.tris.forEach((t, ti) => {
      const pts = [t.a, t.b, t.c].map((v) => [v.dot(this.u), v.dot(this.w)]);
      const u0 = Math.floor(Math.min(...pts.map((q) => q[0])) / cell);
      const u1 = Math.floor(Math.max(...pts.map((q) => q[0])) / cell);
      const w0 = Math.floor(Math.min(...pts.map((q) => q[1])) / cell);
      const w1 = Math.floor(Math.max(...pts.map((q) => q[1])) / cell);
      for (let i = u0; i <= u1; i++) {
        for (let j = w0; j <= w1; j++) {
          const key = i * 100003 + j;
          let list = this.grid.get(key);
          if (!list) this.grid.set(key, (list = []));
          list.push(ti);
        }
      }
    });
  }

  /** First hit of the ray through (u, w). Returns { point, normal } or null. */
  cast(u, w) {
    const key = Math.floor(u / this.cell) * 100003 + Math.floor(w / this.cell);
    const list = this.grid.get(key);
    if (!list) return null;
    const o = this.u.clone().multiplyScalar(u).addScaledVector(this.w, w).addScaledVector(this.dir, -20);
    let best = null;
    let bestT = Infinity;
    const e1 = new Vector3();
    const e2 = new Vector3();
    const pv = new Vector3();
    const tv = new Vector3();
    const qv = new Vector3();
    for (const ti of list) {
      const t = this.tris[ti];
      e1.subVectors(t.b, t.a);
      e2.subVectors(t.c, t.a);
      pv.crossVectors(this.dir, e2);
      const det = e1.dot(pv);
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      tv.subVectors(o, t.a);
      const bu = tv.dot(pv) * inv;
      if (bu < -1e-6 || bu > 1 + 1e-6) continue;
      qv.crossVectors(tv, e1);
      const bv = this.dir.dot(qv) * inv;
      if (bv < -1e-6 || bu + bv > 1 + 1e-6) continue;
      const dist = e2.dot(qv) * inv;
      if (dist > 0 && dist < bestT) {
        bestT = dist;
        best = { t, bu, bv };
      }
    }
    if (!best) return null;
    const { t, bu, bv } = best;
    const normal = new Vector3()
      .addScaledVector(t.na, 1 - bu - bv)
      .addScaledVector(t.nb, bu)
      .addScaledVector(t.nc, bv)
      .normalize();
    return { point: o.addScaledVector(this.dir, bestT), normal };
  }
}

/** Smooth closed outline through control points (u, w). */
export function smoothOutline(points, segments = 96) {
  const c = new CatmullRomCurve3(points.map(([u, w]) => new Vector3(u, w, 0)), true, 'centripetal');
  return c.getSpacedPoints(segments).slice(0, -1).map((v) => [v.x, v.y]);
}

function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function clipPolygon(subject, [u0, w0, u1, w1]) {
  let out = subject;
  const edges = [
    (p) => p[0] >= u0, (p) => p[0] <= u1, (p) => p[1] >= w0, (p) => p[1] <= w1,
  ];
  const inter = [
    (a, b) => { const t = (u0 - a[0]) / (b[0] - a[0]); return [u0, a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (u1 - a[0]) / (b[0] - a[0]); return [u1, a[1] + t * (b[1] - a[1])]; },
    (a, b) => { const t = (w0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), w0]; },
    (a, b) => { const t = (w1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), w1]; },
  ];
  for (let e = 0; e < 4; e++) {
    const input = out;
    out = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const ci = edges[e](cur);
      const pi = edges[e](prev);
      if (ci) {
        if (!pi) out.push(inter[e](prev, cur));
        out.push(cur);
      } else if (pi) out.push(inter[e](prev, cur));
    }
  }
  return out;
}

function distToOutline(p, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}

/**
 * Fill an outline with a fine, crack-free triangle grid and project it on the body.
 * opts.lift: offset along the surface normal; opts.bulge: extra lift towards the middle (lens dome).
 */
export function projectDecal(projector, outline, opts = {}) {
  const { cell = 0.015, lift = 0.003, bulge = 0, bulgeWidth = 0.03 } = opts;
  let poly = outline;
  if (polygonArea(poly) < 0) poly = [...poly].reverse();
  const us = poly.map((p) => p[0]);
  const ws = poly.map((p) => p[1]);
  const uMin = Math.min(...us);
  const uMax = Math.max(...us);
  const wMin = Math.min(...ws);
  const wMax = Math.max(...ws);

  const verts = [];
  const vmap = new Map();
  const index = [];
  const vid = (p) => {
    const key = `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    let id = vmap.get(key);
    if (id === undefined) {
      id = verts.length;
      verts.push(p);
      vmap.set(key, id);
    }
    return id;
  };

  for (let u = uMin; u < uMax; u += cell) {
    for (let w = wMin; w < wMax; w += cell) {
      const piece = clipPolygon(poly, [u, w, Math.min(u + cell, uMax), Math.min(w + cell, wMax)]);
      if (piece.length < 3 || Math.abs(polygonArea(piece)) < 1e-10) continue;
      const tris = ShapeUtils.triangulateShape(piece.map(([a, b]) => new Vector2(a, b)), []);
      for (const t of tris) index.push(vid(piece[t[0]]), vid(piece[t[1]]), vid(piece[t[2]]));
    }
  }

  const pos = [];
  const nor = [];
  const uv = [];
  const ok = new Uint8Array(verts.length);
  verts.forEach((p, i) => {
    const hit = projector.cast(p[0], p[1]);
    if (!hit) {
      pos.push(0, 0, 0);
      nor.push(0, 1, 0);
    } else {
      ok[i] = 1;
      const edge = bulge ? Math.min(1, distToOutline(p, poly) / bulgeWidth) : 0;
      const l = lift + bulge * Math.sin((edge * Math.PI) / 2);
      const q = hit.point.addScaledVector(hit.normal, l);
      pos.push(q.x, q.y, q.z);
      nor.push(hit.normal.x, hit.normal.y, hit.normal.z);
    }
    uv.push((p[0] - uMin) / (uMax - uMin), (p[1] - wMin) / (wMax - wMin));
  });
  const kept = [];
  for (let i = 0; i < index.length; i += 3) {
    if (ok[index[i]] && ok[index[i + 1]] && ok[index[i + 2]]) kept.push(index[i], index[i + 1], index[i + 2]);
  }

  // Winding: triangles are CCW in (u, w); flip if that faces into the body.
  const cross = new Vector3().crossVectors(projector.u, projector.w);
  if (cross.dot(projector.dir) > 0) {
    for (let i = 0; i < kept.length; i += 3) {
      const t = kept[i + 1];
      kept[i + 1] = kept[i + 2];
      kept[i + 2] = t;
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(kept);
  return g;
}

/** Project a polyline (e.g. outline) to 3D points on the body, offset by lift. */
export function projectLine(projector, points, lift = 0.004) {
  const out = [];
  for (const [u, w] of points) {
    const hit = projector.cast(u, w);
    if (hit) out.push(hit.point.addScaledVector(hit.normal, lift));
  }
  return out;
}

/** Polygon with filleted corners — crisp, "designed" shapes for intakes and trims. */
export function roundedPolygon(points, radius = 0.02, seg = 6) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const a = points[(i + n - 1) % n];
    const b = points[(i + 1) % n];
    const da = [a[0] - p[0], a[1] - p[1]];
    const db = [b[0] - p[0], b[1] - p[1]];
    const la = Math.hypot(...da);
    const lb = Math.hypot(...db);
    const r = Array.isArray(radius) ? radius[i] : radius;
    const d = Math.min(r, la * 0.45, lb * 0.45);
    const s = [p[0] + (da[0] / la) * d, p[1] + (da[1] / la) * d];
    const e = [p[0] + (db[0] / lb) * d, p[1] + (db[1] / lb) * d];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]]);
    }
  }
  return out;
}
