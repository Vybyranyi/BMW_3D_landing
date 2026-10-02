import * as THREE from 'three';
import { createStage } from '../three/stage.js';
import { buildCar } from '../three/car/index.js';
import { Smoke } from '../three/smoke.js';
import { CHAPTERS, HOTSPOTS, HERO, CAR } from '../content.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Piecewise track: [[p, value], ...] with eased transitions. Value may be a number or an array. */
function track(keys) {
  return (p) => {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [p0, v0] = keys[i];
      const [p1, v1] = keys[i + 1];
      if (p <= p1) {
        const t = smoother(clamp((p - p0) / (p1 - p0)));
        if (Array.isArray(v0)) return v0.map((a, k) => a + (v1[k] - a) * t);
        return v0 + (v1 - v0) * t;
      }
    }
    return keys[keys.length - 1][1];
  };
}

/* Camera: [azimuth°, elevation°, distance, targetX, targetY, targetZ]. az 0 = in front, -90 = driver side. */
const camera = track([
  [0.0, [36, 9, 7.8, 0.0, 0.6, 0]],
  [0.06, [52, 12, 7.0, 0.0, 0.62, 0]],
  [0.12, [5, 4, 5.0, 1.75, 0.52, 0]],
  [0.2, [12, 7, 5.0, 1.7, 0.52, 0]],
  [0.25, [28, 32, 5.0, 1.45, 0.74, 0]],
  [0.33, [38, 40, 4.5, 1.45, 0.78, 0]],
  [0.39, [-36, 14, 6.8, 0.0, 0.7, 0]],
  [0.45, [-48, 15, 6.4, -0.1, 0.75, 0]],
  [0.5, [-62, 22, 4.2, 0.0, 0.85, -0.3]],
  [0.54, [-68, 20, 4.0, 0.0, 0.85, -0.3]],
  [0.59, [-90, 3, 6.8, 0, 0.6, 0]],
  [0.68, [-98, 4, 6.2, 0, 0.56, 0]],
  [0.74, [-146, 9, 5.4, -1.7, 0.5, 0]],
  [0.82, [-160, 7, 4.8, -2.0, 0.45, 0]],
  [0.88, [-182, 30, 5.4, -1.9, 0.9, 0]],
  [0.93, [-205, 52, 7.8, -0.6, 0.6, 0]],
  [1.0, [-250, 74, 10.5, 0, 0.4, 0]],
]);

const tracks = {
  hood: track([[0.215, 0], [0.27, 1], [0.345, 1], [0.38, 0]]),
  doorF: track([[0.41, 0], [0.46, 1], [0.54, 1], [0.575, 0]]),
  doorR: track([[0.42, 0], [0.47, 1], [0.535, 1], [0.565, 0]]),
  drive: track([[0.565, 0], [0.6, 1], [0.69, 1], [0.725, 0]]),
  brake: track([[0.69, 0], [0.71, 1], [0.76, 1], [0.79, 0]]),
  smoke: track([[0.705, 0], [0.735, 1], [0.835, 1], [0.86, 0.15], [0.95, 0]]),
  trunk: track([[0.85, 0], [0.885, 1], [0.925, 1], [0.955, 0]]),
  grid: track([[0, 0.3], [0.56, 0.3], [0.6, 0.7], [0.7, 0.7], [0.74, 0.3]]),
  // Horizontal frame shift (fraction of width) so the car sits opposite the chapter text.
  shift: track([
    [0, 0.1], [0.06, 0.1], [0.11, 0.15], [0.2, 0.15], [0.25, 0.14], [0.345, 0.14], [0.39, 0],
    [0.43, -0.14], [0.54, -0.14], [0.575, 0.12], [0.685, 0.12], [0.72, -0.13], [0.83, -0.13],
    [0.855, 0.12], [0.92, 0.12], [0.95, 0], [1, 0],
  ]),
};

