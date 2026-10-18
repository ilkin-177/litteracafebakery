// Ümumi UI köməkçiləri: escape, toast, overlay, şəkil ehtiyatı
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const money = (n) => `${Number(n).toFixed(2)} AZN`;

/* ---------- Toast ---------- */
export function toast(message, type = 'success', duration = 3200) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span></span>`;
  el.querySelector('span').textContent = message;
  root.appendChild(el);
  while (root.children.length > 4) root.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  }, duration);
}

/* ---------- Overlay (modal / drawer / lightbox) ---------- */
const lastFocus = new WeakMap();

export function openOverlay(el) {
  if (!el) return;
  lastFocus.set(el, document.activeElement);
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  const target = el.querySelector('[data-autofocus]');
  if (target) setTimeout(() => target.focus({ preventScroll: true }), 120);
}

export function closeOverlay(el) {
  if (!el || !el.classList.contains('open')) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.overlay.open')) document.body.classList.remove('no-scroll');
  const prev = lastFocus.get(el);
  if (prev && typeof prev.focus === 'function') prev.focus({ preventScroll: true });
}

export function initOverlays() {
  document.querySelectorAll('.overlay').forEach((el) => {
    el.addEventListener('mousedown', (e) => {
      if (e.target === el) closeOverlay(el);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.overlay.open')].pop();
    if (open) closeOverlay(open);
  });
}

/* ---------- Şəkil ehtiyatı + yüklənmə effekti ---------- */
const IMG_BASE = new URL('../images/', import.meta.url).href;
export const fallbackSrc = (kind) => `${IMG_BASE}placeholder-${kind}.svg`;
const KINDS = ['coffee', 'sweets', 'breakfast', 'snacks', 'book', 'gallery'];

export function initImageFallback() {
  // Xəta hadisəsi "bubble" etmir, ona görə capture = true
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.failed) return;
      const kind = img.dataset.fallback;
      if (!kind || !KINDS.includes(kind)) return;
      img.dataset.failed = '1';
      img.src = fallbackSrc(kind);
      img.classList.add('loaded');
    },
    true
  );
  document.addEventListener(
    'load',
    (e) => {
      if (e.target instanceof HTMLImageElement && e.target.classList.contains('img-fade')) {
        e.target.classList.add('loaded');
      }
    },
    true
  );
}

/** Keşdən dərhal yüklənmiş şəkillər üçün "loaded" sinfi */
export function markLoadedImages(root = document) {
  root.querySelectorAll('img.img-fade').forEach((img) => {
    if (img.complete && img.naturalWidth > 0) img.classList.add('loaded');
  });
}
