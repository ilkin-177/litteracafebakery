// Bütün animasiyalar (scroll, hero, tilt, sayğac, lightbox, səbətə uçuş)
import { openOverlay, closeOverlay, fallbackSrc } from './ui.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Preloader ---------- */
export function initPreloader() {
  const el = document.getElementById('preloader');
  if (!el) return;
  let closed = false;
  const hide = () => {
    if (closed) return;
    closed = true;
    el.classList.add('done');
    setTimeout(() => el.remove(), 800);
  };
  setTimeout(hide, 1800); // maksimum gözləmə
  if (document.readyState === 'complete') setTimeout(hide, 700);
  else window.addEventListener('load', () => setTimeout(hide, 700), { once: true });
}

/* ---------- Scroll reveal ---------- */
let revealObserver = null;
export function observeReveal(root = document) {
  const targets = root.querySelectorAll('.reveal:not(.visible)');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    targets.forEach((t) => t.classList.add('visible'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
  }
  targets.forEach((t) => revealObserver.observe(t));
}

/* ---------- Hero slayder (Ken Burns) ---------- */
export function initHeroSlider() {
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dots = [...document.querySelectorAll('.hero-dot')];
  if (slides.length < 2) return;
  let index = 0;
  let timer;

  const show = (i) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      s.classList.remove('active');
      if (n === index) {
        void s.offsetWidth; // animasiyanı yenidən başlat
        s.classList.add('active');
      }
    });
    dots.forEach((d, n) => {
      d.classList.remove('active');
      if (n === index) {
        void d.offsetWidth;
        d.classList.add('active');
      }
    });
  };
  const start = () => {
    clearInterval(timer);
    timer = setInterval(() => show(index + 1), 6000);
  };
  dots.forEach((d, n) =>
    d.addEventListener('click', () => {
      show(n);
      start();
    })
  );
  show(0);
  start();
  document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : start()));
}

/* ---------- Dəyişən söz ---------- */
export function initRotatingWord() {
  const el = document.getElementById('rotating-word');
  if (!el || reduceMotion) return;
  const words = (el.dataset.words || '').split('|').filter(Boolean);
  if (words.length < 2) return;
  let i = 0;
  setInterval(() => {
    el.classList.add('out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i];
      el.classList.remove('out');
    }, 380);
  }, 3200);
}

/* ---------- Qəhvə dənələri (hissəciklər) ---------- */
export function initParticles() {
  const box = document.getElementById('hero-particles');
  if (!box || reduceMotion) return;
  const count = window.innerWidth < 640 ? 8 : 16;
  const frag = document.createDocumentFragment();
  for (let n = 0; n < count; n++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.style.setProperty('--x', `${Math.random() * 100}%`);
    p.style.setProperty('--s', `${7 + Math.random() * 10}px`);
    p.style.setProperty('--d', `${12 + Math.random() * 12}s`);
    p.style.setProperty('--delay', `${-Math.random() * 20}s`);
    p.style.setProperty('--dx', `${-60 + Math.random() * 120}px`);
    p.style.setProperty('--rot', `${120 + Math.random() * 400}deg`);
    p.style.setProperty('--o', `${0.25 + Math.random() * 0.4}`);
    frag.appendChild(p);
  }
  box.appendChild(frag);
}

/* ---------- Sayğaclar ---------- */
export function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;
  const run = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const duration = 1800;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
}

/* ---------- 3D tilt (siçan ilə) ---------- */
export function initTilt() {
  if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
  let active = null;
  const reset = () => {
    if (!active) return;
    active.classList.remove('tilting');
    active.style.setProperty('--rx', '0deg');
    active.style.setProperty('--ry', '0deg');
    active = null;
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest('.tilt');
    if (active && active !== el) reset();
    if (!el) return;
    active = el;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const max = Number(el.dataset.tilt) || 8;
    el.classList.add('tilting');
    el.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`);
  });
  document.documentElement.addEventListener('mouseleave', reset);
  window.addEventListener('blur', reset);
}

/* ---------- Scroll effektləri: progress, header, nav, parallax, to-top ---------- */
export function initScrollEffects() {
  const bar = document.getElementById('scroll-progress');
  const header = document.getElementById('site-header');
  const toTop = document.getElementById('to-top');
  const slides = document.querySelector('.hero-slides');
  const hero = document.getElementById('home');
  const links = [...document.querySelectorAll('.nav-link[data-nav]')];
  const sections = links
    .map((l) => document.getElementById(l.dataset.nav))
    .filter(Boolean);
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    if (header) header.classList.toggle('is-scrolled', y > 40);
    if (toTop) toTop.classList.toggle('show', y > 600);
    if (slides && hero && !reduceMotion && y < hero.offsetHeight + 200) {
      slides.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
    }
    let current = null;
    sections.forEach((s) => {
      if (s.getBoundingClientRect().top <= 140) current = s.id;
    });
    links.forEach((l) => l.classList.toggle('active', l.dataset.nav === current));
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();

  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
}

/* ---------- Səbətə uçan şəkil ---------- */
export function flyToCart(sourceImg, cartButton) {
  if (reduceMotion || !sourceImg || !cartButton) return;
  const from = sourceImg.getBoundingClientRect();
  const to = cartButton.getBoundingClientRect();
  if (!from.width) return;
  const clone = document.createElement('img');
  clone.src = sourceImg.currentSrc || sourceImg.src;
  clone.className = 'fly-img';
  clone.alt = '';
  const size = Math.min(from.width, 140);
  Object.assign(clone.style, {
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  });
  document.body.appendChild(clone);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 70}px) scale(.6) rotate(140deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(300deg)`, opacity: 0.2 },
    ],
    { duration: 800, easing: 'cubic-bezier(.5,0,.75,.4)' }
  );
  const done = () => {
    clone.remove();
    const badge = document.getElementById('cart-count');
    if (badge) {
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
    }
  };
  anim.onfinish = done;
  anim.oncancel = done;
}

/* ---------- Lightbox ---------- */
export function initLightbox() {
  const box = document.getElementById('lightbox');
  if (!box) return;
  const img = box.querySelector('img');
  const caption = box.querySelector('[data-lb-caption]');
  const items = [...document.querySelectorAll('[data-lightbox]')];
  let index = 0;

  const render = (i, animate = true) => {
    index = (i + items.length) % items.length;
    const item = items[index];
    const apply = () => {
      img.src = item.dataset.full || item.querySelector('img').src;
      img.alt = item.dataset.caption || '';
      if (caption) caption.textContent = `${item.dataset.caption || ''}  (${index + 1}/${items.length})`;
      img.classList.remove('swap');
    };
    if (animate && !reduceMotion) {
      img.classList.add('swap');
      setTimeout(apply, 220);
    } else apply();
  };

  items.forEach((item, n) => {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    const open = () => { render(n, false); openOverlay(box); };
    item.addEventListener('click', open);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  // Lightbox-un şəkli yüklənməzsə ehtiyat şəkil
  img.addEventListener('error', () => {
    if (!img.dataset.failed) { img.dataset.failed = '1'; img.src = fallbackSrc('gallery'); }
  });
  img.addEventListener('load', () => { img.dataset.failed = ''; });

  box.querySelector('[data-lb-prev]').addEventListener('click', () => render(index - 1));
  box.querySelector('[data-lb-next]').addEventListener('click', () => render(index + 1));
  box.querySelector('[data-lb-close]').addEventListener('click', () => closeOverlay(box));
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') render(index - 1);
    if (e.key === 'ArrowRight') render(index + 1);
  });

  // Mobil üçün sürüşdürmə
  let startX = null;
  box.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) render(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
}
