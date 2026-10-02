import { geoOrthographic, geoEquirectangular, geoPath, geoInterpolate, geoDistance, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import { ROUTE, JOURNEY_STOPS, CAR } from '../content.js';

const R_EARTH = 6371;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Polyline with cumulative great-circle distances, so we can walk it by fraction. */
function walker(coords) {
  const seg = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = geoDistance(coords[i], coords[i + 1]);
    seg.push({ a: coords[i], b: coords[i + 1], d, start: total, interp: geoInterpolate(coords[i], coords[i + 1]) });
    total += d;
  }
  return {
    total,
    at(f) {
      const target = clamp(f) * total;
      for (const s of seg) {
        if (target <= s.start + s.d || s === seg[seg.length - 1]) return s.interp(s.d ? (target - s.start) / s.d : 0);
      }
      return coords[coords.length - 1];
    },
    upTo(f) {
      const target = clamp(f) * total;
      const out = [coords[0]];
      for (const s of seg) {
        if (target >= s.start + s.d) out.push(s.b);
        else {
          out.push(s.interp((target - s.start) / s.d));
          break;
        }
      }
      return out;
    },
  };
}

/** Land dots: rasterise land once into an equirectangular mask, then sample a lat/lon grid. */
function landDots() {
  const W = 1440;
  const H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const proj = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
  g.fillStyle = '#fff';
  g.beginPath();
  geoPath(proj, g)(feature(land110, land110.objects.land));
  g.fill();
  const data = g.getImageData(0, 0, W, H).data;
  const dots = [];
  const step = 1.25;
  for (let lat = -58; lat <= 78; lat += step) {
    const lonStep = step / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
    for (let lon = -180; lon < 180; lon += lonStep) {
      const [x, y] = proj([lon, lat]);
      const i = (Math.floor(y) * W + Math.floor(x)) * 4;
      if (data[i] > 128) dots.push([lon, lat]);
    }
  }
  return dots;
}

