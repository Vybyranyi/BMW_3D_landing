// Dev-only: inspect the source GLB. Everything is driven from the console / automation.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('c');
const info = document.getElementById('info');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202328);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, 1, 0.001, 100);
const controls = new OrbitControls(camera, canvas);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);

const url = new URLSearchParams(location.search).get('src') || '/bmw-3-series-f30-2011-2018/source/model%20(2).glb';
const t0 = performance.now();
new GLTFLoader().load(url, (gltf) => {
  const root = gltf.scene;
  scene.add(root);
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    const idx = o.geometry.index;
    const assoc = gltf.parser.associations.get(o) || {};
    meshes.push({ id: meshes.length, node: assoc.nodes, gmesh: assoc.meshes, prim: assoc.primitives, obj: o, box, tris: (idx ? idx.count : o.geometry.attributes.position.count) / 3, origMat: o.material });
  });
  const all = new THREE.Box3().setFromObject(root);
  window.M = meshes;
  window.root = root;
  window.ALL = all;
  info.textContent = `meshes ${meshes.length}  load ${Math.round(performance.now() - t0)}ms\nmin ${all.min.toArray().map((v) => v.toFixed(3))}\nmax ${all.max.toArray().map((v) => v.toFixed(3))}`;
  frame(all);
  window.onModel();
  render();
});

function frame(box) {
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3()).length();
  controls.target.copy(c);
  camera.position.copy(c).add(new THREE.Vector3(0.6, 0.35, 0.8).multiplyScalar(s));
  camera.near = s / 1000;
  camera.far = s * 20;
  camera.updateProjectionMatrix();
  controls.update();
}

function render() {
  renderer.render(scene, camera);
}
controls.addEventListener('change', render);

// --- helpers for automation
window.render = render;
window.scene = scene;
window.renderer = renderer;
window.THREE = THREE;
window.camera = camera;
window.controls = controls;
window.frame = frame;
window.setView = (dir, target, dist) => {
  controls.target.set(...target);
  camera.position.set(target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist);
  controls.update();
  render();
};
window.showOnly = (ids) => {
  const set = new Set(ids);
  M.forEach((m) => (m.obj.visible = set.has(m.id)));
  render();
};
window.showAll = () => {
  M.forEach((m) => (m.obj.visible = true));
  render();
};
window.hide = (ids) => {
  ids.forEach((i) => (M[i].obj.visible = false));
  render();
};
const hi = new THREE.MeshBasicMaterial({ color: 0xff2266 });
window.highlight = (ids, on = true) => {
  const set = new Set(ids);
  M.forEach((m) => (m.obj.material = on && set.has(m.id) ? hi : m.origMat));
  render();
};
window.colorize = (groups) => {
  // groups: [[ids, hex], ...]
  M.forEach((m) => (m.obj.material = m.origMat));
  for (const [ids, hex] of groups) {
    const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5 });
    ids.forEach((i) => (M[i].obj.material = mat));
  }
  render();
};
window.pick = (x, y) => {
  const r = new THREE.Raycaster();
  r.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = r.intersectObjects(M.filter((m) => m.obj.visible).map((m) => m.obj), false)[0];
  return hit ? M.find((m) => m.obj === hit.object).id : null;
};
canvas.addEventListener('click', (e) => {
  const id = pick(e.clientX, e.clientY);
  info.textContent = `picked ${id}`;
  console.log('picked', id);
});

