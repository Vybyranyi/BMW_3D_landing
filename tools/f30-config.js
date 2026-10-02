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
    // 551 = strut-tower brace (not on my car), 553/568 = roll cage
    skip: [551, 553, 568, 556, 567, 554, 557, 558, 559, 564, 566],
    // 549 = trim set: window-surround mouldings (black), roof strips + shark fin (white, masks below)
    // 560 = interior pillar trims (black)
    over: { 549: 'trim', 550: 'satin', 552: 'satin', 555: 'interior', 560: 'interior', 561: 'satin', 562: 'satin', 563: 'metal', 565: 'under', 569: 'satin' },
    masks: [
      { mesh: 548, mat: 'interior', min: [-0.0275, -0.0425, 0.2625], max: [-0.0175, -0.0383, 0.269] }, // rear-view mirror
      { mesh: 549, mat: 'satin', min: [-1, -0.0545, 0.2835], max: [1, -0.05, 0.2975] }, // wipers + cowl seal
      { mesh: 549, mat: 'paint', min: [-0.0425, -0.0395, 0.219], max: [-0.0365, -0.034, 0.265] }, // roof strips, body colour
      { mesh: 549, mat: 'paint', min: [-0.0085, -0.0395, 0.219], max: [-0.0025, -0.034, 0.265] },
      { mesh: 549, mat: 'paint', min: [-0.0250, -0.0372, 0.216], max: [-0.0200, -0.033, 0.230] }, // shark fin
    ],
  },
  { part: 'body', src: 'g50.1', mat: 'paint', off: [0.064621, -0.07687, 0] }, // flat roof with a real sunroof opening
  { part: 'body', src: 'g67', mat: 'glassRoof', off: [0.0646, -0.12035, 0] }, // closed sunroof glass, flush
  { part: 'body', src: 'g68.0', mat: 'headliner', off: [0.1201, 0, 0] }, // black headliner with sunroof opening
  { part: 'body', src: 'g19.17', mat: 'paint', off: [DX19, 0, 0] }, // plain front fenders
  { part: 'body', src: 'g19.18', mat: 'paint', off: [DX19, 0, 0] },
  {
    part: 'body', src: 'g19.20', mat: 'paint', off: [DX19, 0, 0], over: { 154: 'black', 155: 'chrome', 156: LENS, 157: 'fog' }, // M Sport front bumper
    // M Performance splitter wraps the lower bumper corners under the fog lights (black), centre stays white
    masks: [
      { mesh: 153, mat: 'gloss', planes: [{ n: [0, 1, 0], p: [0, -0.0694, 0] }, { n: [0.0038, 0.0035, 0], p: [-0.0345, -0.0694, 0] }] },
      { mesh: 153, mat: 'gloss', planes: [{ n: [0, 1, 0], p: [0, -0.0694, 0] }, { n: [-0.0038, 0.0035, 0], p: [-0.0104, -0.0694, 0] }] },
    ],
  },
  { part: 'body', src: 'g20.0', mat: 'gloss', off: [DX19, -0.0007, -0.0424] }, // M Performance front splitter, a touch lower
  { part: 'body', src: 'g19.6', mat: 'black', off: [DX19, 0, -0.0175] }, // black kidneys
  {
    part: 'body', src: 'g19.15', mat: 'headInner', off: [DX19, 0, 0], // headlights (LED, LCI)
    mirrorOf: 'g19.16',
  },
  { part: 'body', src: 'g19.16', mat: 'headInner', off: [DX19, 0, 0], over: { 144: 'black', 146: 'drl', 147: 'drl', 148: 'chrome', 149: LENS } },
  { part: 'body', src: 'k64', mat: 'paint', over: { 386: 'blade' } }, // white sills + black M Performance blades
  { part: 'body', src: 'g6.3', mat: 'paint', off: [DX19, 0, 0], over: { 26: 'satin', 27: 'reflector' } }, // M Sport rear bumper (catalogue C)
  { part: 'body', src: 'm256', mat: 'chrome', off: [0.0011, 0.00045, 0.001] }, // dual exhaust tips, left (catalogue F), in the diffuser recess
  { part: 'body', src: 'g22.6', mat: 'gloss', off: [0, 0, 0.0705] }, // diffuser (catalogue D)
  // outer taillights: the L-shaped light guide (437) glows, the back plates (434/435) stay dark red
  { part: 'body', src: 'k85', mat: 'tailDark', over: { 433: 'headInner', 434: 'tailDark', 435: 'tailDark', 436: 'tailLed', 437: 'tailLed' } },
  { part: 'body', src: 'k89', mat: 'tailDark', mirrorOf: 'k85' },
  { part: 'body', src: 'k83', mat: 'tailLens', alignTo: 'k85', dy: -0.005377 }, // red lenses, height fitted to the housing
  { part: 'body', src: 'k86', mat: 'tailLens', alignTo: 'k89', dy: -0.006372 },
  { part: 'body', src: 'k107', mat: 'glass' }, // windshield
  { part: 'body', src: 'k106', mat: 'glass' }, // rear window
  { part: 'body', src: 'k131', mat: 'satin' }, // wipers
  { part: 'body', src: 'k132', mat: 'satin' },

  /* ---------------------------------------------------------------- interior */
  { part: 'body', src: 'k28', mat: 'interior' }, // dashboard
  { part: 'body', src: 'k114', mat: 'interior' }, // sport seats (not M seats)
  { part: 'body', src: 'k119', mat: 'interior' },
  { part: 'body', src: 'k118', mat: 'interior' }, // rear bench
  { part: 'body', src: 'k112', mat: 'interior' }, // M steering wheel
  { part: 'body', src: 'k27', mat: 'interior' }, // gear selector

  /* ---------------------------------------------------------------- engine bay */
  { part: 'body', src: 'k37', mat: 'satin' }, // engine cover

  /* ---------------------------------------------------------------- opening panels */
  { part: 'hood', src: 'g19.19', mat: 'paint', off: [DX19, 0, 0] },
  {
    part: 'trunk', src: 'k94', mat: 'paint',
    over: { 490: 'satin', 491: 'satin', 492: 'satin', 493: 'satin' },
  },
  { part: 'trunk', src: 'k84', mat: 'tailDark', over: { 427: 'tailLed', 428: 'tailLed', 431: 'tailLed' } }, // inner taillights
  { part: 'trunk', src: 'k88', mat: 'tailDark', mirrorOf: 'k84' },
  { part: 'trunk', src: 'k138', mat: 'tailLens', alignTo: 'k84', dy: -0.01121 },
  { part: 'trunk', src: 'k139', mat: 'tailLens', alignTo: 'k88', dy: -0.011227 },

  {
    part: 'doorFL', src: 'k98', mat: 'paint',
    over: { 507: 'trim', 508: 'trim', 509: 'satin', 510: 'interior', 511: 'satin', 512: 'interior', 513: 'interior', 514: 'satin', 515: 'interior' },
    masks: [{ mesh: 506, mat: 'interior', min: [-1, -1, -1], max: [0.0006, 1, 1] }], // cabin side of the frame
  },
  { part: 'doorFL', src: 'k100', mat: 'glass' },
  { part: 'doorFL', src: 'k167', mat: 'paint' },
  { part: 'doorFL', src: 'k152', mat: 'gloss', over: { 729: 'satin', 730: 'mirror' } }, // black M-style mirror with the fin
  {
    part: 'doorFR', src: 'k103', mat: 'paint',
    over: { 532: 'trim', 533: 'trim', 534: 'satin', 535: 'interior', 536: 'trim', 537: 'interior', 538: 'interior', 539: 'interior' },
    masks: [{ mesh: 531, mat: 'interior', min: [-0.0455, -1, -1], max: [1, 1, 1] }],
  },
  { part: 'doorFR', src: 'k105', mat: 'glass' },
  { part: 'doorFR', src: 'k170', mat: 'paint' },
  { part: 'doorFR', src: 'k151', mat: 'gloss', over: { 725: 'satin', 726: 'mirror' } },
  {
    part: 'doorRL', src: 'k96', mat: 'paint',
    over: { 498: 'trim', 499: 'satin', 500: 'interior', 501: 'trim', 502: 'interior', 503: 'interior' },
    masks: [{ mesh: 497, mat: 'interior', min: [-1, -1, -1], max: [0.0006, 1, 1] }],
  },
  { part: 'doorRL', src: 'k97', mat: 'glass' },
  { part: 'doorRL', src: 'k168', mat: 'paint' },
  {
    part: 'doorRR', src: 'k101', mat: 'paint',
    over: { 523: 'trim', 524: 'satin', 525: 'interior', 526: 'trim', 527: 'interior', 528: 'interior' },
    masks: [{ mesh: 522, mat: 'interior', min: [-0.0455, -1, -1], max: [1, 1, 1] }],
  },
  { part: 'doorRR', src: 'k102', mat: 'glass' },
  { part: 'doorRR', src: 'k169', mat: 'paint' },

  /* ---------------------------------------------------------------- wheel (one template, placed ×4 at runtime) */
  { part: 'wheel', src: 'k5', mat: 'rim', over: { 218: 'skip', 219: 'black', 221: 'skip', 222: 'disc' } },
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
