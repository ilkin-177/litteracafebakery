'use strict';
/**
 * Littera Cafe & Bakery - backend
 * Heç bir xarici paket tələb olunmur: yalnız Node.js (>=18) daxili modulları.
 *
 * API:
 *   GET   /api/health
 *   GET   /api/menu
 *   GET   /api/books
 *   POST  /api/reservations          (masa sifarişi)
 *   POST  /api/orders                (səbət sifarişi)
 *   GET   /api/admin/reservations    (Bearer parol)
 *   GET   /api/admin/orders          (Bearer parol)
 *   PATCH /api/admin/(reservations|orders)/:id   {status}
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

/* ---------- .env yükləyici (sadə) ---------- */
function loadEnv(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let value = m[2];
      if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  } catch (_) {
    /* .env yoxdursa problem deyil */
  }
}
loadEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD .env faylında və ya mühit dəyişənlərində təyin edilməlidir.');
}

/* ---------- Xəta sinfi ---------- */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/* ---------- JSON fayl bazası (atomik yazma + növbə) ---------- */
class JsonStore {
  constructor(fileName, fallback) {
    this.file = path.join(DATA_DIR, fileName);
    this.fallback = fallback;
    this.queue = Promise.resolve();
  }

  async read() {
    try {
      const raw = await fsp.readFile(this.file, 'utf8');
      return JSON.parse(raw.replace(/^\uFEFF/, '') || 'null') ?? JSON.parse(JSON.stringify(this.fallback));
    } catch (err) {
      if (err.code === 'ENOENT') return JSON.parse(JSON.stringify(this.fallback));
      throw err;
    }
  }

  async _write(data) {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const tmp = this.file + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    try {
      await fsp.rename(tmp, this.file);
    } catch (_) {
      // Bəzi Windows hallarında rename uğursuz ola bilər - birbaşa yazırıq
      await fsp.writeFile(this.file, JSON.stringify(data, null, 2), 'utf8');
      await fsp.unlink(tmp).catch(() => {});
    }
  }

  /** Oxu -> dəyiş -> yaz (eyni anda bir əməliyyat) */
  update(mutator) {
    const run = async () => {
      const data = await this.read();
      const result = await mutator(data);
      await this._write(data);
      return result;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }
}

const menuStore = new JsonStore('menu.json', []);
const booksStore = new JsonStore('books.json', []);
const reservationsStore = new JsonStore('reservations.json', []);
const ordersStore = new JsonStore('orders.json', []);

/* ---------- Köməkçi funksiyalar ---------- */
function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooBig = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooBig = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return reject(new HttpError(413, 'Göndərilən məlumat çox böyükdür'));
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new HttpError(400, 'JSON obyekt gözlənilirdi'));
        }
        resolve(parsed);
      } catch (_) {
        reject(new HttpError(400, 'Yanlış JSON formatı'));
      }
    });
    req.on('error', reject);
  });
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // idarəedici simvolları sil, boşluqları sıxlaşdır, kəs
  return value.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function genId(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function todayString() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ---------- Sadə rate limit (IP başına) ---------- */
const hits = new Map();
function rateLimit(req, key, max, windowMs) {
  const ip = req.socket.remoteAddress || 'unknown';
  const id = `${key}:${ip}`;
  const now = Date.now();
  const list = (hits.get(id) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(id, list);
    throw new HttpError(429, 'Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin.');
  }
  list.push(now);
  hits.set(id, list);
}
setInterval(() => {
  const now = Date.now();
  for (const [id, list] of hits) {
    const fresh = list.filter((t) => now - t < 15 * 60 * 1000);
    if (fresh.length) hits.set(id, fresh);
    else hits.delete(id);
  }
}, 5 * 60 * 1000).unref();

/* ---------- Admin yoxlaması ---------- */
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
function requireAdmin(req) {
  rateLimit(req, 'admin', 60, 10 * 60 * 1000);
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !crypto.timingSafeEqual(sha(token), sha(ADMIN_PASSWORD))) {
    throw new HttpError(401, 'Parol yanlışdır');
  }
}

