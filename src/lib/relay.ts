// src/lib/relay.ts
const DEFAULT_TIMEOUT = 7000;

declare const process: {
  env?: {
    RELAY_URL?: string;
    RELAY_BASE?: string;
    RELAY_TOKEN?: string; // << precisamos disso
  };
};

// Normaliza a base do Relay vinda do env (RELAY_URL ou RELAY_BASE)
export function getRelayBase() {
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const base = env.RELAY_URL || env.RELAY_BASE || '';
  return base.replace(/\/+$/, '');
}

function getRelayToken() {
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  return env.RELAY_TOKEN || '';
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

/**
 * Faz requisição HTTP para o Relay via fetchWithTimeout, sempre com Bearer.
 * Lança erro se RELAY_URL/RELAY_BASE estiver ausente.
 */
export async function relayFetch(path: string, init: RequestInit = {}, ms = DEFAULT_TIMEOUT) {
  const base = getRelayBase();
  if (!base) throw new Error('RELAY_URL/RELAY_BASE ausente');

  const token = getRelayToken();
  // Não enviaremos requests sem token — evita spam de [AUTH FAIL]
  if (!token || token.length < 10) {
    throw new Error('RELAY_TOKEN ausente ou inválido');
  }

  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;

  // Garante headers e Bearer
  const headers = new Headers(init.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetchWithTimeout(url, { ...init, headers }, ms);
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