import { RESTORATION, CAR } from '../content.js';

const STATUS = {
  done: 'Готово',
  active: 'В роботі',
  planned: 'Далі',
};

const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

export function initRestoration() {
  const tabs = document.getElementById('restoTabs');
  const panel = document.getElementById('restoPanel');

  // Overall progress from the checklists (active stages count their ticked items).
  let doneItems = 0;
  let allItems = 0;
  for (const st of RESTORATION) {
    allItems += st.checklist.length;
    doneItems += st.status === 'done' ? st.checklist.length : st.checklist.filter(([, d]) => d).length;
  }
  const pct = Math.round((doneItems / allItems) * 100);
  const ring = document.getElementById('restoRing');
  const pctEl = document.getElementById('restoPct');
  const C = 2 * Math.PI * 52;

  document.getElementById('counters').innerHTML = [
    [daysSince(CAR.arrived), 'днів у відновленні'],
    [daysSince(CAR.purchased), 'днів з дня покупки'],
    [`${RESTORATION.filter((s) => s.status === 'done').length}/${RESTORATION.length}`, 'етапів завершено'],
  ].map(([v, l]) => `<div class="counter"><b data-count="${v}">${v}</b><span>${l}</span></div>`).join('');

  // Animate ring + numbers once in view
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      ring.style.strokeDashoffset = String(C * (1 - pct / 100));
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 1600);
        const ease = 1 - Math.pow(1 - k, 3);
        pctEl.textContent = String(Math.round(pct * ease));
        document.querySelectorAll('.counter b').forEach((b) => {
          const v = b.dataset.count;
          if (/^\d+$/.test(v)) b.textContent = String(Math.round(+v * ease));
        });
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { threshold: 0.4 },
  );
  io.observe(document.querySelector('.resto-top'));

  // Tabs
  const buttons = RESTORATION.map((st, i) => {
    const b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.id = `tab-${st.id}`;
    b.innerHTML = `<span class="tab__dot ${st.status}"></span><span class="tab__num">${String(i + 1).padStart(2, '0')}</span>${st.title}`;
    b.addEventListener('click', () => select(i));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') select((i + 1) % RESTORATION.length, true);
      if (e.key === 'ArrowLeft') select((i - 1 + RESTORATION.length) % RESTORATION.length, true);
    });
    tabs.appendChild(b);
    return b;
  });

  function render(st) {
    panel.innerHTML = `
      <div>
        <span class="panel__status ${st.status}">● ${STATUS[st.status]}</span>
        <h3 class="panel__title">${st.title}</h3>
        <p class="panel__text">${st.text}</p>
        ${st.date ? `<p class="panel__date mono">${st.date}</p>` : ''}
      </div>
      <ul class="checklist">
        ${st.checklist.map(([label, done]) => `<li class="${done || st.status === 'done' ? 'is-done' : ''}"><span class="check"></span><span>${label}</span></li>`).join('')}
      </ul>
      ${st.photos?.length ? `<div class="panel__photos">${st.photos.map((src) => `<img src="${src}" alt="${st.title}" loading="lazy" />`).join('')}</div>` : ''}`;
    panel.setAttribute('aria-labelledby', `tab-${st.id}`);
  }

  let current = -1;
  function select(i, focus = false) {
    if (i === current) return;
    current = i;
    buttons.forEach((b, k) => {
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    if (focus) buttons[i].focus();
    panel.classList.add('is-swapping');
    setTimeout(() => {
      render(RESTORATION[i]);
      requestAnimationFrame(() => panel.classList.remove('is-swapping'));
    }, panel.innerHTML ? 180 : 0);
  }

  const firstActive = RESTORATION.findIndex((s) => s.status === 'active');
  select(firstActive >= 0 ? firstActive : 0);
}
