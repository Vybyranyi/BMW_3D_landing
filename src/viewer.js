// Dev-only orbit viewer for tuning the procedural car: /viewer.html
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage } from './three/stage.js';
import { loadCar } from './three/car/model.js';
import { Smoke } from './three/smoke.js';

const canvas = document.getElementById('c');
const stage = createStage(canvas);
const t0 = performance.now();
const car = await loadCar();
console.log('car loaded in', Math.round(performance.now() - t0), 'ms');
stage.scene.add(car.group);
const smoke = new Smoke(stage.scene, car.exhaustTips);

const controls = new OrbitControls(stage.camera, canvas);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true;

const params = new URLSearchParams(location.search);
const view = params.get('view');
const views = {
  front: [6.5, 1.0, 0.6], side: [0.2, 1.0, -7.5], rear: [-6.5, 1.2, -1.5], top: [0.1, 9, 0.1],
  q: [5.2, 1.6, 4.2], ql: [4.5, 1.4, -4.8], rq: [-4.8, 1.5, -4.0], fc: [3.8, 0.8, 0.9],
};
stage.camera.position.set(...(views[view] || views.q));
if (params.get('fov')) stage.camera.fov = +params.get('fov');
stage.camera.updateProjectionMatrix();

const state = {
  hood: +(params.get('hood') || 0), doorF: +(params.get('doorF') || 0), doorR: +(params.get('doorR') || 0),
  trunk: +(params.get('trunk') || 0), lights: +(params.get('lights') ?? 1), brake: 0, wheelAngle: 0,
};
car.set(state);
stage.floorUniforms.uHead.value = state.lights;
smoke.rate = +(params.get('smoke') || 0);

const ui = document.getElementById('ui');
for (const key of ['hood', 'doorF', 'doorR', 'trunk', 'lights']) {
  const label = document.createElement('label');
  label.innerHTML = `${key} <input type="range" min="0" max="1" step="0.01" value="${state[key]}">`;
  label.querySelector('input').addEventListener('input', (e) => car.set({ [key]: +e.target.value }));
  ui.appendChild(label);
}

window.addEventListener('resize', stage.resize);
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  controls.update();
  smoke.update(dt);
  stage.render();
  requestAnimationFrame(loop);
}
loop();
window.__stage = stage;
window.__car = car;
window.__controls = controls;
