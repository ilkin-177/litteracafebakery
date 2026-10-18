// Səbət (brauzerin localStorage-ında saxlanılır)
const KEY = 'littera_cart_v1';
let items = load();
const listeners = new Set();

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i) => Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty > 0)
      .map((i) => ({ id: i.id, qty: Math.min(i.qty, 20) }));
  } catch (_) {
    return [];
  }
}

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (_) {
    /* private mode və s. */
  }
  listeners.forEach((fn) => fn(items));
}

export const cart = {
  get items() { return items; },
  count() { return items.reduce((a, i) => a + i.qty, 0); },
  add(id, qty = 1) {
    const found = items.find((i) => i.id === id);
    if (found) found.qty = Math.min(20, found.qty + qty);
    else items.push({ id, qty: Math.min(20, qty) });
    commit();
  },
  changeQty(id, delta) {
    const found = items.find((i) => i.id === id);
    if (!found) return;
    found.qty = Math.min(20, found.qty + delta);
    if (found.qty <= 0) items = items.filter((i) => i.id !== id);
    commit();
  },
  remove(id) { items = items.filter((i) => i.id !== id); commit(); },
  clear() { items = []; commit(); },
  keepOnly(validIds) {
    const before = items.length;
    items = items.filter((i) => validIds.includes(i.id));
    if (items.length !== before) commit();
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
