// src/lib/psp/mock.js

// tenta importar o gerador EMV se existir no projeto
let gerarPayloadPix;
try {
  ({ gerarPayloadPix } = require('@/lib/payloadpix.js')); // opcional
} catch (e) {
  gerarPayloadPix = null;
}

function makeTxidFromRef(txRef) {
  // txid Pix: máx. 25 chars, alfanumérico
  const base = String(txRef || 'tx').replace(/[^a-zA-Z0-9]/g, '');
  return (base.length <= 23 ? `tx${base}` : `tx${base}`.slice(0, 25));
}

function safeLower(x) {
  return String(x || '').trim().toLowerCase();
}

export async function criarCobrancaPix({ valorCent, descricao, txRef, expiresInSec = 900 }) {
  const txid = makeTxidFromRef(txRef);
  const id = `mock_${txid}`;
  const expiresAt = new Date(Date.now() + (Number(expiresInSec) || 900) * 1000);

  // tenta gerar um copia-e-cola real se houver PIX_KEY + util
  let copiaECola = `00020126...${id}...6304ABCD`;
  const chave = (process.env.PIX_KEY || '').trim();
  if (gerarPayloadPix && chave) {
    try {
      // valores default “amigáveis” para testes
      const nome = process.env.APP_NAME || 'Lopesul Wi-Fi';
      const cidade = process.env.APP_CITY || 'BRASILIA';
      const valor = Math.round(Number(valorCent || 0)) / 100;
      copiaECola = gerarPayloadPix({
        chave,
        nome,
        cidade,
        valor,
        descricao: descricao || `Pedido ${txid}`,
      });
    } catch {
      // mantém copiaECola dummy
    }
  }

  return {
    externalId: id,
    txid,
    copiaECola,
    qrcodeBase64: null,     // se quiser, pode gerar QR base64 depois
    expiresAt,
    amount: Number(valorCent || 0),
    description: descricao || `Acesso Wi-Fi`,
    provider: 'mock',
  };
}

export function validarAssinaturaWebhook() {
  // no mock não validamos HMAC; sempre true
  return true;
}

export function normalizarEventoWebhook(e) {
  // aceita vários formatos: {externalId, status} ou {data:{id,status}} etc.
  const externalId =
    e?.externalId ||
    e?.id ||
    e?.data?.id ||
    e?.data?.object?.id ||
    null;

  const rawStatus =
    e?.status ||
    e?.data?.status ||
    e?.current_status ||
    e?.event ||
    '';

  const s = safeLower(rawStatus);

  // Deixa o status legível e consistente para o handler:
  // pago | expirado | cancelado | pendente | unknown
  let status = 'unknown';
  if (s.includes('paid') || s === 'pago' || s === 'approved' || s === 'paid_pix') status = 'pago';
  else if (s.includes('expir')) status = 'expirado';
  else if (s.includes('cancel') || s === 'refused' || s === 'denied') status = 'cancelado';
  else if (s.includes('pending') || s === 'pendente') status = 'pendente';

  return { externalId, status };
}