export function initShowroom({ onReady, scrollTo }) {
  const section = document.querySelector('.showroom');
  const canvas = document.getElementById('stage');
  const hero = document.getElementById('hero');
  const engineBtn = document.getElementById('engineBtn');

  // Hero copy
  hero.querySelectorAll('[data-hero]').forEach((el) => {
    el.textContent = HERO[el.dataset.hero];
  });

  // Chapters
  const chaptersEl = document.getElementById('chapters');
  const chapterEls = CHAPTERS.map((c) => {
    const el = document.createElement('article');
    el.className = `chapter chapter--${c.side}`;
    el.innerHTML = `
      <p class="chapter__num mono">${c.num}</p>
      <h2 class="chapter__title">${c.title}</h2>
      <p class="chapter__text">${c.text}</p>
      ${c.tags ? `<div class="chapter__tags">${c.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
      ${c.stats ? `<div class="chapter__stats">${c.stats.map((s) => `<div><b>${s.value}</b><span>${s.unit}</span></div>`).join('')}</div>` : ''}`;
    chaptersEl.appendChild(el);
    return el;
  });

  // Rail
  const rail = document.getElementById('rail');
  const railBtns = CHAPTERS.filter((c) => c.id !== 'outro').map((c) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.num;
    b.title = c.title;
    b.addEventListener('click', () => scrollTo(sectionTop() + (c.from + 0.025) * scrollable()));
    li.appendChild(b);
    rail.appendChild(li);
    return { b, c };
  });

  // Hotspots
  const hotspotsEl = document.getElementById('hotspots');
  const hotspots = HOTSPOTS.map((h) => {
    const el = document.createElement('div');
    el.className = 'hotspot';
    el.innerHTML = `<span class="hotspot__dot"></span><span class="hotspot__label">${h.label}</span>`;
    hotspotsEl.appendChild(el);
    const chapter = CHAPTERS.find((c) => c.id === h.chapter);
    return { el, chapter, pos: new THREE.Vector3(...h.at) };
  });

  const sectionTop = () => section.getBoundingClientRect().top + window.scrollY;
  const scrollable = () => section.offsetHeight - window.innerHeight;

  // 3D
  const stage = createStage(canvas);
  if (import.meta.env.DEV) window.__stage = stage;
  let car;
  let smoke;
  const build = () => {
    car = buildCar({ exhaust: CAR.exhaust });
    stage.scene.add(car.group);
    smoke = new Smoke(stage.scene, car.exhaustTips);
    stage.renderer.compile(stage.scene, stage.camera);
  };

  let target = 0;
  let progress = 0;
  let engine = 0; // 0 = off, 1 = running (eased)
  let engineOn = false;
  let wheelAngle = 0;
  let floorOffset = 0;
  let shake = 0;
  let visible = true;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();

  function startEngine(on = true) {
    engineOn = on;
    engineBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      shake = 1;
      smoke?.burst(5);
    }
  }
  engineBtn.addEventListener('click', () => startEngine(!engineOn));

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 }).observe(section);
  window.addEventListener('resize', () => stage.resize());

  function updateScroll() {
    const s = scrollable();
    target = s > 0 ? clamp((window.scrollY - sectionTop()) / s) : 0;
  }

  let pinned = null; // dev only: freeze the scene at a given progress
  function frame() {
    requestAnimationFrame(frame);
    step(clock.getDelta(), pinned ?? undefined);
  }

  function step(realDt, forced) {
    const dt = Math.min(0.05, realDt);
    const damp = (k) => 1 - Math.exp(-realDt * k);
    const t = clock.elapsedTime;
    if (forced === undefined) {
      updateScroll();
      progress += (target - progress) * damp(6);
    } else progress = target = forced;
    const p = progress;

    // DOM: hero, chapters, rail
    hero.classList.toggle('is-hidden', p > 0.035);
    engineBtn.classList.toggle('is-hidden', p > 0.035);
    if (p > 0.02 && !engineOn) startEngine(true);
    let activeId = null;
    let activeSide = '';
    CHAPTERS.forEach((c, i) => {
      const on = p >= c.from && p < c.to;
      chapterEls[i].classList.toggle('is-active', on);
      if (on) {
        activeId = c.id;
        activeSide = c.side;
      }
    });
    if (chaptersEl.dataset.side !== activeSide) chaptersEl.dataset.side = activeSide;
    railBtns.forEach(({ b, c }) => b.classList.toggle('is-active', p >= c.from && p < c.to));

    if (!visible || !car) return;

    // Engine/lights
    engine += ((engineOn ? 1 : 0) - engine) * damp(3);
    const drive = tracks.drive(p);
    wheelAngle += drive * dt * 9;
    floorOffset += drive * dt * 3.0;
    car.set({
      hood: tracks.hood(p),
      doorF: tracks.doorF(p),
      doorR: tracks.doorR(p),
      trunk: tracks.trunk(p),
      lights: engine,
      brake: tracks.brake(p) * engine,
      wheelAngle,
    });
    smoke.rate = engineOn ? Math.max(0.12, tracks.smoke(p)) : 0;
    smoke.update(dt);
    stage.floorUniforms.uOffset.value = floorOffset;
    stage.floorUniforms.uGrid.value = tracks.grid(p);
    stage.floorUniforms.uHead.value = engine;
    stage.floorUniforms.uTail.value = engine * (0.4 + tracks.brake(p));

    // Camera
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    pointer.sx += (pointer.x - pointer.sx) * damp(2.5);
    pointer.sy += (pointer.y - pointer.sy) * damp(2.5);
    shake = Math.max(0, shake - dt * 1.6);
    const [az, el, distRaw, tx, ty, tz] = camera(p);
    const aspect = stage.camera.aspect;
    const dist = distRaw * (aspect < 1.35 ? Math.min(2.1, Math.pow(1.35 / aspect, 0.8)) : 1);
    const azR = THREE.MathUtils.degToRad(az + pointer.sx * 4 + Math.sin(t * 0.25) * 1.2);
    const elR = THREE.MathUtils.degToRad(clamp(el - pointer.sy * 2.5 + Math.sin(t * 0.33) * 0.6, 1, 88));
    stage.camera.position.set(
      tx + dist * Math.cos(elR) * Math.cos(azR),
      ty + dist * Math.sin(elR),
      tz + dist * Math.cos(elR) * Math.sin(azR),
    );
    const narrow = aspect < 1;
    const sx = narrow ? 0 : tracks.shift(p);
    const sy = narrow ? 0.14 : 0;
    stage.camera.setViewOffset(w, h, -sx * w, sy * h, w, h);
    const sh = shake * shake * 0.012;
    stage.camera.lookAt(tx + (Math.random() - 0.5) * sh, ty + (Math.random() - 0.5) * sh, tz);
    car.group.position.y = Math.sin(t * 38) * 0.0012 * engine + shake * Math.sin(t * 60) * 0.004;

    // Hotspots
    stage.camera.updateMatrixWorld();
    for (const hs of hotspots) {
      const on = hs.chapter && activeId === hs.chapter.id;
      let show = false;
      if (on) {
        tmp.copy(hs.pos).project(stage.camera);
        show = tmp.z < 1 && Math.abs(tmp.x) < 0.95 && Math.abs(tmp.y) < 0.9;
        if (show) hs.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px)`;
      }
      hs.el.classList.toggle('is-visible', show);
    }

    stage.render();
  }

  // Build after first paint so the loader can show.
  setTimeout(() => {
    build();
    onReady?.();
    requestAnimationFrame(frame);
    setTimeout(() => startEngine(true), 900);
    if (import.meta.env.DEV) {
      // Dev hook: render the scene at scroll progress p (works even when rAF is throttled).
      window.__showroomAt = (p, settle = 40) => {
        pinned = p;
        engine = 1;
        engineOn = true;
        for (let i = 0; i < settle; i++) step(0.05, p);
      };
    }
  }, 60);

  return { get progress() { return progress; } };
}
