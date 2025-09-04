// src/lib/pagarme.js
const BASE = (process.env.PAGARME_BASE_URL || 'https://api.pagar.me/core/v5').trim();
const KEY  = (process.env.PAGARME_SECRET_KEY || '').trim();

function authHeader() {
  return 'Basic ' + Buffer.from(`${KEY}:`).toString('base64');
}

async function coreFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson && text ? JSON.parse(text) : text;

  if (!res.ok) {
    // log controlado para debug
    console.error(`[pagarme] ${method} ${url} -> ${res.status}`, data);
    const err = new Error(`Pagar.me ${method} ${path} ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const pagarmeGET  = (path)         => coreFetch(path, { method: 'GET' });
export const pagarmePOST = (path, body)   => coreFetch(path, { method: 'POST', body });

// helpers de debug
export function __pagarmeDebugMask() {
  if (!KEY) return '(vazio)';
  return KEY.slice(0, 4) + '...' + KEY.slice(-4);
}
export const __pagarmeBase = BASE;
