// src/lib/mikrotik.js
import { RouterOSClient } from 'routeros-client';

// ---------- ENV com aliases ----------
const envStr = (k, fallback=null) => {
  const v = process.env[k];
  return (v === undefined || v === null || v === '') ? fallback : String(v);
};
const envNum = (k, fallback=null) => {
  const s = envStr(k, null);
  if (s === null) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

const HOST =
  envStr('MIKROTIK_HOST',
  envStr('MIKOTIK_HOST',
  envStr('ROUTER_HOST',
  ''))); // vazio força ver erro mais claro

const USER =
  envStr('MIKROTIK_USER',
  envStr('MIKOTIK_USER',
  'admin'));

const PASS =
  envStr('MIKROTIK_PASS',
  envStr('MIKOTIK_PASS',
  ''));

const PORT =
  envNum('MIKROTIK_PORT',
  envNum('PORTA_MIKROTIK', 8728));

const SSL =
  (envStr('MIKROTIK_SSL',
  envStr('MIKOTIK_SSL',
  PORT === 8729 ? 'true' : 'false')).toLowerCase() === 'true');

const TIMEOUT_MS = envNum('MIKROTIK_TIMEOUT_MS', 8000);

const PAID_LIST =
  envStr('MIKROTIK_PAID_LIST',
  envStr('LISTA_PAGA_MIKROTIK',
  'paid_clients'));

// ---------- Cliente ----------
function createClient() {
  if (!HOST) throw new Error('MIKROTIK_HOST não definido');
  return new RouterOSClient({
    host: HOST,
    user: USER,
    password: PASS,
    port: PORT,
    ssl: SSL,
    timeout: TIMEOUT_MS,
    // Se usa cert self-signed e quiser ignorar:
    // rejectUnauthorized: false,
  });
}

async function withClient(fn) {
  const client = createClient();
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try { await client.close(); } catch {}
  }
}

// ---------- Helpers address-list ----------
async function findAddressListId(client, { address, list }) {
  const rows = await client.menu('/ip/firewall/address-list').print({
    where: [
      ['address', '=', address],
      ['list', '=', list],
    ],
  });
  if (Array.isArray(rows) && rows.length) {
    return rows[0]['.id'] || rows[0].id || null;
  }
  return null;
}

async function addToAddressList(client, { list, address, comment }) {
  const id = await findAddressListId(client, { address, list });
  if (id) return { id, created: false };
  const payload = { list, address };
  if (comment) payload.comment = comment;
  const res = await client.menu('/ip/firewall/address-list').add(payload);
  const newId = res?.ret || res?.id || null;
  return { id: newId, created: true };
}

async function removeFromAddressList(client, { list, address }) {
  const id = await findAddressListId(client, { address, list });
  if (!id) return { removed: false, reason: 'not_found' };
  await client.menu('/ip/firewall/address-list').remove({ id });
  return { removed: true };
}

// ---------- API pública da lib ----------
export async function estaPago({ ip, list = PAID_LIST }) {
  if (!ip) throw new Error('IP é obrigatório');
  return withClient(async (client) => {
    const id = await findAddressListId(client, { address: ip, list });
    return Boolean(id);
  });
}

export async function liberarAcesso({ ip, busId, list = PAID_LIST, comment }) {
  if (!ip) throw new Error('IP é obrigatório');
  const cmt = comment || (busId ? `pago via Pix - ${busId}` : 'pago via Pix');
  return withClient(async (client) => {
    const out = await addToAddressList(client, { list, address: ip, comment: cmt });
    return { ok: true, list, ip, ...out };
  });
}

export async function revogarAcesso({ ip, list = PAID_LIST }) {
  if (!ip) throw new Error('IP é obrigatório');
  return withClient(async (client) => {
    const out = await removeFromAddressList(client, { list, address: ip });
    return { ok: out.removed, removed: out.removed, list, ip, reason: out.reason || null };
  });
}

// PPP Active
export async function listPppActive({ limit = 100 } = {}) {
  return withClient(async (client) => {
    const rows = await client.menu('/ppp/active').print(); // traz tudo
    const mapped = Array.isArray(rows) ? rows.slice(0, limit).map(r => ({
      id: r['.id'] || r.id || null,
      name: r.name || null,
      address: r.address || null,
      callerId: r['caller-id'] || r.callerId || null,
      service: r.service || null,
      uptime: r.uptime || null,
    })) : [];
    return mapped;
  });
}

// Status (identity + address-list)
export async function getStatus({ list = PAID_LIST, limit = 100 } = {}) {
  return withClient(async (client) => {
    const identArr = await client.menu('/system/identity').print();
    const identity = Array.isArray(identArr) && identArr[0]?.name ? identArr[0].name : null;

    const items = await client.menu('/ip/firewall/address-list').print({
      where: [['list', '=', list]],
    });

    const mapped = Array.isArray(items) ? items.slice(0, limit).map(r => ({
      id: r['.id'] || r.id || null,
      address: r.address || null,
      comment: r.comment || null,
      creationTime: r['creation-time'] || r.creationTime || null,
      disabled: r.disabled === 'true' || r.disabled === true,
    })) : [];

    return { ok: true, identity, list, items: mapped };
  });
}

// Opcional: ping externo (sanity)
export async function pingRouter() {
  return withClient(async (client) => {
    const res = await client.menu('/ping').once({ address: '1.1.1.1', count: 1 });
    return { ok: true, res };
  });
}

/* ===== Compat ===== */
export async function liberarCliente(...args) { return liberarAcesso(...args); }
export async function liberarClienteNoMikrotik(...args) { return liberarAcesso(...args); }
export async function revogarCliente(...args) { return revogarAcesso(...args); }
