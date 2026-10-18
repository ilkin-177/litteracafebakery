import { api, ApiError } from './api.js';
import { cart } from './cart.js';
import {
  esc, money, toast, openOverlay, closeOverlay, initOverlays, initImageFallback, markLoadedImages,
} from './ui.js';
import {
  initPreloader, observeReveal, initHeroSlider, initRotatingWord, initParticles, initCounters,
  initTilt, initScrollEffects, initLightbox, flyToCart,
} from './animations.js';

/* ---------- Vəziyyət ---------- */
const state = { menu: [], books: [], category: 'all', query: '', menuLoaded: false };

const $ = (sel, root = document) => root.querySelector(sel);
const menuGrid = $('#menu-grid');
const booksBox = $('#books-container');
const reservationModal = $('#reservation-modal');
const cartModal = $('#cart-modal');

/* ---------- Skeleton / xəta ---------- */
function skeletonCards(n, dark = false) {
  return Array.from({ length: n }, () => `<div class="${dark ? 'skeleton-dark' : 'skeleton'} h-80"></div>`).join('');
}

function errorBlock(message, dark = false) {
  return `
    <div class="col-span-full text-center py-10 ${dark ? 'text-brand-cream' : 'text-gray-600'} space-y-3">
      <i class="fa-solid fa-plug-circle-exclamation text-4xl ${dark ? 'text-brand-accent' : 'text-brand-gold'}"></i>
      <p class="text-sm max-w-md mx-auto">${esc(message)}</p>
      <button type="button" data-action="retry-load" class="bg-brand-accent hover:bg-brand-gold text-brand-dark font-semibold text-sm px-5 py-2 rounded-full transition">Yenidən yoxla</button>
    </div>`;
}

/* ---------- Menyu ---------- */
function renderMenu() {
  const q = state.query.trim().toLowerCase();
  const list = state.menu.filter((item) => {
    const okCat = state.category === 'all' || item.category === state.category;
    const okQuery = !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    return okCat && okQuery;
  });

  if (!list.length) {
    menuGrid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500"><i class="fa-regular fa-face-frown text-3xl mb-2 block"></i>Heç bir təam tapılmadı.</div>`;
    return;
  }

  menuGrid.innerHTML = list
    .map(
      (item, i) => `
    <div class="reveal" style="--i:${i % 4}">
      <article class="menu-card tilt group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex flex-col justify-between h-full" data-tilt="5">
        <div>
          <div class="img-zoom shine h-48">
            ${item.badge ? `<span class="badge-ribbon">${esc(item.badge)}</span>` : ''}
            <img class="img-fade w-full h-full object-cover" src="${esc(item.img)}" alt="${esc(item.title)}" data-fallback="${esc(item.category)}" loading="lazy" data-product-img="${item.id}">
            <span class="absolute top-3 right-3 z-[2] bg-brand-dark/80 backdrop-blur-md text-brand-gold text-xs font-bold px-3 py-1 rounded-full border border-brand-gold/30">${money(item.price)}</span>
          </div>
          <div class="p-5">
            <h4 class="font-serif-custom text-lg font-bold text-brand-dark mb-1">${esc(item.title)}</h4>
            <p class="text-gray-500 text-xs leading-relaxed line-clamp-2">${esc(item.desc)}</p>
          </div>
        </div>
        <div class="px-5 pb-5">
          <button type="button" data-action="add-to-cart" data-id="${item.id}" class="btn-add w-full bg-brand-cream/60 hover:bg-brand-accent text-brand-dark font-semibold text-xs py-2.5 rounded-xl border border-brand-accent/30 transition duration-200 flex items-center justify-center space-x-2">
            <i class="fa-solid fa-plus text-xs"></i>
            <span>Səbətə Əlavə Et</span>
          </button>
        </div>
      </article>
    </div>`
    )
    .join('');

  markLoadedImages(menuGrid);
  observeReveal(menuGrid);
}