export function initJourney() {
  const section = document.getElementById('journey');
  const canvas = document.getElementById('globe');
  const ctx = canvas.getContext('2d');
  const stopsEl = document.getElementById('journeyStops');
  const odo = document.getElementById('odoKm');

  const sea = walker(ROUTE.sea);
  const road = walker(ROUTE.road);
  const seaKm = sea.total * R_EARTH;
  const roadKm = road.total * R_EARTH;
  const totalKm = seaKm + roadKm;
  const seaShare = seaKm / totalKm;
  const days = Math.round((new Date(CAR.arrived) - new Date(CAR.purchased)) / 864e5);

  // Stats
  const fmt = (n) => Math.round(n).toLocaleString('uk-UA');
  document.getElementById('journeyStats').innerHTML = [
    [days, 'днів у дорозі'],
    [`≈${fmt(Math.round(seaKm / 100) * 100)}`, 'км морем'],
    [`≈${fmt(Math.round(roadKm / 50) * 50)}`, 'км дорогою'],
    ['4', 'країни'],
  ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');

  // Place every stop at its real distance along the route (nearest route vertex).
  const vertices = [];
  let acc = 0;
  ROUTE.sea.forEach((c, i) => {
    if (i) acc += geoDistance(ROUTE.sea[i - 1], c);
    vertices.push([c, acc / (sea.total + road.total)]);
  });
  acc = sea.total;
  ROUTE.road.forEach((c, i) => {
    if (i) acc += geoDistance(ROUTE.road[i - 1], c);
    vertices.push([c, acc / (sea.total + road.total)]);
  });
  for (const s of JOURNEY_STOPS) {
    let best = Infinity;
    for (const [c, f] of vertices) {
      const d = geoDistance(c, s.coord);
      if (d < best) {
        best = d;
        s.at = f;
      }
    }
  }
  JOURNEY_STOPS[0].at = 0;
  JOURNEY_STOPS[JOURNEY_STOPS.length - 1].at = 1;
  for (let i = 1; i < JOURNEY_STOPS.length - 1; i++) {
    JOURNEY_STOPS[i].at = Math.max(JOURNEY_STOPS[i].at, JOURNEY_STOPS[i - 1].at + 0.012);
  }

  // Stops list
  const stopEls = JOURNEY_STOPS.map((s) => {
    const li = document.createElement('li');
    li.className = 'stop';
    li.innerHTML = `
      <div class="stop__meta mono">${s.date ? `<b>${s.date}</b>` : ''}<span>${s.place}</span></div>
      <div class="stop__title">${s.title}</div>
      <div class="stop__text">${s.text}</div>`;
    stopsEl.appendChild(li);
    return li;
  });

  const dots = landDots();
  const graticule = geoGraticule10();
  const proj = geoOrthographic().clipAngle(90).precision(0.3);
  const path = geoPath(proj, ctx);
  let W = 0;
  let H = 0;
  let dpr = 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  // The globe row changes height with the stop text (and the phone toolbar), not only on window resize.
  new ResizeObserver(resize).observe(canvas);

  /* Overall fraction f ∈ [0,1] along the whole trip (sea then road), by distance. */
  const pointAt = (f) => (f <= seaShare ? sea.at(f / seaShare) : road.at((f - seaShare) / (1 - seaShare)));

  let rot = [118, -25];
  let shown = 0;
  let target = 0;
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '200px' }).observe(section);

  function draw(f, k = 0.12) {
    const cur = pointAt(f);
    // Globe faces the current position, a little tilted towards the north.
    const want = [-cur[0], -clamp(cur[1] * 0.75, -30, 50)];
    rot[0] += (want[0] - rot[0]) * k;
    rot[1] += (want[1] - rot[1]) * k;
    const size = Math.min(W, H);
    const zoom = 1 + 0.55 * Math.max(0, (f - 0.86) / 0.14) ** 1.5;
    proj.scale((size / 2.15) * zoom).translate([W / 2, H / 2]).rotate(rot);

    ctx.clearRect(0, 0, W, H);
    const r = proj.scale();
    // Sphere
    const grad = ctx.createRadialGradient(W / 2 - r * 0.3, H / 2 - r * 0.35, r * 0.1, W / 2, H / 2, r);
    grad.addColorStop(0, '#141922');
    grad.addColorStop(1, '#07090c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fill();
    ctx.strokeStyle = 'rgba(129,196,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.stroke();

    // Land dots (front hemisphere only)
    const center = [-rot[0], -rot[1]];
    const dotR = Math.max(0.7, r / 420) * zoom ** 0.3;
    ctx.fillStyle = 'rgba(205,214,226,0.55)';
    for (const d of dots) {
      if (geoDistance(d, center) > 1.53) continue;
      const p = proj(d);
      ctx.fillRect(p[0] - dotR, p[1] - dotR, dotR * 2, dotR * 2);
    }

    // Full route (faint)
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    path({ type: 'MultiLineString', coordinates: [ROUTE.sea, ROUTE.road] });
    ctx.stroke();
    ctx.setLineDash([]);

    // Travelled route
    const seaPart = sea.upTo(Math.min(1, f / seaShare));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#81c4ff';
    ctx.shadowColor = 'rgba(129,196,255,0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    path({ type: 'LineString', coordinates: seaPart });
    ctx.stroke();
    if (f > seaShare) {
      ctx.strokeStyle = '#e7222e';
      ctx.shadowColor = 'rgba(231,34,46,0.8)';
      ctx.beginPath();
      path({ type: 'LineString', coordinates: road.upTo((f - seaShare) / (1 - seaShare)) });
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Stops
    ctx.font = '500 11px "JetBrains Mono", monospace';
    JOURNEY_STOPS.forEach((s) => {
      if (geoDistance(s.coord, center) > 1.45) return;
      const p = proj(s.coord);
      const reached = f >= s.at - 0.001;
      ctx.beginPath();
      ctx.arc(p[0], p[1], reached ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = reached ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.fill();
    });
    const endLabels = [
      [ROUTE.start, 'LOS ANGELES'],
      [[21.12, 55.71], 'KLAIPĖDA'],
      [[25.94, 48.29], 'ЧЕРНІВЦІ'],
      [[-79.7, 9.1], 'PANAMA'],
    ];
    for (const [c, label] of endLabels) {
      if (geoDistance(c, center) > 1.35) continue;
      const p = proj(c);
      ctx.fillStyle = 'rgba(236,238,241,0.85)';
      ctx.fillText(label, p[0] + 9, p[1] - 8);
    }

    // Vehicle marker
    const vp = proj(cur);
    if (vp) {
      const onRoad = f > seaShare;
      ctx.beginPath();
      ctx.arc(vp[0], vp[1], 10 + Math.sin(performance.now() / 260) * 2, 0, Math.PI * 2);
      ctx.fillStyle = onRoad ? 'rgba(231,34,46,0.22)' : 'rgba(129,196,255,0.22)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(vp[0], vp[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(onRoad ? '🚚' : '🚢', vp[0] - 26, vp[1] + 24);
    }
  }

  function updateStops(f) {
    let current = 0;
    JOURNEY_STOPS.forEach((s, i) => {
      if (f >= s.at - 0.002) current = i;
    });
    stopEls.forEach((el, i) => {
      el.classList.toggle('is-current', i === current);
      el.classList.toggle('is-past', i < current);
    });
  }

  let last = performance.now();
  let pinned = null; // dev only
  function loop(now) {
    requestAnimationFrame(loop);
    const realDt = (now - last) / 1000;
    last = now;
    if (!visible || pinned !== null) return;
    const rect = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    target = clamp((-rect.top - window.innerHeight * 0.1) / (scrollable * 0.85));
    shown += (target - shown) * (1 - Math.exp(-realDt * 5));
    draw(shown, 1 - Math.exp(-realDt * 7));
    updateStops(shown);
    odo.textContent = fmt(shown * totalKm);
  }
  requestAnimationFrame(loop);
  if (import.meta.env.DEV) {
    window.__journeyAt = (f) => {
      pinned = f;
      for (let i = 0; i < 60; i++) draw(f, 0.2);
      updateStops(f);
      odo.textContent = fmt(f * totalKm);
    };
  }
}
