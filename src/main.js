import './styles.css';
import Lenis from 'lenis';
import { initShowroom } from './sections/showroom.js';
import { initJourney } from './sections/journey.js';
import { initRestoration } from './sections/restoration.js';
import { initPassport } from './sections/passport.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
document.body.classList.add('is-loading');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lenis = new Lenis({ lerp: reducedMotion ? 1 : 0.085, wheelMultiplier: 0.9, smoothWheel: !reducedMotion });
function raf(t) {
  lenis.raf(t);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
lenis.stop();
if (import.meta.env.DEV) window.__lenis = lenis;

// Anchor links go through Lenis for smooth travel.
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? 0 : document.querySelector(id);
    if (el === null) return;
    e.preventDefault();
    lenis.scrollTo(el, { duration: 1.6 });
  });
});

// Thin M-striped page progress bar.
const bar = document.querySelector('.page-progress span');
lenis.on('scroll', ({ progress }) => {
  bar.style.transform = `scaleX(${progress})`;
});

initPassport();
initRestoration();
initJourney();
function ready() {
  document.getElementById('loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  lenis.start();
}

try {
  initShowroom({ scrollTo: (y) => lenis.scrollTo(y, { duration: 1.4 }), onReady: ready });
} catch (err) {
  // No WebGL: keep the page, drop the 3D stage.
  console.error(err);
  document.documentElement.classList.add('no-webgl');
  ready();
}