/* ---------- Kitablar ---------- */
function renderBooks() {
  booksBox.innerHTML = state.books
    .map(
      (book, i) => `
    <div class="reveal" style="--i:${i}">
      <article class="tilt group bg-brand-softDark/80 border border-brand-accent/20 rounded-2xl p-4 flex flex-col justify-between hover:border-brand-accent/60 transition h-full" data-tilt="8">
        <div>
          <div class="img-zoom shine rounded-xl mb-4 shadow-md">
            <img class="img-fade w-full h-48 object-cover" src="${esc(book.img)}" alt="${esc(book.title)}" data-fallback="book" loading="lazy">
          </div>
          <span class="text-[10px] text-brand-gold font-bold uppercase tracking-widest">${esc(book.author)}</span>
          <h4 class="font-serif-custom text-base font-bold text-brand-cream mt-1">${esc(book.title)}</h4>
          <p class="text-brand-cream/60 text-xs mt-2 leading-relaxed">${esc(book.desc)}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-brand-cream/10 flex justify-between items-center text-xs">
          <span class="text-brand-accent"><i class="fa-solid fa-check-circle mr-1"></i>Mövcuddur</span>
          <button type="button" data-action="read-book" data-title="${esc(book.title)}" class="text-brand-cream hover:text-brand-gold font-medium transition">Mütaliə Et</button>
        </div>
      </article>
    </div>`
    )
    .join('');
  markLoadedImages(booksBox);
  observeReveal(booksBox);
}

/* ---------- Məlumatların yüklənməsi ---------- */
async function loadData() {
  menuGrid.innerHTML = skeletonCards(4);
  booksBox.innerHTML = skeletonCards(4, true);

  const [menuRes, booksRes] = await Promise.allSettled([api.menu(), api.books()]);

  if (menuRes.status === 'fulfilled' && Array.isArray(menuRes.value)) {
    state.menu = menuRes.value;
    state.menuLoaded = true;
    cart.keepOnly(state.menu.map((m) => m.id));
    renderMenu();
  } else {
    const msg = menuRes.reason instanceof ApiError ? menuRes.reason.message : 'Menyu yüklənmədi.';
    menuGrid.innerHTML = errorBlock(msg);
  }

  if (booksRes.status === 'fulfilled' && Array.isArray(booksRes.value)) {
    state.books = booksRes.value;
    renderBooks();
  } else {
    const msg = booksRes.reason instanceof ApiError ? booksRes.reason.message : 'Kitablar yüklənmədi.';
    booksBox.innerHTML = errorBlock(msg, true);
  }
  renderCart();
}

/* ---------- Səbət ---------- */
function renderCart() {
  const countEl = $('#cart-count');
  const itemsBox = $('#cart-items');
  const totalEl = $('#cart-total');
  const checkoutBtn = $('#checkout-btn');

  const lines = cart.items
    .map((ci) => ({ ...state.menu.find((m) => m.id === ci.id), qty: ci.qty }))
    .filter((l) => l.id !== undefined && l.title);

  const totalQty = state.menuLoaded ? lines.reduce((a, l) => a + l.qty, 0) : cart.count();
  const totalPrice = lines.reduce((a, l) => a + l.price * l.qty, 0);

  countEl.textContent = totalQty;
  totalEl.textContent = money(totalPrice);
  checkoutBtn.disabled = lines.length === 0;
  checkoutBtn.classList.toggle('opacity-50', lines.length === 0);
  checkoutBtn.classList.toggle('cursor-not-allowed', lines.length === 0);

  if (!lines.length) {
    itemsBox.innerHTML = `
      <div class="text-center py-12 text-gray-400 space-y-3">
        <i class="fa-solid fa-basket-shopping text-4xl text-gray-300"></i>
        <p class="text-sm">Səbətiniz hazırda boşdur.</p>
        <a href="#menu" data-action="close-cart" class="inline-block text-brand-gold font-semibold text-sm hover:underline">Menyuya bax</a>
      </div>`;
    return;
  }

  itemsBox.innerHTML = lines
    .map(
      (l) => `
    <div class="cart-item flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div class="flex items-center gap-3 min-w-0">
        <img src="${esc(l.img)}" alt="" data-fallback="${esc(l.category)}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0">
        <div class="min-w-0">
          <h5 class="text-sm font-bold text-brand-dark truncate">${esc(l.title)}</h5>
          <span class="text-xs text-brand-gold font-semibold">${money(l.price)}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button type="button" data-action="qty" data-id="${l.id}" data-delta="-1" aria-label="Azalt" class="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs font-bold transition">-</button>
        <span class="text-xs font-bold w-5 text-center">${l.qty}</span>
        <button type="button" data-action="qty" data-id="${l.id}" data-delta="1" aria-label="Artır" class="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-xs font-bold transition">+</button>
        <button type="button" data-action="remove-item" data-id="${l.id}" aria-label="Sil" class="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center text-xs transition"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    </div>`
    )
    .join('');
}

