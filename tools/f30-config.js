/*
 * Which pieces of the source kit (bmw-3-series-f30-2011-2018) make up MY car, where they go,
 * and what they are made of. Used by tools/inspector.js (preview + export).
 *
 * src:  'k<i>'  = child i of the main assembly group (root/node_id1759)
 *       'g<i>'  = top-level group i,  'g<i>.<j>' = its child j
 *       'm<i>'  = single mesh (three.js traversal index)
 * off:  world offset in source units (variants are parked next to / above the car)
 * mat:  default material for the group;  over: { meshId: material }
 */
const DX19 = -0.155; // the stock F30 parts set (g19, g20) sits 0.155 to the side

const LENS = 'glassClear';

export const PARTS = [
  /* ---------------------------------------------------------------- body shell */
  {
    part: 'body', src: 'k108', mat: 'paint',
    skip: [553, 568, 556, 567, 554, 557, 558, 559, 564, 566],
    over: { 549: 'black', 550: 'satin', 551: 'metal', 552: 'satin', 555: 'interior', 561: 'satin', 562: 'satin', 563: 'metal', 565: 'under', 569: 'satin' },
  },
  { part: 'body', src: 'k148', mat: 'paint' }, // roof
  { part: 'body', src: 'g67', mat: 'glassRoof', off: [0.0646, -0.11995, 0] }, // sunroof glass
  { part: 'body', src: 'g68.0', mat: 'headliner', off: [0.1201, 0, 0] }, // white headliner with sunroof opening
  { part: 'body', src: 'g19.17', mat: 'paint', off: [DX19, 0, 0] }, // plain front fenders
  { part: 'body', src: 'g19.18', mat: 'paint', off: [DX19, 0, 0] },
  { part: 'body', src: 'g19.20', mat: 'paint', off: [DX19, 0, 0], over: { 154: 'black', 155: 'chrome', 156: LENS, 157: 'black' } }, // M Sport front bumper
  { part: 'body', src: 'g20.0', mat: 'gloss', off: [DX19, 0, -0.0424] }, // M Performance front splitter
  { part: 'body', src: 'g19.6', mat: 'black', off: [DX19, 0, -0.0175] }, // black kidneys
  {
    part: 'body', src: 'g19.15', mat: 'headInner', off: [DX19, 0, 0], // headlights (LED, LCI)
    mirrorOf: 'g19.16',
  },
  { part: 'body', src: 'g19.16', mat: 'headInner', off: [DX19, 0, 0], over: { 144: 'drl', 146: 'drl', 147: 'drl', 148: 'chrome', 149: LENS } },
  { part: 'body', src: 'k64', mat: 'gloss' }, // M Performance side blades
  { part: 'body', src: 'g5', mat: 'paint', off: [DX19, -0.0181, 0], over: { 14: 'skip', 15: 'skip', 17: 'satin', 18: 'gloss', 19: 'gloss' } }, // rear bumper
  { part: 'body', src: 'm256', mat: 'chrome', off: [0.004, 0, 0] }, // dual exhaust tips, left
  { part: 'body', src: 'g27.1', mat: 'gloss', off: [0, 0, 0.172] }, // M Performance diffuser
  { part: 'body', src: 'k85', mat: 'tailDark', over: { 434: 'tailLed', 435: 'tailLed', 436: 'tailLed', 433: 'chrome' } }, // outer taillights
  { part: 'body', src: 'k89', mat: 'tailDark', mirrorOf: 'k85' },
  { part: 'body', src: 'k83', mat: 'tailLens', alignTo: 'k85' }, // red lenses
  { part: 'body', src: 'k86', mat: 'tailLens', alignTo: 'k89' },
  { part: 'body', src: 'k107', mat: 'glass' }, // windshield
  { part: 'body', src: 'k106', mat: 'glass' }, // rear window
  { part: 'body', src: 'k131', mat: 'satin' }, // wipers
  { part: 'body', src: 'k132', mat: 'satin' },

  /* ---------------------------------------------------------------- interior */
  { part: 'body', src: 'k28', mat: 'interior' }, // dashboard
  { part: 'body', src: 'k54', mat: 'interior' }, // M sport seats
  { part: 'body', src: 'k55', mat: 'interior' },
  { part: 'body', src: 'k118', mat: 'interior' }, // rear bench
  { part: 'body', src: 'k112', mat: 'interior' }, // M steering wheel
  { part: 'body', src: 'k27', mat: 'interior' }, // gear selector

  /* ---------------------------------------------------------------- engine bay */
  { part: 'body', src: 'k113', mat: 'metal' },
  { part: 'body', src: 'k37', mat: 'satin' },

  /* ---------------------------------------------------------------- opening panels */
  { part: 'hood', src: 'g19.19', mat: 'paint', off: [DX19, 0, 0] },
  {
    part: 'trunk', src: 'k94', mat: 'paint',
    over: { 490: 'satin', 491: 'satin', 492: 'satin', 493: 'satin' },
  },
  { part: 'trunk', src: 'k84', mat: 'tailDark', over: { 427: 'tailLed', 428: 'tailLed', 431: 'tailLed' } }, // inner taillights
  { part: 'trunk', src: 'k88', mat: 'tailDark', mirrorOf: 'k84' },
  { part: 'trunk', src: 'k138', mat: 'tailLens', alignTo: 'k84' },
  { part: 'trunk', src: 'k139', mat: 'tailLens', alignTo: 'k88' },

  {
    part: 'doorFL', src: 'k98', mat: 'paint',
    over: { 507: 'gloss', 508: 'gloss', 509: 'satin', 510: 'interior', 511: 'satin', 512: 'interior', 513: 'interior', 514: 'satin', 515: 'interior' },
  },
  { part: 'doorFL', src: 'k100', mat: 'glass' },
  { part: 'doorFL', src: 'k167', mat: 'paint' },
  { part: 'doorFL', src: 'g19.14', mat: 'paint', off: [DX19, 0, 0], over: { 132: 'gloss', 133: 'indicator', 134: LENS, 135: 'mirror' } },
  {
    part: 'doorFR', src: 'k103', mat: 'paint',
    over: { 532: 'gloss', 533: 'gloss', 534: 'satin', 535: 'interior', 536: 'gloss', 537: 'interior', 538: 'interior', 539: 'interior' },
  },
  { part: 'doorFR', src: 'k105', mat: 'glass' },
  { part: 'doorFR', src: 'k170', mat: 'paint' },
  { part: 'doorFR', src: 'g19.10', mat: 'paint', off: [DX19, 0, 0], mirrorOf: 'g19.14' },
  {
    part: 'doorRL', src: 'k96', mat: 'paint',
    over: { 498: 'gloss', 499: 'satin', 500: 'interior', 501: 'gloss', 502: 'interior', 503: 'interior' },
  },
  { part: 'doorRL', src: 'k97', mat: 'glass' },
  { part: 'doorRL', src: 'k168', mat: 'paint' },
  {
    part: 'doorRR', src: 'k101', mat: 'paint',
    over: { 523: 'gloss', 524: 'satin', 525: 'interior', 526: 'gloss', 527: 'interior', 528: 'interior' },
  },
  { part: 'doorRR', src: 'k102', mat: 'glass' },
  { part: 'doorRR', src: 'k169', mat: 'paint' },

  /* ---------------------------------------------------------------- wheel (one template, placed ×4 at runtime) */
  { part: 'wheel', src: 'k188', mat: 'rim', over: { 782: 'rim', 783: 'disc', 785: 'skip' } },
];

/* Car frame in source units (measured from the wheel arches). */
export const FRAME = {
  centerX: -0.02245,
  axleY: -0.0684,
  frontAxleZ: 0.3025,
  rearAxleZ: 0.2154,
  // 4.633 m bumper-to-bumper
  scale: 32.25,
  tireRadius: 0.011, // generated tyre, source units
};
