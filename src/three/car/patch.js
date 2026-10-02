import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { lerp } from './math.js';
import { DIM } from './profile.js';

/*
 * Arc-length lookup along x for a surface, so samples bunch up where the body curves hard
 * (the nose and tail corners) instead of being spread uniformly in x.
 */
const arcCache = new WeakMap();
function arcTable(surf) {
  let t = arcCache.get(surf);
  if (t) return t;
  const N = 6000;
  const xs = new Float64Array(N + 1);
  const as = new Float64Array(N + 1);
  let prevX = surf.xMin;
  let prevY = surf.arc(prevX);
  xs[0] = prevX;
  for (let i = 1; i <= N; i++) {
    const x = lerp(surf.xMin, surf.xMax, i / N);
    const y = surf.arc(x);
    as[i] = as[i - 1] + Math.hypot(x - prevX, y - prevY);
    xs[i] = x;
    prevX = x;
    prevY = y;
  }
  const A = (x) => {
    const f = ((x - surf.xMin) / (surf.xMax - surf.xMin)) * N;
    const i = Math.max(0, Math.min(N - 1, Math.floor(f)));
    return lerp(as[i], as[i + 1], f - i);
  };
  const X = (a) => {
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (as[mid] > a) hi = mid;
      else lo = mid;
    }
    const span = as[hi] - as[lo];
    return lerp(xs[lo], xs[hi], span > 0 ? (a - as[lo]) / span : 0);
  };
  t = { A, X };
  arcCache.set(surf, t);
  return t;
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();
const tmpD = new Vector3();

function surfaceNormal(surf, x, s, sign, out) {
  const h = 0.0015;
  const x0 = Math.max(surf.xMin, x - h);
  const x1 = Math.min(surf.xMax, x + h);
  const s0 = Math.max(0, s - h);
  const s1 = Math.min(1, s + h);
  surf.point(x1, s, tmpA);
  surf.point(x0, s, tmpB);
  tmpA.sub(tmpB);
  surf.point(x, s1, tmpC);
  surf.point(x, s0, tmpD);
  tmpC.sub(tmpD);
  out.crossVectors(tmpA, tmpC);
  if (out.lengthSq() < 1e-14) out.set(Math.sign(x) || 1, 0, 0);
  return out.normalize().multiplyScalar(sign);
}

const ARCHES = [
  { x: DIM.axleF, y: DIM.archY, r: DIM.archR },
  { x: DIM.axleR, y: DIM.archY, r: DIM.archR },
];

/**
 * Build one rectangular-ish patch of a parametric surface.
 * x0/x1 may be functions of s (row mode) or s0/s1 functions of x (column mode).
 */