/* ---------- Form köməkçiləri ---------- */
function clearErrors(form) {
  form.querySelectorAll('.field').forEach((f) => f.classList.remove('invalid'));
  form.querySelectorAll('[data-error-for]').forEach((p) => (p.textContent = ''));
}

function showErrors(form, errors) {
  let first = true;
  Object.entries(errors).forEach(([name, msg]) => {
    const input = form.elements[name];
    const out = form.querySelector(`[data-error-for="${name}"]`);
    if (input && input.classList) input.classList.add('invalid');
    if (out) out.textContent = msg;
    if (first && input && input.focus) { input.focus(); first = false; }
  });
}

function setLoading(btn, loading, label) {
  const span = btn.querySelector('.btn-label');
  btn.disabled = loading;
  if (loading) {
    btn.dataset.label = span.textContent;
    span.textContent = 'Göndərilir...';
    btn.insertAdjacentHTML('afterbegin', '<span class="spinner" data-spin></span>');
  } else {
    btn.querySelector('[data-spin]')?.remove();
    span.textContent = label || btn.dataset.label || span.textContent;
  }
}

const PHONE_RE = /^\+?[\d\s()\-]{7,25}$/;
const validPhone = (v) => PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15;

/* ---------- Rezervasiya ---------- */
function openReservation() {
  const form = $('#reservation-form');
  $('#reservation-success').classList.add('hidden');
  form.classList.remove('hidden');
  clearErrors(form);
  const dateInput = form.elements.date;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  dateInput.min = today;
  if (!dateInput.value) dateInput.value = today;
  openOverlay(reservationModal);
}

async function submitReservation(e) {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  const data = Object.fromEntries(new FormData(form).entries());
  data.name = (data.name || '').trim();
  data.phone = (data.phone || '').trim();

  const errors = {};
  if (data.name.length < 2) errors.name = 'Ad və soyadı daxil edin';
  if (!validPhone(data.phone)) errors.phone = 'Telefon nömrəsi düzgün deyil';
  if (!data.date) errors.date = 'Tarixi seçin';
  if (!data.time) errors.time = 'Saatı seçin';
  else if (data.time < '08:00' || data.time > '23:00') errors.time = 'Saat 08:00 - 23:00 arasında olmalıdır';
  if (Object.keys(errors).length) return showErrors(form, errors);

  const btn = form.querySelector('button[type="submit"]');
  setLoading(btn, true);
  try {
    const res = await api.createReservation(data);
    $('#reservation-code').textContent = res.id;
    form.classList.add('hidden');
    $('#reservation-success').classList.remove('hidden');
    form.reset();
    toast('Masa sifarişiniz uğurla qeydə alındı!');
  } catch (err) {
    if (err.details) showErrors(form, err.details);
    toast(err.message, 'error', 5000);
  } finally {
    setLoading(btn, false, 'Sifarişi Təsdiqlə');
  }
}

