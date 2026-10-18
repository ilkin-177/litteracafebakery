// Backend ilə əlaqə
// Sayt Node serverindən açılanda (http://localhost:3000) əlaqəli yol işləyir.
// Live Server (port 5500) və ya fayl kimi açılanda avtomatik http://localhost:3000 istifadə olunur.
const isNodeServer = location.protocol.startsWith('http') && !['5500', '5501', '5502', '8080'].includes(location.port);
export const API_BASE = isNodeServer ? '' : 'http://localhost:3000';

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (_) {
    throw new ApiError('Serverə qoşulmaq alınmadı. Terminalda "npm start" əmrinin işlədiyini yoxlayın.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* boş cavab */
  }
  if (!res.ok) {
    throw new ApiError((data && data.error) || 'Xəta baş verdi', res.status, data && data.details);
  }
  return data;
}

export const api = {
  menu: () => request('/api/menu'),
  books: () => request('/api/books'),
  createReservation: (body) => request('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),
  createOrder: (body) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  // admin
  adminList: (kind, token) => request(`/api/admin/${kind}`, { headers: { Authorization: `Bearer ${token}` } }),
  adminSetStatus: (kind, id, status, token) =>
    request(`/api/admin/${kind}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    }),
};