export function buildPatch(surf, spec) {
  const { x0, x1, s0, s1, dx = 0.016, clipArches = false } = spec;
  const { A, X } = arcTable(surf);
  const rowMode = typeof x0 === 'function' || typeof x1 === 'function';
  const fx0 = typeof x0 === 'function' ? x0 : () => x0;
  const fx1 = typeof x1 === 'function' ? x1 : () => x1;
  const fs0 = typeof s0 === 'function' ? s0 : () => s0;
  const fs1 = typeof s1 === 'function' ? s1 : () => s1;

  // Resolution: widest row/column decides the sample count.
  let maxArc = 0;
  let maxS = 0;
  for (let k = 0; k <= 16; k++) {
    if (rowMode) {
      const s = lerp(fs0(0), fs1(0), k / 16);
      maxArc = Math.max(maxArc, Math.abs(A(fx1(s)) - A(fx0(s))));
      maxS = Math.max(maxS, fs1(0) - fs0(0));
    } else {
      const xa = fx0(0);
      const xb = fx1(0);
      const x = X(lerp(A(xa), A(xb), k / 16));
      maxArc = Math.max(maxArc, Math.abs(A(xb) - A(xa)));
      maxS = Math.max(maxS, fs1(x) - fs0(x));
    }
  }
  const nx = Math.max(2, Math.ceil(maxArc / dx));
  const ns = Math.max(2, Math.ceil(maxS * (spec.sRes ?? surf.sRes)));

  const pos = new Float32Array((nx + 1) * (ns + 1) * 3);
  const nor = new Float32Array((nx + 1) * (ns + 1) * 3);
  const uv = new Float32Array((nx + 1) * (ns + 1) * 2);
  const p = new Vector3();
  const n = new Vector3();

  for (let j = 0; j <= ns; j++) {
    for (let i = 0; i <= nx; i++) {
      let x;
      let s;
      if (rowMode) {
        s = lerp(fs0(0), fs1(0), j / ns);
        x = X(lerp(A(fx0(s)), A(fx1(s)), i / nx));
      } else {
        x = X(lerp(A(fx0(0)), A(fx1(0)), i / nx));
        s = lerp(fs0(x), fs1(x), j / ns);
      }
      surf.point(x, s, p);
      surfaceNormal(surf, x, s, 1, n);
      const k = j * (nx + 1) + i;
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = p.y;
      pos[k * 3 + 2] = p.z;
      nor[k * 3] = n.x;
      nor[k * 3 + 1] = n.y;
      nor[k * 3 + 2] = n.z;
      uv[k * 2] = i / nx;
      uv[k * 2 + 1] = j / ns;
    }
  }

  // Wheel-arch clipping: drop triangles fully inside an arch, snap boundary vertices onto it.
  const inside = new Uint8Array((nx + 1) * (ns + 1));
  if (clipArches) {
    for (let k = 0; k < inside.length; k++) {
      const x = pos[k * 3];
      const y = pos[k * 3 + 1];
      const z = pos[k * 3 + 2];
      if (Math.abs(z) < DIM.wellZ) continue;
      for (const a of ARCHES) {
        const dxa = x - a.x;
        const dya = y - a.y;
        if (dxa * dxa + dya * dya < a.r * a.r) {
          inside[k] = Math.abs(nor[k * 3 + 1]) > 0.7 ? 2 : 1; // 2 = underside vertex
          break;
        }
      }
    }
  }

  const idx = [];
  const snap = new Uint8Array(inside.length);
  for (let j = 0; j < ns; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 2;
      const d = a + nx + 1;
      for (const tri of [[a, b, c], [a, c, d]]) {
        if (clipArches) {
          const ins = tri.filter((v) => inside[v]).length;
          if (ins === 3) continue;
          if (tri.some((v) => inside[v] === 2)) continue;
          tri.forEach((v) => {
            if (inside[v]) snap[v] = 1;
          });
        }
        idx.push(tri[0], tri[1], tri[2]);
      }
    }
  }
  if (clipArches) {
    for (let k = 0; k < snap.length; k++) {
      if (!snap[k]) continue;
      const x = pos[k * 3];
      const y = pos[k * 3 + 1];
      for (const a of ARCHES) {
        const dxa = x - a.x;
        const dya = y - a.y;
        const r = Math.hypot(dxa, dya);
        if (r < a.r) {
          pos[k * 3] = a.x + (dxa / r) * a.r;
          pos[k * 3 + 1] = a.y + (dya / r) * a.r;
          break;
        }
      }
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Mirror a geometry across the car's centre plane (z → -z), fixing winding and normals. */
export function mirrorZ(geo) {
  const g = geo.clone();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    p.setZ(i, -p.getZ(i));
    if (n) n.setZ(i, -n.getZ(i));
  }
  const index = g.index;
  if (index) {
    const arr = index.array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = t;
    }
    index.needsUpdate = true;
  } else {
    for (const name of Object.keys(g.attributes)) {
      const attr = g.attributes[name];
      const s = attr.itemSize;
      for (let i = 0; i < attr.count; i += 3) {
        for (let c = 0; c < s; c++) {
          const t = attr.array[(i + 1) * s + c];
          attr.array[(i + 1) * s + c] = attr.array[(i + 2) * s + c];
          attr.array[(i + 2) * s + c] = t;
        }
      }
    }
  }
  return g;
}

/** Patch on the +z side plus its mirror. */
export function both(surf, spec) {
  const g = buildPatch(surf, spec);
  return [g, mirrorZ(g)];
}
