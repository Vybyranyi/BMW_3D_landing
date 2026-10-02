import { curve, hermite } from './math.js';

/*
 * BMW F30 (LCI, M Sport) proportions in metres.
 * Frame: +x forward, +y up, +z = right side of the car. Origin = ground, middle of the wheelbase.
 */
export const DIM = {
  xFront: 2.215,
  xRear: -2.42,
  halfWidth: 0.905,
  axleF: 1.405,
  axleR: -1.405,
  wheelR: 0.332,
  archR: 0.362,
  archY: 0.335,
  wellZ: 0.56,
  trackF: 0.772,
  trackR: 0.79,
  cowlX: 0.86,
  rearGlassX: -1.76,
};

export const yBottom = curve([
  [-2.42, 0.36], [-2.38, 0.28], [-2.25, 0.245], [-1.9, 0.2], [-1.5, 0.18],
  [1.2, 0.18], [1.8, 0.2], [2.1, 0.21], [2.215, 0.235],
]);

export const yShoulder = curve([
  [-2.42, 0.8], [-2.0, 0.86], [-1.2, 0.86], [0, 0.83], [1.2, 0.8], [1.9, 0.76], [2.215, 0.66],
]);

/** Top of the lower body: trunk deck → beltline → hood. */
export const yTop = curve([
  [-2.42, 0.94], [-2.395, 1.005], [-2.33, 1.035], [-2.15, 1.047], [-1.9, 1.05], [-1.76, 1.046],
  [-1.4, 1.03], [-0.6, 1.006], [0.2, 0.99], [0.86, 0.985], [1.3, 0.945], [1.7, 0.893],
  [2.0, 0.855], [2.12, 0.822], [2.18, 0.79], [2.215, 0.72],
]);

const crown = curve([
  [-2.42, 0], [-2.3, 0.012], [-1.76, 0.012], [0.86, 0.02], [1.2, 0.03], [2.0, 0.03], [2.215, 0],
]);

/** Roof line of the greenhouse (windshield → roof → rear window). */
export const yRoof = curve([
  [-1.76, 1.046], [-1.55, 1.17], [-1.3, 1.29], [-1.05, 1.375], [-0.7, 1.418], [-0.35, 1.43],
  [0.0, 1.412], [0.25, 1.315], [0.55, 1.15], [0.86, 0.985],
]);

/** Plan-view half width: superellipse nose and tail. */
export function halfWidth(x) {
  const W = DIM.halfWidth;
  if (x > 1.15) {
    const t = Math.min(1, (x - 1.15) / (DIM.xFront - 1.15));
    return W * Math.pow(Math.max(0, 1 - Math.pow(t, 3.0)), 1 / 3.0);
  }
  if (x < -1.55) {
    const t = Math.min(1, (-1.55 - x) / (-1.55 - DIM.xRear));
    return W * Math.pow(Math.max(0, 1 - Math.pow(t, 3.6)), 1 / 3.6);
  }
  return W;
}

/*
 * Lower body cross-section, s ∈ [0,1] from bottom centre → sill → shoulder → belt → top centre.
 * Fixed knots mean a given s is the same "feature" along the whole car, which lets panels
 * (doors, hood, trunk) be cut as clean rectangles in (x, s) space.
 */
const LS = [0, 0.12, 0.2, 0.26, 0.31, 0.34, 0.4, 0.42, 0.44, 0.55, 0.64, 0.7, 0.85, 1.0];
const LZ = [0, 0.8, 0.95, 0.982, 0.974, 0.99, 0.993, 1.0, 0.991, 0.972, 0.94, 0.86, 0.45, 0];
const ly = new Array(LS.length);

/** Lower swage line on the doors — rises towards the rear like the real F30. */
const ySwage = curve([[-2.42, 0.47], [-1.0, 0.41], [0.9, 0.34], [2.215, 0.36]]);

export const lowerBody = {
  point(x, s, out) {
    const W = halfWidth(x);
    const yb = yBottom(x);
    const ys = yShoulder(x);
    const yt = yTop(x);
    const c = crown(x);
    const sw = ySwage(x);
    ly[0] = yb;
    ly[1] = yb;
    ly[2] = yb + 0.035;
    ly[3] = yb + 0.09;
    ly[4] = sw - 0.015;
    ly[5] = sw + 0.02;
    ly[6] = ys - 0.035;
    ly[7] = ys;
    ly[8] = ys + 0.022;
    ly[9] = ys + 0.6 * (yt - ys);
    ly[10] = yt - 0.012;
    ly[11] = yt;
    ly[12] = yt + c * 0.75;
    ly[13] = yt + c;
    out.set(x, hermite(LS, ly, s), W * hermite(LS, LZ, s));
    return out;
  },
  xMin: DIM.xRear,
  xMax: DIM.xFront,
  sRes: 150,
  arc: (x) => halfWidth(x),
};

/* Greenhouse: s ∈ [0,1] from the beltline up the side glass, over the roof rail, to the roof centre. */
const GS = [0, 0.3, 0.55, 0.62, 0.7, 0.85, 1.0];
const GZ = [1.0, 0.95, 0.865, 0.83, 0.75, 0.45, 0];
const GY = [0, 0.46, 0.85, 0.925, 0.965, 0.993, 1.0];

export const greenhouse = {
  point(x, s, out) {
    const Wg = 0.86 * halfWidth(x) - 0.003;
    const belt = yTop(x) - 0.002;
    const H = Math.max(0, yRoof(x) - belt);
    out.set(x, belt + H * hermite(GS, GY, s), Wg * hermite(GS, GZ, s));
    return out;
  },
  xMin: DIM.rearGlassX,
  xMax: DIM.cowlX,
  sRes: 110,
  arc: (x) => yRoof(x),
};

/** Rear edge of the rear side glass — the Hofmeister kink. */
export const glassRearX = curve([
  [0, -1.07], [0.06, -1.125], [0.12, -1.14], [0.25, -1.105], [0.4, -1.04], [0.56, -0.975],
]);
