// src/lib/mikrotik.js
import { RouterOSClient } from 'routeros-client';

// ---- ENV helpers (aceita sinônimos pra evitar typos) ----
const yes = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase());

const HOST =
  process.env.MIKROTIK_HOST ||
  process.env.MIKOTIK_HOST || // fallback p/ typo visto em prints
  '192.168.88.1';

const USER =
  process.env.MIKROTIK_USER ||
  process.env.MIKROTIK_USERNAME ||
  'admin';

const PASS =
  process.env.MIKROTIK_PASS ||
  process.env.MIKROTIK_PASSWORD ||
  '';

const PORT = Number(
  process.env.MIKROTIK_PORT ||
  process.env.PORTA_MIKROTIK || // sinônimo (pt-BR)
  (yes(process.env.MIKROTIK_SSL) ? 8729 : 8728)
);

const SECURE =
  yes(process.env.MIKROTIK_SSL) ||
  yes(process.env.MIKROTIK_SECURE);

const TIMEOUT_MS = Number(process.env.MIKROTIK_TIMEOUT_MS || 8000);

const PAID_LIST =
  process.env.MIKROTIK_PAID_LIST ||
  process.env.LISTA_PAGA_MIKROTIK || // sinônimo (pt-BR)
  'paid_clients';

// ---- Cliente RouterOS ----
function createClient() {
  return new RouterOSClient({
    host: HOST,
    user: USER,
    pass: PASS,          // << importante: 'pass' (não 'password')
    port: PORT,
    secure: SECURE,      // << importante: 'secure' (não 'ssl')
    timeout: TIMEOUT_MS,
    // rejectUnauthorized: false, // se usar TLS self-signed
  });
}


async function withClient(fn) {
  const client = createClient();
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

// ---- Address-list helpers ----
async function findAddressListId(client, { address, list }) {
  const res = await client.menu('/ip/firewall/address-list').print({
    where: [
      ['address', '=', address],
      ['list', '=', list],
    ],
  });
   if (Array.isArray(res) && res.length > 0) {
    return res[0]['.id'] || res[0].id || null;
  }
  return null;
}


async function addToAddressList(client, { list, address, comment }) {
  const id = await findAddressListId(client, { address, list });
  if (id) return { id, created: false }; // idempotente

  const payload = { list, address };
  if (comment) payload.comment = comment;

  const out = await client.menu('/ip/firewall/address-list').add(payload);
  const newId = out?.ret || out?.id || null;
  return { id: newId, created: true };
}


async function removeFromAddressList(client, { list, address }) {
  const id = await findAddressListId(client, { address, list });
  if (!id) return { removed: false, reason: 'not_found' };
  // RouterOS espera '.id'
  await client.menu('/ip/firewall/address-list').remove({ '.id': id });
  return { removed: true };
}

// ---- API pública ----
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


export async function pingRouter() {
  return withClient(async (client) => {
    // teste rápido (qualquer um funciona nas versões recentes)
    try {
      const res = await client.menu('/ping').once({ address: '1.1.1.1', count: 1 });
      return { ok: true, res };
    } catch {
      const res = await client.menu('/tool/ping').once({ address: '1.1.1.1', count: 1 });
      return { ok: true, res };
    }
  });
}


// ---- Compat nomes antigos (mantidos) ----
export async function liberarCliente(...args) {
  if (typeof liberarAcesso === 'function') return liberarAcesso(...args);
  if (typeof allowClient === 'function') return allowClient(...args);
  if (typeof liberar === 'function') return liberar(...args);
  throw new Error('liberarCliente: implementação ausente em lib/mikrotik.js');
}


export async function liberarClienteNoMikrotik(...args) {
  return liberarCliente(...args);
}


export async function revogarCliente(...args) {
  if (typeof revogarAcesso === 'function') return revogarAcesso(...args);
  if (typeof revokeClient === 'function') return revokeClient(...args);
  if (typeof revogar === 'function') return revogar(...args);
  throw new Error('revogarCliente: implementação ausente em lib/mikrotik.js');
}


export async function listPppActive(...args) {
  if (typeof listarPppActive === 'function') return listarPppActive(...args);
  if (typeof getPppActive === 'function') return getPppActive(...args);
  if (typeof listActiveSessions === 'function') return listActiveSessions(...args);
  throw new Error('listPppActive: implementação ausente em lib/mikrotik.js');
}
