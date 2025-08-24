// src/lib/psp/pagarme.js
import crypto from 'crypto';

/**
 * ENV esperadas:
 * - PAGARME_BASE_URL (ex: https://api.pagar.me)
 * - PAGARME_PAYMENTS_PATH (ex: /core/v5/payments)  ← ajuste quando tiver a doc oficial
 * - PAGARME_API_KEY
 * - (opcional) PAGARME_IDEMPOTENCY: "1" para enviar Idempotency-Key
 * - (opcional) PAGARME_WEBHOOK_SECRET: para validar HMAC no webhook
 */

function requiredEnv(name) {
  const val = (process.env[name] || '').trim();
  if (!val) throw new Error(`[pagarme] Falta configurar ${name}`);
  return val;
}

function getConfig() {
  const baseURL = (process.env.PAGARME_BASE_URL || 'https://api.pagar.me').replace(/\/+$/, '');
  const path = (process.env.PAGARME_PAYMENTS_PATH || '/core/v5/payments'); // <- ajuste quando confirmar a versão
  const apiKey = requiredEnv('PAGARME_API_KEY');
  const useIdempotency = (process.env.PAGARME_IDEMPOTENCY || '').trim() === '1';
  return { baseURL, path, apiKey, useIdempotency };
}

function toBRLNumberFromCents(cents) {
  const n = Number(cents || 0);
  return Math.round(n) / 100;
}

export async function criarCobrancaPix({ valorCent, descricao, txRef, expiresInSec = 900 }) {
  const { baseURL, path, apiKey, useIdempotency } = getConfig();

  if (!Number.isFinite(valorCent) || valorCent <= 0) {
    throw new Error('[pagarme] valorCent inválido');
  }

  // corpo genérico compatível com a maioria dos catálogos Pagar.me
  const body = {
    amount: Math.trunc(valorCent),          // centavos
    description: descricao || `Pedido ${txRef}`,
    payment_method: 'pix',
    pix: { expires_in: Math.trunc(expiresInSec || 900) },
    reference_key: String(txRef || '').slice(0, 50), // referência sua (limite por segurança)
  };

  const url = `${baseURL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Idempotency-Key ajuda a evitar dupla criação se houver retry
  if (useIdempotency) {
    headers['Idempotency-Key'] = `pix-${txRef}`;
  }

  // Timeout defensivo
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(t);
    throw new Error(`[pagarme] erro de rede ao criar cobrança: ${err?.message || err}`);
  }
  clearTimeout(t);

  if (!res.ok) {
    // tenta extrair JSON de erro do PSP
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`[pagarme] criar cobrança falhou: ${res.status} ${res.statusText} - ${detail}`);
  }

  let json;
  try { json = await res.json(); } catch (e) {
    throw new Error('[pagarme] resposta inválida (não-JSON) ao criar cobrança');
  }

  // Tenta mapear campos comuns; mantenha essas linhas fáceis de ajustar quando tiver a doc final
  const externalId =
    json?.id ||
    json?.data?.id ||
    json?.transaction_id ||
    json?.charge_id;

  const txid =
    json?.pix?.qr_code_id ||
    json?.txid ||
    json?.pix_qr_code_id ||
    null;

  const copiaECola =
    json?.pix?.qr_code ||
    json?.pix_copia_e_cola ||
    json?.qr_code ||
    null;

  const qrcodeBase64 =
    json?.pix?.qr_code_base64 ||
    json?.qr_code_base64 ||
    null;

  const expiresAtStr =
    json?.pix?.expires_at ||
    json?.expires_at ||
    null;

  return {
    externalId,
    txid,
    copiaECola,
    qrcodeBase64,
    expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
    amount: Math.trunc(valorCent),
    description: body.description,
    provider: 'pagarme',
  };
}

/**
 * Validação HMAC do webhook.
 * - Se PAGARME_WEBHOOK_SECRET não estiver setado, retorna true (modo permissivo).
 * - Por padrão, espera um header 'x-pagarme-signature' com HMAC SHA-256 do corpo bruto (hex ou base64).
 *   Ajuste o nome do header/algoritmo assim que tiver a doc oficial da sua conta.
 */
export function validarAssinaturaWebhook({ raw, headers }) {
  const secret = (process.env.PAGARME_WEBHOOK_SECRET || '').trim();
  if (!secret) return true; // permissivo em dev

  const sigHeader =
    headers.get('x-pagarme-signature') ||
    headers.get('x-hub-signature-256') ||
    headers.get('x-signature') ||
    '';

  if (!sigHeader) return false;

  // Extrai somente a assinatura (remove prefixos tipo "sha256=" se houver)
  const received = String(sigHeader).replace(/^sha256=/i, '').trim();

  // Calcula HMAC do corpo bruto
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const hmacBase64 = crypto.createHmac('sha256', secret).update(raw).digest('base64');

  // compara com segurança se possível
  const safeEq = (a, b) => {
    try {
      const ba = Buffer.from(a);
      const bb = Buffer.from(b);
      if (ba.length !== bb.length) return false;
      return crypto.timingSafeEqual(ba, bb);
    } catch { return a === b; }
  };

  return safeEq(received, hmac) || safeEq(received, hmacBase64);
}

/**
 * Normaliza vários formatos de evento para { externalId, status }
 * Aceita:
 *  - { id, status }
 *  - { data: { id, status } }
 *  - { data: { object: { id, status } } }
 *  - { charges: [{ id, status }]} (fallback)
 */
export function normalizarEventoWebhook(evento) {
  const get = (...paths) => {
    for (const p of paths) {
      let v = evento;
      for (const key of p.split('.')) {
        if (v && Object.prototype.hasOwnProperty.call(v, key)) v = v[key];
        else { v = undefined; break; }
      }
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };

  const externalId =
    get('data.id', 'id', 'data.object.id', 'transaction_id', 'charge_id') ||
    get('charges.0.id');

  const rawStatus =
    get('data.status', 'status', 'current_status', 'data.object.status') ||
    get('charges.0.status') ||
    '';

  const s = String(rawStatus || '').toLowerCase();

  // você pode ampliar esses mapeamentos conforme a doc do seu contrato
  let status = 'unknown';
  if (s.includes('paid') || s === 'pago' || s === 'approved' || s === 'paid_pix') status = 'pago';
  else if (s.includes('expir')) status = 'expirado';
  else if (s.includes('cancel') || s === 'refused' || s === 'denied') status = 'cancelado';
  else if (s.includes('pending') || s === 'pendente') status = 'pendente';

  return { externalId, status };
}
