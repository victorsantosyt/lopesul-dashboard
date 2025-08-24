export async function criarCobrancaPix({ valorCent, descricao, txRef, expiresInSec = 900 }) {
  const base = process.env.PAGARME_BASE_URL;
  const key  = process.env.PAGARME_API_KEY;

  // Exemplo genérico: ajuste o body conforme a API do Pagar.me para Pix
  const body = {
    amount: valorCent,              // em centavos
    description: descricao,
    payment_method: "pix",
    pix: {
      expires_in: expiresInSec,
      // opcional: payer info
    },
    reference_key: txRef            // sua referência interna
  };

  const res = await fetch(`${base}/vX/payments`, {  // <-- troque /vX pelo path oficial que você usar
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pagar.me criar cobrança falhou: ${res.status} - ${text}`);
  }

  const json = await res.json();

  // Mapeia campos relevantes (ajuste as chaves conforme resposta real do Pagar.me)
  return {
    externalId: json.id,                          // id da cobrança no Pagar.me
    txid: json?.pix?.qr_code_id || json?.txid,    // conforme o retorno
    copiaECola: json?.pix?.qr_code || json?.pix_copia_e_cola,
    qrcodeBase64: json?.pix?.qr_code_base64,      // se retornar
    expiresAt: json?.pix?.expires_at ? new Date(json.pix.expires_at) : null,
  };
}

export function validarAssinaturaWebhook(req) {
  // Ex.: algumas integrações enviam HMAC no header.
  // Leia o header (ex: 'x-hub-signature' ou 'x-pagarme-signature') e valide com PAGARME_WEBHOOK_SECRET.
  // Deixe como stub para você plugar de acordo com a doc da versão escolhida:
  // return verifyHmac(rawBody, signature, process.env.PAGARME_WEBHOOK_SECRET)
  return true; // provisório se o ambiente de sandbox não exigir assinatura
}
