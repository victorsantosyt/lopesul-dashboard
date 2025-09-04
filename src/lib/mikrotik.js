// src/lib/mikrotik.js
import { RouterOSClient } from 'routeros-client';

const HOST = process.env.MIKROTIK_HOST || '192.168.88.1';
const USER = process.env.MIKROTIK_USER || 'admin';
const PASS = process.env.MIKROTIK_PASS || '';
const PORT = Number(process.env.MIKROTIK_PORT || 8728);
const SSL  = String(process.env.MIKROTIK_SSL || 'false').toLowerCase() === 'true';
const TIMEOUT_MS = Number(process.env.MIKROTIK_TIMEOUT_MS || 8000);
const PAID_LIST  = process.env.MIKROTIK_PAID_LIST || 'paid_clients';

/**
 * Cria cliente RouterOS com timeout + auto close
 */
function createClient() {
  return new RouterOSClient({
    host: HOST,
    user: USER,
    password: PASS,
    port: PORT,
    ssl: SSL,
    timeout: TIMEOUT_MS,
    // Opcional: ignore TLS self-signed
    // rejectUnauthorized: false,
  });
}

/**
 * Executa um bloco com cliente conectado e garante fechamento
 */
async function withClient(fn) {
  const client = createClient();
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/**
 * Busca item na address-list por address e list (retorna ID do item ou null)
 */
async function findAddressListId(client, { address, list }) {
  const res = await client.menu('/ip/firewall/address-list').print({
    where: [
      ['address', '=', address],
      ['list', '=', list],
    ],
  });
  // routeros-client retorna array de objetos com .id (por exemplo '*2')
  if (Array.isArray(res) && res.length > 0) {
    return res[0]['.id'] || res[0].id || null;
  }
  return null;
}

/**
 * Adiciona (se não existir) à address-list
 */
async function addToAddressList(client, { list, address, comment }) {
  const id = await findAddressListId(client, { address, list });
  if (id) return { id, created: false }; // já existe (idempotente)

  const payload = { list, address };
  if (comment) payload.comment = comment;

  const res = await client.menu('/ip/firewall/address-list').add(payload);
  const newId = res?.['ret'] || res?.id || null; // depende da versão
  return { id: newId, created: true };
}

/**
 * Remove (se existir) da address-list
 */
async function removeFromAddressList(client, { list, address }) {
  const id = await findAddressListId(client, { address, list });
  if (!id) return { removed: false, reason: 'not_found' };

  await client.menu('/ip/firewall/address-list').remove({ id });
  return { removed: true };
}

/**
 * Verifica se já está presente na lista
 */
export async function estaPago({ ip, list = PAID_LIST }) {
  if (!ip) throw new Error('IP é obrigatório');
  return withClient(async (client) => {
    const id = await findAddressListId(client, { address: ip, list });
    return Boolean(id);
  });
}

/**
 * Libera acesso: adiciona IP em address-list "paid_clients".
 * Idempotente: não duplica se já existir.
 * @param {object} args
 * @param {string} args.ip         IP do cliente (ex.: '10.0.0.55')
 * @param {string} [args.busId]    Opcional: frota/ônibus para comentar log
 * @param {string} [args.list]     Nome da address-list (default: PAID_LIST)
 * @param {string} [args.comment]  Comentário customizado
 */
export async function liberarAcesso({ ip, busId, list = PAID_LIST, comment }) {
  if (!ip) throw new Error('IP é obrigatório');
  const cmt = comment || (busId ? `pago via Pix - ${busId}` : 'pago via Pix');

  return withClient(async (client) => {
    const out = await addToAddressList(client, { list, address: ip, comment: cmt });
    return { ok: true, list, ip, ...out };
  });
}

/**
 * Revoga acesso: remove IP da address-list "paid_clients".
 */
export async function revogarAcesso({ ip, list = PAID_LIST }) {
  if (!ip) throw new Error('IP é obrigatório');

  return withClient(async (client) => {
    const out = await removeFromAddressList(client, { list, address: ip });
    return { ok: out.removed, removed: out.removed, list, ip, reason: out.reason || null };
  });
}

/**
 * (Opcional) Pinga o roteador pela API para health-check
 */
export async function pingRouter() {
  return withClient(async (client) => {
    // /ping 1.1.1.1 count=1 → apenas um teste rápido
    const res = await client.menu('/ping').once({ address: '1.1.1.1', count: 1 });
    return { ok: true, res };
  });
}