// --- analysis helpers (after load)
const cv = document.createElement('canvas');
cv.width = cv.height = 8;
const cx = cv.getContext('2d', { willReadFrequently: true });
function avgColor(tex) {
  if (!tex || !tex.image) return [200, 200, 200, 255];
  cx.clearRect(0, 0, 8, 8);
  cx.drawImage(tex.image, 0, 0, 8, 8);
  const d = cx.getImageData(0, 0, 8, 8).data;
  const s = [0, 0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 4; c++) s[c] += d[i + c];
  return s.map((v) => Math.round(v / (d.length / 4)));
}
window.onModel = () => {
  M.forEach((m) => {
    m.color = avgColor(m.origMat.map);
    m.clay = new THREE.MeshStandardMaterial({
      color: new THREE.Color(`rgb(${m.color[0]},${m.color[1]},${m.color[2]})`),
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    m.obj.material = m.clay;
    m.origMat0 = m.origMat;
    m.origMat = m.clay;
  });
  scene.environment = null;
  scene.background = new THREE.Color(0x8a9098);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2);
  dl.position.set(0.3, 1, 0.6);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.8);
  dl2.position.set(-0.6, 0.3, -0.8);
  scene.add(dl2);
  const top = root.children[0].children;
  window.TOP = top.map((g, gi) => {
    const ids = [];
    g.traverse((o) => o.isMesh && ids.push(M.find((m) => m.obj === o).id));
    return { gi, ids };
  });
  window.K = top[28].children.map((c, ci) => {
    const ids = [];
    c.traverse((o) => o.isMesh && ids.push(M.find((m) => m.obj === o).id));
    const box = new THREE.Box3().setFromObject(c);
    return { ci, ids, box, ce: box.getCenter(new THREE.Vector3()), sz: box.getSize(new THREE.Vector3()) };
  });
  render();
};
window.showK = (list) => showOnly(list.flatMap((ci) => K[ci].ids));
window.CC = [-0.0225, -0.06, 0.256];
window.V = {
  q: [0.55, 0.3, 0.8], ql: [-0.55, 0.3, 0.8], rq: [0.6, 0.3, -0.75], rql: [-0.6, 0.3, -0.75],
  side: [1, 0.05, 0.0001], sider: [-1, 0.05, 0.0001], front: [0.0001, 0.08, 1], rear: [0.0001, 0.1, -1],
  top: [0.0001, 1, 0.0001], bottom: [0.0001, -1, 0.0001],
};
window.look = (v, d = 0.3, t = CC) => setView(V[v], t, d);

// Contact sheet: each item rendered in its own cell, framed on its bbox, with its label.
let labels = [];
window.sheet = (items, cols = 8, rows = 6, dir = [0.6, 0.45, 0.7]) => {
  // items: [{ label, ids }]
  labels.forEach((l) => l.remove());
  labels = [];
  const W = innerWidth;
  const H = innerHeight;
  const cw = Math.floor(W / cols);
  const ch = Math.floor(H / rows);
  renderer.setScissorTest(true);
  renderer.autoClear = false;
  renderer.setScissor(0, 0, W, H);
  renderer.setViewport(0, 0, W, H);
  renderer.setClearColor(0x6d737b);
  renderer.clear();
  const cam = new THREE.PerspectiveCamera(30, cw / ch, 0.0001, 10);
  items.slice(0, cols * rows).forEach((it, k) => {
    const c = k % cols;
    const r = Math.floor(k / cols);
    const x = c * cw;
    const y = H - (r + 1) * ch;
    renderer.setScissor(x + 1, y + 1, cw - 2, ch - 2);
    renderer.setViewport(x, y, cw, ch);
    renderer.setClearColor(0x8a9098);
    renderer.clear();
    const set = new Set(it.ids);
    M.forEach((m) => (m.obj.visible = set.has(m.id)));
    const box = new THREE.Box3();
    it.ids.forEach((i) => box.union(M[i].box));
    const ctr = box.getCenter(new THREE.Vector3());
    const rad = box.getSize(new THREE.Vector3()).length() / 2 || 0.001;
    const d = rad / Math.sin(THREE.MathUtils.degToRad(15)) * 0.9;
    const v = new THREE.Vector3(...dir).normalize();
    cam.position.copy(ctr).addScaledVector(v, d);
    cam.near = d / 100;
    cam.far = d * 10;
    cam.lookAt(ctr);
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const l = document.createElement('div');
    l.textContent = it.label;
    l.style.cssText = `position:fixed;left:${x + 3}px;top:${r * ch + 2}px;font:bold 11px monospace;color:#000;background:#fffc;padding:0 3px;pointer-events:none`;
    document.body.appendChild(l);
    labels.push(l);
  });
  renderer.setScissorTest(false);
  renderer.autoClear = true;
  renderer.setViewport(0, 0, W, H);
};
window.clearSheet = () => {
  labels.forEach((l) => l.remove());
  labels = [];
  showAll();
};

window.useTextures = (on = true) => {
  M.forEach((m) => {
    m.origMat = on ? m.origMat0 : m.clay;
    m.obj.material = m.origMat;
  });
  if (on) {
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  }
  render();
};

