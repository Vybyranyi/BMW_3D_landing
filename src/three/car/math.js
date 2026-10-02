export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Monotone cubic (Fritsch–Carlson) interpolation through [x, y] points.
 * Used for every side/plan profile of the body so curves never overshoot.
 */
export function curve(points) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] > x) hi = mid;
      else lo = mid;
    }
    const h = xs[hi] - xs[lo];
    const t = (x - xs[lo]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[lo] +
      (t3 - 2 * t2 + t) * h * m[lo] +
      (-2 * t3 + 3 * t2) * ys[hi] +
      (t3 - t2) * h * m[hi]
    );
  };
}

/**
 * Catmull-Rom style Hermite through knots `ks` with values `vs`, evaluated at s.
 * Values change per call (they depend on x), so tangents are computed inline.
 */
export function hermite(ks, vs, s) {
  const n = ks.length;
  if (s <= ks[0]) return vs[0];
  if (s >= ks[n - 1]) return vs[n - 1];
  let i = 0;
  while (i < n - 2 && s > ks[i + 1]) i++;
  const k0 = ks[i];
  const k1 = ks[i + 1];
  const h = k1 - k0;
  const t = (s - k0) / h;
  const m0 = i > 0 ? ((vs[i + 1] - vs[i - 1]) / (ks[i + 1] - ks[i - 1])) * h : vs[i + 1] - vs[i];
  const m1 = i < n - 2 ? ((vs[i + 2] - vs[i]) / (ks[i + 2] - ks[i])) * h : vs[i + 1] - vs[i];
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * vs[i] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * vs[i + 1] + (t3 - t2) * m1;
}
