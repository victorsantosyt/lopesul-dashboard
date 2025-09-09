// src/app/api/pagamentos/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const API = 'https://api.pagar.me/core/v5';
const SK  = process.env.PAGARME_SECRET_KEY; // defina no .env

// ---- helpers -------------------------------------------------
function mapPaymentStatus(s) {
  const t = String(s || '').toLowerCase();
  if (['pago','paid','success','sucesso'].includes(t)) return 'PAID';
  if (['pendente','pending','aguardando','waiting'].includes(t)) return 'PENDING';
  if (['falhou','failed','erro','error'].includes(t)) return 'FAILED';
  if (['cancelado','canceled','cancelled'].includes(t)) return 'CANCELED';
  if (['expirado','expired'].includes(t)) return 'EXPIRED';
  return undefined;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(x, max));
}

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
      qr_code_url: trx?.qr_code || trx?.qrcode || trx?.qr_code_url || null,
      emv,
      expires_at: trx?.expires_at || null,
      expires_in: trx?.expires_in || null,
    },
    raw: order, // útil pra depurar; remova em produção
  };
}

// ---- GET = LISTAR pagamentos do DB ---------------------------
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const limit = clamp(url.searchParams.get('limit') ?? 10, 1, 100);
    const status = mapPaymentStatus(url.searchParams.get('status'));

    const fromStr = url.searchParams.get('from'); // YYYY-MM-DD
    const toStr   = url.searchParams.get('to');   // YYYY-MM-DD

    const where = {};
    if (status) where.status = status;

    const AND = [];
    if (fromStr) AND.push({ createdAt: { gte: new Date(`${fromStr}T00:00:00.000Z`) } });
    if (toStr)   AND.push({ createdAt: { lte: new Date(`${toStr}T23:59:59.999Z`) } });
    if (AND.length) where.AND = AND;

    const rows = await prisma.pedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const out = rows.map(p => {
      const c = p.charges?.[0] ?? null;
      return {
        id: p.id,
        code: p.code,
        amount: p.amount,
        method: p.method,         // PIX | CARD | BOLETO
        status: p.status,         // PENDING | PAID | ...
        createdAt: p.createdAt,
        charge: c ? {
          id: c.id,
          status: c.status,       // CREATED | PAID | ...
          qrCode: c.qrCode || null,
          qrCodeUrl: c.qrCodeUrl || null,
          createdAt: c.createdAt,
        } : null,
      };
    });

    return NextResponse.json({ ok: true, count: out.length, rows: out }, { status: 200 });
  } catch (e) {
    console.error('GET /api/pagamentos', e);
    return NextResponse.json({ ok: false, error: 'Erro ao listar pagamentos' }, { status: 500 });
  }
}

// ---- POST = CRIAR ORDEM PIX na Pagar.me ----------------------
export async function POST(req) {
  try {
    if (!SK) {
      return NextResponse.json({ error: 'Missing PAGARME_SECRET_KEY' }, { status: 500 });
    }

    const url = new URL(req.url);
    const bodyIn =
      (await req.json().catch(() => null)) ??
      Object.fromEntries(url.searchParams.entries()); // fallback se alguém mandar via query

    const amount      = parseInt(bodyIn.amount || '1000', 10);
    const description = bodyIn.description || 'Acesso Wi-Fi';
    const name        = bodyIn.name || 'Cliente';
    const mac         = bodyIn.mac || '';
    const ip          = bodyIn.ip || '';
    const bus         = bodyIn.bus || '';
    const expires_in  = parseInt(bodyIn.expires_in || '1800', 10);
    const idem        =
      bodyIn.idem ||
      (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

    const body = {
      closed: true,
      customer: { name },
      items: [{ amount, description, quantity: 1 }],
      payments: [{ payment_method: 'pix', pix: { expires_in } }],
      metadata: { mac, ip, bus },
    };

    const r = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${SK}:`).toString('base64'),
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
    console.error('POST /api/pagamentos', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// (opcional) permitir preflight se chamar do captive externo
export function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}
