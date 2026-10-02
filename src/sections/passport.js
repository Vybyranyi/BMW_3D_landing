import { SPECS, MODS } from '../content.js';

/* Approximate B48B20 (185 kW) curves: flat torque plateau, constant power up top. */
const RPM = [1000, 1450, 2000, 3000, 4000, 4800, 5200, 6000, 6500, 7000];
const TORQUE = [230, 350, 350, 350, 350, 350, 340, 294, 272, 240];
const POWER = RPM.map((r, i) => Math.round(((TORQUE[i] * r) / 9549) * 1.36));

/* Drawn at the rendered width so axis text keeps its real size on phones. */
function dyno(svg, W) {
  const H = Math.round(Math.min(360, Math.max(230, W * 0.56)));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pad = { l: 44, r: 44, t: 20, b: 34 };
  const x = (r) => pad.l + ((r - 1000) / 6000) * (W - pad.l - pad.r);
  const yT = (v) => H - pad.b - (v / 400) * (H - pad.t - pad.b);
  const yP = (v) => H - pad.b - (v / 300) * (H - pad.t - pad.b);
  const smooth = (pts) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const tPts = RPM.map((r, i) => [x(r), yT(TORQUE[i])]);
  const pPts = RPM.map((r, i) => [x(r), yP(POWER[i])]);
  const grid = [];
  for (let r = 1000; r <= 7000; r += 1000) {
    grid.push(`<line x1="${x(r)}" x2="${x(r)}" y1="${pad.t}" y2="${H - pad.b}" />`);
  }
  for (let v = 0; v <= 400; v += 100) grid.push(`<line x1="${pad.l}" x2="${W - pad.r}" y1="${yT(v)}" y2="${yT(v)}" />`);
  const axis = [];
  for (let r = 1000; r <= 7000; r += 1000) axis.push(`<text x="${x(r)}" y="${H - 12}" text-anchor="middle">${r / 1000}k</text>`);
  for (let v = 0; v <= 400; v += 100) axis.push(`<text x="${pad.l - 8}" y="${yT(v) + 3}" text-anchor="end">${v}</text>`);
  for (let v = 0; v <= 300; v += 75) axis.push(`<text x="${W - pad.r + 8}" y="${yP(v) + 3}">${v}</text>`);
  axis.push(`<text x="${W / 2}" y="${H}" text-anchor="middle" opacity=".6">об/хв</text>`);

  svg.innerHTML = `
    <defs>
      <linearGradient id="gT" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#81c4ff" stop-opacity=".25"/><stop offset="1" stop-color="#81c4ff" stop-opacity="0"/></linearGradient>
      <linearGradient id="gP" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e7222e" stop-opacity=".22"/><stop offset="1" stop-color="#e7222e" stop-opacity="0"/></linearGradient>
    </defs>
    <g class="grid">${grid.join('')}</g>
    <g class="axis">${axis.join('')}</g>
    <path class="area" d="${smooth(tPts)} L${x(7000)},${H - pad.b} L${x(1000)},${H - pad.b} Z" fill="url(#gT)" />
    <path class="area" d="${smooth(pPts)} L${x(7000)},${H - pad.b} L${x(1000)},${H - pad.b} Z" fill="url(#gP)" />
    <path class="curve" d="${smooth(tPts)}" stroke="#81c4ff" />
    <path class="curve" d="${smooth(pPts)}" stroke="#e7222e" />
    <g class="peak">
      <circle cx="${x(3000)}" cy="${yT(350)}" r="4" fill="#81c4ff" />
      <text x="${x(3000)}" y="${yT(350) - 12}" text-anchor="middle">350 Нм · 1450–4800</text>
      <circle cx="${x(6000)}" cy="${yP(252)}" r="4" fill="#e7222e" />
      <text x="${x(6000)}" y="${yP(252) - 12}" text-anchor="middle">252 к.с.</text>
    </g>`;
  svg.querySelectorAll('.curve').forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
  });
}

function countUp(el, value, decimals = 0) {
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / 1400);
    const e = 1 - Math.pow(1 - k, 4);
    el.textContent = (value * e).toFixed(decimals).replace('.', ',');
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initPassport() {
  const big = document.getElementById('bignums');
  big.innerHTML = SPECS.big
    .map((s, i) => `
      <div class="bignum reveal" style="transition-delay:${i * 0.08}s">
        <div class="bignum__value"><span data-v="${s.value}" data-d="${s.decimals || 0}">0</span><small>${s.unit}</small></div>
        <div class="bignum__label">${s.label}</div>
        <div class="bignum__note">${s.note}</div>
      </div>`)
    .join('');

  document.getElementById('specTable').innerHTML = SPECS.table
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');

  const svg = document.getElementById('dyno');
  let dynoW = 0;
  const drawDyno = () => {
    const w = Math.round(svg.getBoundingClientRect().width);
    if (!w || Math.abs(w - dynoW) < 24) return;
    dynoW = w;
    dyno(svg, Math.max(300, w));
    if (svg.closest('.dyno').classList.contains('is-in')) svg.querySelectorAll('.curve').forEach((p) => (p.style.strokeDashoffset = '0'));
  };
  drawDyno();
  new ResizeObserver(drawDyno).observe(svg);

  document.getElementById('mods').innerHTML = MODS.map((m, i) => `
    <li class="mod reveal">
      <span class="mod__num mono">${String(i + 1).padStart(2, '0')}</span>
      <div><div class="mod__name">${m.name}</div><div class="mod__detail">${m.detail}</div></div>
      <span class="mod__badge ${m.status}">${m.status === 'stock' ? 'з заводу' : 'встановлено'}</span>
    </li>`).join('');

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
        e.target.querySelectorAll('[data-v]').forEach((n) => countUp(n, +n.dataset.v, +n.dataset.d));
        if (e.target.classList.contains('dyno')) {
          e.target.querySelectorAll('.curve').forEach((p) => (p.style.strokeDashoffset = '0'));
        }
      }
    },
    { threshold: 0.25 },
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