/* ---------- Validasiya ---------- */
const GUESTS = ['1', '2', '3-4', '5+'];
const STATUSES = ['new', 'confirmed', 'done', 'cancelled'];

function validateReservation(body) {
  const errors = {};
  const name = cleanText(body.name, 80);
  const phone = cleanText(body.phone, 25);
  const guests = cleanText(String(body.guests ?? ''), 10);
  const date = cleanText(body.date, 10);
  const time = cleanText(body.time, 5);
  const notes = cleanText(body.notes, 300);

  if (name.length < 2) errors.name = 'Ad və soyadı daxil edin';
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()\-]{7,25}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    errors.phone = 'Telefon nömrəsi düzgün deyil';
  }
  if (!GUESTS.includes(guests)) errors.guests = 'Qonaq sayını seçin';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00'))) {
    errors.date = 'Tarix düzgün deyil';
  } else if (date < todayString()) {
    errors.date = 'Keçmiş tarixə sifariş etmək olmaz';
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    errors.time = 'Saat düzgün deyil';
  } else if (time < '08:00' || time > '23:00') {
    errors.time = 'Saat 08:00 - 23:00 arasında olmalıdır';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(422, 'Məlumatlar düzgün deyil', errors);
  }
  return { name, phone, guests, date, time, notes };
}

async function validateOrder(body) {
  const errors = {};
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const name = cleanText(customer.name, 80);
  const phone = cleanText(customer.phone, 25);
  const type = body.type === 'takeaway' ? 'takeaway' : 'dine-in';
  const note = cleanText(body.note, 300);

  if (name.length < 2) errors.name = 'Adınızı daxil edin';
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()\-]{7,25}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    errors.phone = 'Telefon nömrəsi düzgün deyil';
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.items = 'Səbət boşdur';
  } else if (body.items.length > 40) {
    errors.items = 'Səbətdə çox sayda məhsul var';
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Məlumatlar düzgün deyil', errors);

  const menu = await menuStore.read();
  const merged = new Map();
  for (const raw of body.items) {
    const id = Number(raw && raw.id);
    const qty = Number(raw && raw.qty);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new HttpError(422, 'Məhsul məlumatı düzgün deyil', { items: 'Məhsul və ya say yanlışdır' });
    }
    merged.set(id, Math.min(20, (merged.get(id) || 0) + qty));
  }

  const items = [];
  let total = 0;
  for (const [id, qty] of merged) {
    const product = menu.find((m) => m.id === id);
    if (!product) throw new HttpError(422, 'Menyuda olmayan məhsul göndərildi', { items: `Məhsul tapılmadı (#${id})` });
    const lineTotal = round2(product.price * qty);
    total += lineTotal;
    items.push({ id, title: product.title, price: product.price, qty, lineTotal });
  }
  return { customer: { name, phone }, type, note, items, total: round2(total) };
}

