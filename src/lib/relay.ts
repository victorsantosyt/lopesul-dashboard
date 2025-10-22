// src/lib/relay.ts
const DEFAULT_TIMEOUT = 7000;

// Normaliza a base do Relay vinda do env (RELAY_URL ou RELAY_BASE)
export function getRelayBase() {
  const base = process.env.RELAY_URL || process.env.RELAY_BASE || '';
  return base.replace(/\/+$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = DEFAULT_TIMEOUT) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(id);
  }
}

export async function relayFetch(path: string, init: RequestInit = {}, ms = DEFAULT_TIMEOUT) {
  const base = getRelayBase();
  if (!base) throw new Error('RELAY_URL/RELAY_BASE ausente');
  const p = path.startsWith('/') ? path : `/${path}`;
  return fetchWithTimeout(`${base}${p}`, init, ms);
}

// helpers opcionais
export function toHealth(url: string) {
  const base = url.replace(/\/relay\/exec\/?$/i, '').replace(/\/$/, '');
  return `${base}/health`;
}
export function toExec(url: string) {
  if (/\/relay\/exec\/?$/i.test(url)) return url;
  return `${url.replace(/\/$/, '')}/relay/exec`;
}