// Assembly preview: show a set of meshes, with optional world-space offsets per mesh.
const moved = new Map(); // id -> original local position
window.assemble = (ids, offsets = {}) => {
  for (const [id, pos] of moved) M[id].obj.position.copy(pos);
  moved.clear();
  showOnly(ids);
  for (const [id, d] of Object.entries(offsets)) {
    const o = M[id].obj;
    moved.set(+id, o.position.clone());
    const wp = o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...d));
    o.position.copy(o.parent.worldToLocal(wp));
    o.updateMatrixWorld(true);
  }
  render();
};
window.idsOfK = (list) => list.flatMap((ci) => K[ci].ids);
window.idsOfSub = (gi, list) => list.flatMap((ci) => sub(gi)[ci].ids);
window.sub = (gi) =>
  root.children[0].children[gi].children.map((c, ci) => {
    const ids = [];
    c.traverse((o) => o.isMesh && ids.push(M.find((m) => m.obj === o).id));
    return { label: `g${gi}.${ci} n${ids.length}`, ids };
  });

// --- session helpers
window.off = (ids, d) => Object.fromEntries(ids.map((i) => [i, d]));
window.DX19 = [-0.155, 0, 0];
window.CAGE = [551, 553, 556, 567, 568, 569];
window.bodyIds = () => K[108].ids.filter((i) => !CAGE.includes(i));
window.pts = (ids) => {
  const out = [];
  const v = new THREE.Vector3();
  for (const id of ids) {
    const o = M[id].obj;
    o.updateMatrixWorld(true);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      out.push([v.x, v.y, v.z]);
    }
  }
  return out;
};
const prevOnModel = window.onModel;
window.onModel = () => {
  prevOnModel();
  window.S19 = sub(19);
  window.S20 = sub(20);
};

// --- config resolution / preview / export
import { PARTS, FRAME } from './f30-config.js';

function resolveSrc(src) {
  if (src.startsWith('m')) return [+src.slice(1)];
  if (src.startsWith('k')) return K[+src.slice(1)].ids;
  const [g, c] = src.slice(1).split('.').map(Number);
  return c === undefined ? TOP[g].ids : sub(g)[c].ids;
}
const boxOf = (ids, offset = [0, 0, 0]) => {
  const b = new THREE.Box3();
  ids.forEach((i) => b.union(M[i].box));
  return b.translate(new THREE.Vector3(...offset));
};
window.resolveConfig = () => {
  const bySrc = new Map(PARTS.map((p) => [p.src, p]));
  const out = [];
  for (const p of PARTS) {
    const ids = resolveSrc(p.src);
    let offset = p.off || [0, 0, 0];
    if (p.alignTo) {
      const t = bySrc.get(p.alignTo);
      const tc = boxOf(resolveSrc(t.src), t.off).getCenter(new THREE.Vector3());
      const c = boxOf(ids).getCenter(new THREE.Vector3());
      offset = [tc.x - c.x, tc.y - c.y, tc.z - c.z];
    }
    let over = p.over || {};
    if (p.mirrorOf) {
      const twin = bySrc.get(p.mirrorOf);
      const twinIds = resolveSrc(twin.src);
      over = {};
      const used = new Set();
      for (const [id, m] of Object.entries(twin.over || {})) {
        // mirrored twins list their meshes in a different order — match by triangle count
        const match = ids.find((i) => !used.has(i) && M[i].tris === M[+id].tris);
        if (match !== undefined) {
          used.add(match);
          over[match] = m;
        }
      }
    }
    for (const id of ids) {
      if (p.skip?.includes(id)) continue;
      const mat = over[id] || p.mat;
      if (mat === 'skip') continue;
      const masks = (p.masks || []).filter((mk) => mk.mesh === id).map(({ mat: mm, min, max }) => ({ mat: mm, min, max }));
      out.push({ id, node: M[id].node, part: p.part, mat, off: offset, ...(masks.length ? { masks } : {}) });
    }
  }
  return out;
};

