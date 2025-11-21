// src/app/api/pagamentos/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const API = 'https://api.pagar.me/core/v5';
const SK  = (process.env.PAGARME_SECRET_KEY || '').trim(); // defina no .env

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

function toYMDLocal(d) {
  const date = d instanceof Date ? d : new Date(d);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const da = String(date.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
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
    const limit = clamp(url.searchParams.get('limit') ?? 100, 1, 500); // Aumentado para 100 padrão, max 500
    const status = mapPaymentStatus(url.searchParams.get('status'));

    const fromStr = url.searchParams.get('from'); // YYYY-MM-DD
    const toStr   = url.searchParams.get('to');   // YYYY-MM-DD
    const q = url.searchParams.get('q')?.trim();

    // Construir where corretamente combinando AND e OR
    const where = {};
    const AND = [];

    // Filtro de status
    if (status) {
      AND.push({ status });
    }

    // Filtros de data
    if (fromStr) {
      AND.push({ createdAt: { gte: new Date(`${fromStr}T00:00:00.000Z`) } });
    }
    if (toStr) {
      AND.push({ createdAt: { lte: new Date(`${toStr}T23:59:59.999Z`) } });
    }

    // Busca por texto (OR) - combina com outros filtros via AND
    if (q) {
      const searchConditions = [
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { ip: { contains: q, mode: 'insensitive' } },
        { deviceMac: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
      ];
      AND.push({ OR: searchConditions });
    }

    // Aplicar AND se houver condições
    if (AND.length > 0) {
      if (AND.length === 1) {
        Object.assign(where, AND[0]);
      } else {
        where.AND = AND;
      }
    }

    const rows = await prisma.pedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        device: {
          select: {
            mikId: true,
            ip: true,
          },
        },
        SessaoAtiva: {
          where: { ativo: true },
          take: 1,
          include: {
            roteador: {
              select: {
                nome: true,
              },
            },
          },
        },
      },
    });

    // Mapear para o formato esperado pela página
    const itens = rows.map(p => {
      const c = p.charges?.[0] ?? null;
      
      // Mapear status para formato esperado pela página
      let statusPt = 'pendente';
      if (p.status === 'PAID' || p.status === 'pago') statusPt = 'pago';
      else if (p.status === 'EXPIRED' || p.status === 'expirado') statusPt = 'expirado';
      else if (p.status === 'PENDING' || p.status === 'pendente') statusPt = 'pendente';
      else if (p.status === 'CANCELED' || p.status === 'cancelado') statusPt = 'cancelado';
      else if (p.status === 'FAILED' || p.status === 'falhou') statusPt = 'falhou';
      
      // Mapear método de pagamento
      let forma = 'PIX';
      if (p.method === 'CARD') forma = 'Cartão';
      else if (p.method === 'BOLETO') forma = 'Boleto';
      else if (p.method === 'PIX') forma = 'PIX';
      
      return {
        id: p.id,
        code: p.code,
        descricao: p.description || 'Acesso Wi-Fi',
        plano: p.description || 'Acesso', // Usar description como plano
        valor: (p.amount || 0) / 100, // Converter centavos para reais
        forma: forma,
        data: p.createdAt,
        status: statusPt,
        mac: p.deviceMac || null,
        ip: p.ip || null,
        roteador: p.SessaoAtiva?.[0]?.roteador?.nome || p.device?.mikId || null,
        // Campos adicionais para compatibilidade
        amount: p.amount,
        method: p.method,
        customerName: p.customerName || null,
        customerDoc: p.customerDoc || null,
        charge: c ? {
          id: c.id,
          status: c.status,
          qrCode: c.qrCode || null,
          qrCodeUrl: c.qrCodeUrl || null,
          createdAt: c.createdAt,
        } : null,
      };
    });

    // Calcular resumo
    const qtdPagos = rows.filter(p => p.status === 'PAID').length;
    const qtdPendentes = rows.filter(p => p.status === 'PENDING').length;
    const qtdExpirados = rows.filter(p => p.status === 'EXPIRED').length;
    const totalPagos = rows
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + (p.amount || 0), 0) / 100;

    // Calcular período
    const periodo = {
      from: fromStr || toYMDLocal(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
      to: toStr || toYMDLocal(new Date()),
      days: fromStr && toStr ? Math.ceil((new Date(toStr) - new Date(fromStr)) / (24 * 60 * 60 * 1000)) + 1 : 30,
    };

    return NextResponse.json({
      ok: true,
      count: itens.length,
      itens, // Nome correto esperado pela página
      rows: itens, // Manter compatibilidade
      periodo,
      resumo: {
        qtdPagos,
        qtdPendentes,
        qtdExpirados,
        totalPagos,
      },
    }, { status: 200 });
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
