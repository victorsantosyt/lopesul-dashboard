export async function criarCheckout({ valor, descricao, clienteIp, clienteMac }) {
  const res = await fetch('/api/pagamentos/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor, descricao, clienteIp, clienteMac }),
  });
  if (!res.ok) throw new Error('Falha ao criar cobrança');
  return res.json(); // { externalId, copiaECola, qrcodeBase64, expiracao, ... }
}

export async function verificarPorExternalId(externalId) {
  const res = await fetch('/api/verificar-pagamento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId }),
  });
  if (!res.ok) throw new Error('Falha ao verificar pagamento');
  return res.json(); // { encontrado, pago, status, ... }
}
