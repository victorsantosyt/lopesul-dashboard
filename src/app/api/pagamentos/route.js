// src/app/api/pagamentos/route.js
import { NextResponse } from 'next/server';

const API = 'https://api.pagar.me/core/v5';
const SK  = process.env.PAGARME_SECRET_KEY; // defina no .env

function extractPix(order) {
  const charges = Array.isArray(order?.charges) ? order.charges : [];
  const charge = charges.find(c =>
    (c?.payment_method || c?.payment_method_type) === 'pix'
  ) || charges[0];

  const trx = charge?.last_transaction || charge?.transaction || null;

  const emv =
    trx?.qr_code_emv ||
    trx?.qr_code_text ||
    trx?.emv ||
    trx?.payload ||
    null;

  return {
    order_id: order?.id || null,
    charge_id: charge?.id || null,
    status: charge?.status || order?.status || null,
    pix: {
      // alguns ambientes não retornam imagem pronta; use o EMV para gerar o QR no front
      qr_code_url: trx?.qr_code || trx?.qrcode || trx?.qr_code_url || null,
      emv,
      expires_at: trx?.expires_at || null,
      expires_in: trx?.expires_in || null,
    },
    raw: order, // deixe no começo pra depurar; remova em produção
  };
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const amount      = parseInt(url.searchParams.get('amount') || '1000', 10);
    const description = url.searchParams.get('description') || 'Acesso Wi-Fi';
    const name        = url.searchParams.get('name') || 'Cliente';
    const mac         = url.searchParams.get('mac') || '';
    const ip          = url.searchParams.get('ip') || '';
    const bus         = url.searchParams.get('bus') || '';
    const expires_in  = parseInt(url.searchParams.get('expires_in') || '1800', 10);
    const idem        = url.searchParams.get('idem') || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

    if (!SK) {
      return NextResponse.json({ error: 'Missing PAGARME_SECRET_KEY' }, { status: 500 });
    }

    const body = {
      closed: true,
      customer: { name },
      items: [{ amount, description, quantity: 1 }],
      payments: [{ payment_method: 'pix', pix: { expires_in } }],
      metadata: { mac, ip, bus }, // útil para casar no webhook/liberação Mikrotik
    };

    const r = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${SK}:`).toString('base64'), // senha vazia
        'Idempotency-Key': idem,
      },
      body: JSON.stringify(body),
    });

    const txt = await r.text();
    if (!r.ok) {
      return NextResponse.json({ error: 'Falha ao criar Pix', detail: txt }, { status: r.status });
    }

    const order = JSON.parse(txt);
    return NextResponse.json(extractPix(order), { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', detail: String(e) }, { status: 500 });
  }
}