/* ---------- API marşrutlaşdırıcısı ---------- */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, { ...CORS_HEADERS, 'Content-Length': 0 });
    return res.end();
  }
  const send = (status, body) => sendJson(res, status, body, CORS_HEADERS);

  if (method === 'GET' && pathname === '/api/health') {
    return send(200, { ok: true, time: new Date().toISOString() });
  }

  if (method === 'GET' && pathname === '/api/menu') {
    return send(200, await menuStore.read());
  }

  if (method === 'GET' && pathname === '/api/books') {
    return send(200, await booksStore.read());
  }

  if (method === 'POST' && pathname === '/api/reservations') {
    rateLimit(req, 'reservation', 10, 10 * 60 * 1000);
    const data = validateReservation(await readBody(req));
    const record = {
      id: genId('R'),
      ...data,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    await reservationsStore.update((list) => {
      list.push(record);
    });
    console.log(`[rezerv] ${record.id} - ${record.name} (${record.date} ${record.time})`);
    return send(201, { ok: true, id: record.id });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    rateLimit(req, 'order', 15, 10 * 60 * 1000);
    const data = await validateOrder(await readBody(req));
    const record = {
      id: genId('O'),
      ...data,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    await ordersStore.update((list) => {
      list.push(record);
    });
    console.log(`[sifariş] ${record.id} - ${record.customer.name} (${record.total.toFixed(2)} AZN)`);
    return send(201, { ok: true, id: record.id, total: record.total });
  }

  if (method === 'GET' && pathname === '/api/admin/reservations') {
    requireAdmin(req);
    const list = await reservationsStore.read();
    return send(200, list.slice().reverse());
  }

  if (method === 'GET' && pathname === '/api/admin/orders') {
    requireAdmin(req);
    const list = await ordersStore.read();
    return send(200, list.slice().reverse());
  }

  const patch = pathname.match(/^\/api\/admin\/(reservations|orders)\/([A-Za-z0-9-]+)$/);
  if (method === 'PATCH' && patch) {
    requireAdmin(req);
    const body = await readBody(req);
    if (!STATUSES.includes(body.status)) throw new HttpError(422, 'Status yanlışdır');
    const store = patch[1] === 'orders' ? ordersStore : reservationsStore;
    const found = await store.update((list) => {
      const item = list.find((x) => x.id === patch[2]);
      if (!item) return false;
      item.status = body.status;
      item.updatedAt = new Date().toISOString();
      return true;
    });
    if (!found) throw new HttpError(404, 'Qeyd tapılmadı');
    return send(200, { ok: true });
  }

  throw new HttpError(404, 'API ünvanı tapılmadı');
}

/* ---------- Statik fayllar ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    throw new HttpError(405, 'Metod dəstəklənmir');
  }

  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch (_) {
    throw new HttpError(400, 'Yanlış ünvan');
  }
  if (rel.includes('\0')) throw new HttpError(400, 'Yanlış ünvan');

  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  if (rel.endsWith('/')) rel += 'index.html';

  let filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    throw new HttpError(403, 'Giriş qadağandır');
  }

  let stat;
  try {
    stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fsp.stat(filePath);
    }
  } catch (_) {
    throw new HttpError(404, 'Səhifə tapılmadı');
  }

  const ext = path.extname(filePath).toLowerCase();
  const isAsset = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff2'].includes(ext);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': isAsset ? 'public, max-age=3600' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (req.method === 'HEAD') return res.end();

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

function sendNotFoundPage(res) {
  const html = `<!DOCTYPE html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 | Littera</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#2C1810;color:#FAEDCD;font-family:Georgia,serif;text-align:center}
a{color:#D4A373}h1{font-size:4rem;margin:0}</style></head>
<body><div><h1>404</h1><p>Axtardığınız səhifə tapılmadı.</p><p><a href="/">Ana səhifəyə qayıt</a></p></div></body></html>`;
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
  res.end(html);
}

/* ---------- Server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (err) {
    const isApi = (req.url || '').startsWith('/api/');
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error('[xəta]', err);
    if (res.headersSent) return res.end();

    if (isApi) {
      const body = { ok: false, error: status === 500 ? 'Server xətası baş verdi' : err.message };
      if (err.details) body.details = err.details;
      return sendJson(res, status, body, CORS_HEADERS);
    }
    if (status === 404) return sendNotFoundPage(res);
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 500 ? 'Server xətası' : err.message);
  }
});

if (require.main === module) {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ ${PORT} portu artıq istifadədədir.`);
      console.error('   Başqa port seçin:  PORT=3001 npm start   (Windows PowerShell: $env:PORT=3001; npm start)\n');
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log('\n☕  Littera Cafe & Bakery serveri işləyir');
    console.log(`   Sayt:   http://localhost:${PORT}`);
    console.log(`   Admin:  http://localhost:${PORT}/admin`);
    console.log('   Dayandırmaq üçün: Ctrl + C\n');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      console.log('\nServer dayandırılır...');
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 1500).unref();
    });
  }
}
module.exports = server;