import { api } from './api.js';
import { esc, money, toast } from './ui.js';

const KEY = 'littera_admin_token';
const $ = (s) => document.querySelector(s);
let token = sessionStorage.getItem(KEY) || '';
let timer = null;

const STATUS = { new: 'Yeni', confirmed: 'Təsdiqləndi', done: 'Tamamlandı', cancelled: 'Ləğv edildi' };
const COLORS = { new: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800', done: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };

const statusSelect = (kind, id, current) => `
  <select data-kind="${kind}" data-id="${esc(id)}" class="status-select text-xs font-semibold rounded-full px-3 py-1.5 border-0 ${COLORS[current] || ''}">
    ${Object.entries(STATUS).map(([v, l]) => `<option value="${v}" ${v === current ? 'selected' : ''}>${l}</option>`).join('')}
  </select>`;

const fmtDate = (iso) => new Date(iso).toLocaleString('az-AZ', { dateStyle: 'short', timeStyle: 'short' });
const empty = (cols) => `<tr><td colspan="${cols}" class="p-6 text-center text-gray-400">Hələ qeyd yoxdur.</td></tr>`;

async function load() {
  try {
    const [reservations, orders] = await Promise.all([api.adminList('reservations', token), api.adminList('orders', token)]);
    $('#res-count').textContent = `(${reservations.length})`;
    $('#ord-count').textContent = `(${orders.length})`;

    $('#res-body').innerHTML = reservations.length
      ? reservations.map((r) => `
        <tr class="border-t border-gray-100 hover:bg-brand-cream/20">
          <td class="p-3 font-mono text-xs">${esc(r.id)}</td>
          <td class="p-3 font-semibold">${esc(r.name)}</td>
          <td class="p-3"><a class="text-brand-gold hover:underline" href="tel:${esc(r.phone)}">${esc(r.phone)}</a></td>
          <td class="p-3">${esc(r.guests)}</td>
          <td class="p-3 whitespace-nowrap">${esc(r.date)} / ${esc(r.time)}</td>
          <td class="p-3 text-xs text-gray-600 max-w-[200px]">${esc(r.notes) || '-'}</td>
          <td class="p-3">${statusSelect('reservations', r.id, r.status)}</td>
        </tr>`).join('')
      : empty(7);

    $('#ord-body').innerHTML = orders.length
      ? orders.map((o) => `
        <tr class="border-t border-gray-100 hover:bg-brand-cream/20">
          <td class="p-3 font-mono text-xs">${esc(o.id)}</td>
          <td class="p-3"><span class="font-semibold">${esc(o.customer.name)}</span><br><a class="text-brand-gold text-xs hover:underline" href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a>${o.note ? `<br><span class="text-xs text-gray-500">${esc(o.note)}</span>` : ''}</td>
          <td class="p-3 text-xs">${o.type === 'takeaway' ? 'Özü ilə aparır' : 'Kafedə'}</td>
          <td class="p-3 text-xs">${o.items.map((i) => `${esc(i.qty)} × ${esc(i.title)}`).join('<br>')}</td>
          <td class="p-3 font-bold whitespace-nowrap">${money(o.total)}</td>
          <td class="p-3 text-xs whitespace-nowrap">${esc(fmtDate(o.createdAt))}</td>
          <td class="p-3">${statusSelect('orders', o.id, o.status)}</td>
        </tr>`).join('')
      : empty(7);
  } catch (err) {
    if (err.status === 401) {
      logout(false);
      $('#login-error').textContent = 'Parol yanlışdır';
    } else {
      toast(err.message, 'error', 5000);
    }
  }
}

function showPanel() {
  $('#login').classList.add('hidden');
  $('#panel').classList.remove('hidden');
  load();
  clearInterval(timer);
  timer = setInterval(load, 30000);
}

function logout(clear = true) {
  if (clear) $('#pw').value = '';
  token = '';
  sessionStorage.removeItem(KEY);
  clearInterval(timer);
  $('#panel').classList.add('hidden');
  $('#login').classList.remove('hidden');
}

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  token = $('#pw').value;
  sessionStorage.setItem(KEY, token);
  showPanel();
});
$('#logout').addEventListener('click', () => logout());
$('#refresh').addEventListener('click', () => { load(); toast('Yeniləndi'); });

document.addEventListener('change', async (e) => {
  const sel = e.target.closest('.status-select');
  if (!sel) return;
  try {
    await api.adminSetStatus(sel.dataset.kind, sel.dataset.id, sel.value, token);
    toast('Status dəyişdirildi');
    load();
  } catch (err) {
    toast(err.message, 'error');
    load();
  }
});

if (token) showPanel();