/* ---------- Sifariş (səbət) ---------- */
async function submitOrder(e) {
  e.preventDefault();
  const form = e.currentTarget;
  clearErrors(form);
  if (!cart.items.length) return toast('Səbətiniz boşdur!', 'error');

  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.trim();
  const errors = {};
  if (name.length < 2) errors.name = 'Adınızı yazın';
  if (!validPhone(phone)) errors.phone = 'Nömrə düzgün deyil';
  if (Object.keys(errors).length) return showErrors(form, errors);

  const btn = $('#checkout-btn');
  setLoading(btn, true);
  try {
    const res = await api.createOrder({
      customer: { name, phone },
      type: form.elements.type.value,
      note: form.elements.note.value.trim(),
      items: cart.items.map((i) => ({ id: i.id, qty: i.qty })),
    });
    cart.clear();
    form.elements.note.value = '';
    closeOverlay(cartModal);
    toast(`Sifarişiniz qəbul olundu! Kod: ${res.id} (${money(res.total)})`, 'success', 6000);
  } catch (err) {
    if (err.details && !err.details.items) showErrors(form, err.details);
    toast(err.message, 'error', 5000);
  } finally {
    setLoading(btn, false, 'Sifarişi Tamamla');
    renderCart();
  }
}

/* ---------- Klik hadisələri (event delegation) ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'open-reservation': {
      const mobile = $('#mobile-menu');
      if (!mobile.classList.contains('hidden')) toggleMobileMenu();
      openReservation();
      break;
    }
    case 'close-reservation':
      closeOverlay(reservationModal);
      break;
    case 'toggle-cart':
      cartModal.classList.contains('open') ? closeOverlay(cartModal) : openOverlay(cartModal);
      break;
    case 'close-cart':
      closeOverlay(cartModal);
      break;
    case 'toggle-mobile-menu':
      toggleMobileMenu();
      break;
    case 'add-to-cart': {
      const id = Number(el.dataset.id);
      const item = state.menu.find((m) => m.id === id);
      if (!item) return;
      cart.add(id);
      toast(`"${item.title}" səbətə əlavə olundu`);
      const img = el.closest('article')?.querySelector('[data-product-img]');
      flyToCart(img, $('#cart-btn'));
      el.classList.add('added');
      const label = el.querySelector('span');
      const icon = el.querySelector('i');
      label.textContent = 'Əlavə olundu';
      icon.className = 'fa-solid fa-check text-xs';
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        el.classList.remove('added');
        label.textContent = 'Səbətə Əlavə Et';
        icon.className = 'fa-solid fa-plus text-xs';
      }, 1200);
      break;
    }
    case 'qty':
      cart.changeQty(Number(el.dataset.id), Number(el.dataset.delta));
      break;
    case 'remove-item':
      cart.remove(Number(el.dataset.id));
      break;
    case 'read-book':
      toast(`"${el.dataset.title}" - bu kitabı masanıza istəyə bilərsiniz!`);
      break;
    case 'retry-load':
      loadData();
      break;
  }
});

function toggleMobileMenu() {
  const menu = $('#mobile-menu');
  const btn = $('#mobile-menu-btn');
  const open = menu.classList.toggle('hidden') === false;
  btn.setAttribute('aria-expanded', String(open));
  btn.querySelector('i').className = open ? 'fa-solid fa-xmark text-2xl' : 'fa-solid fa-bars text-2xl';
}

/* ---------- Kateqoriya və axtarış ---------- */
$('#category-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-btn');
  if (!btn) return;
  state.category = btn.dataset.category;
  document.querySelectorAll('.cat-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
  renderMenu();
});

let searchTimer;
$('#menu-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = e.target.value;
    renderMenu();
  }, 180);
});

$('#reservation-form').addEventListener('submit', submitReservation);
$('#cart-form').addEventListener('submit', submitOrder);
cart.subscribe(renderCart);

/* ---------- Başlat ---------- */
initPreloader();
initImageFallback();
initOverlays();
initHeroSlider();
initRotatingWord();
initParticles();
initCounters();
initTilt();
initScrollEffects();
initLightbox();
observeReveal();
markLoadedImages();
renderCart();
loadData();