const PREVIEW = {
  paint: 0xf2f2f2, gloss: 0x0a0a0a, blade: 0x050505, satin: 0x2a2b2e, black: 0x111111, under: 0x1a1a1a, glass: 0x334455,
  glassRoof: 0x111122, glassClear: 0x99bbdd, headliner: 0xf4f1ea, interior: 0x222222, metal: 0x777a80,
  chrome: 0xcccccc, mirror: 0xaabbcc, headInner: 0x555555, drl: 0x99ddff, tailDark: 0x330000, tailLed: 0xff3300,
  tailLens: 0xcc0011, indicator: 0xffaa00, rim: 0xb0b3b8, disc: 0x666666,
};
const pmats = {};
window.previewConfig = () => {
  const entries = resolveConfig();
  const offs = {};
  entries.forEach((e) => (offs[e.id] = e.off));
  assemble(entries.map((e) => e.id).filter((id) => entries.find((e) => e.id === id).part !== 'wheel'), offs);
  for (const e of entries) {
    pmats[e.mat] ||= new THREE.MeshStandardMaterial({ color: PREVIEW[e.mat] ?? 0xff00ff, roughness: 0.45, metalness: e.mat === 'chrome' ? 0.8 : 0, side: THREE.DoubleSide, transparent: e.mat.startsWith('glass') || e.mat === 'tailLens', opacity: e.mat.startsWith('glass') ? 0.55 : e.mat === 'tailLens' ? 0.75 : 1 });
    M[e.id].obj.material = pmats[e.mat];
  }
  render();
  return entries.length;
};
window.exportConfig = async () => {
  const entries = resolveConfig().map(({ node, part, mat, off, masks }) => ({ node, part, mat, off, masks }));
  await fetch('/__save?file=f30-selection.json', { method: 'POST', body: JSON.stringify({ frame: FRAME, entries }) });
  return entries.length;
};

// --- parts catalogue: every option of a category on one lettered sheet (PNG) for the owner to pick from
window.units = () => {
  const out = K.map((k) => ({ code: `k${k.ci}`, ids: k.ids }));
  TOP.forEach((t) => {
    if (t.gi === 28) return;
    const kids = sub(t.gi);
    if (kids.length > 1) kids.forEach((s, ci) => out.push({ code: `g${t.gi}.${ci}`, ids: s.ids }));
    else out.push({ code: `g${t.gi}`, ids: t.ids });
  });
  for (const u of out) {
    u.box = new THREE.Box3();
    u.ids.forEach((i) => u.box.union(M[i].box));
    u.size = u.box.getSize(new THREE.Vector3()).multiplyScalar(1000);
    u.center = u.box.getCenter(new THREE.Vector3()).multiplyScalar(1000);
  }
  return out;
};
const inRange = (v, [a, b]) => v >= a && v <= b;
window.findUnits = ({ x, y, z, where = () => true }) =>
  units().filter((u) => inRange(u.size.x, x) && inRange(u.size.y, y) && inRange(u.size.z, z) && where(u));

window.catalogPNG = async (file, title, list, dir) => {
  const n = list.length;
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  const letters = list.map((_, i) => String.fromCharCode(65 + i));
  sheet(list.map((u, i) => ({ label: letters[i], ids: u.ids })), cols, rows, dir);
  labels.forEach((l) => (l.style.display = 'none'));
  const src = renderer.domElement;
  const c = document.createElement('canvas');
  const head = 70;
  c.width = src.width;
  c.height = src.height + head;
  const g = c.getContext('2d');
  g.fillStyle = '#16181c';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, head);
  g.fillStyle = '#fff';
  g.font = 'bold 40px sans-serif';
  g.fillText(title, 24, 50);
  const cw = src.width / cols;
  const ch = src.height / rows;
  list.forEach((u, i) => {
    const x = (i % cols) * cw;
    const y = head + Math.floor(i / cols) * ch;
    g.fillStyle = '#e7222e';
    g.fillRect(x + 10, y + 10, 64, 64);
    g.fillStyle = '#fff';
    g.font = 'bold 46px sans-serif';
    g.fillText(letters[i], x + 26, y + 58);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.font = '24px monospace';
    g.fillText(u.code, x + 86, y + 44);
  });
  await fetch(`/__save?file=${file}.png`, { method: 'POST', body: c.toDataURL('image/png') });
  labels.forEach((l) => l.remove());
  return list.map((u, i) => `${letters[i]}=${u.code}`).join(' ');
};
