// src/app/api/payments/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PT -> ENUM (ajuste os enums conforme seu schema)
const statusMap = {
  pago: 'PAID',
  pendente: 'PENDING',
  falhou: 'FAILED',
  cancelado: 'CANCELED',
  expirado: 'EXPIRED',
};

// Métodos aceitos (ajuste se seu schema usa outros nomes)
const allowedMethods = new Set(['pix', 'card', 'boleto']);

function parseIntSafe(v, def = undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function atStart(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function atEnd(d)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // paginação
    const take = Math.min(parseIntSafe(searchParams.get('limit'), 10) ?? 10, 50);
    const cursor = searchParams.get('cursor'); // espera ID do pedido
    const cursorObj = cursor ? { id: cursor } : undefined;

    // filtros
    const statusPt = (searchParams.get('status') || '').toLowerCase().trim();
    const statusEnum = statusMap[statusPt];

    const method = (searchParams.get('method') || '').toLowerCase().trim();
    const methodFilter = allowedMethods.has(method) ? method : undefined;

    const q = (searchParams.get('q') || '').trim();
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to   = searchParams.get('to');   // YYYY-MM-DD

    const minAmount = parseIntSafe(searchParams.get('min'));
    const maxAmount = parseIntSafe(searchParams.get('max'));

    // where dinâmico
    const where = {};
    if (statusEnum) where.status = statusEnum;
    if (methodFilter) where.method = methodFilter.toUpperCase(); // se seu schema usa uppercase
    if (minAmount != null || maxAmount != null) {
      where.amount = {};
      if (minAmount != null) where.amount.gte = minAmount;
      if (maxAmount != null) where.amount.lte = maxAmount;
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = atStart(from);
      if (to)   where.createdAt.lte = atEnd(to);
    }
    if (q) {
      // busca simples por código, nome, email (ajuste campos conforme schema)
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { customerName:  { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1, // pega 1 a mais para saber se tem próxima página
      ...(cursorObj && { cursor: cursorObj, skip: 1 }), // start after cursor
      include: {
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 1, // última charge
          select: {
            id: true,
            providerId: true,
            status: true,
            qrCodeUrl: true,
            createdAt: true,
          },
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
        method: true,
        amount: true,
        createdAt: true,
        customerName: true,
        customerEmail: true,
        customerDoc: true,
        charges: true,
      },
    });

    // paginação: corta o extra e calcula próximo cursor
    let nextCursor = null;
    if (pedidos.length > take) {
      const last = pedidos.pop();
      nextCursor = last.id;
    }

    const data = pedidos.map((p) => {
      const c = p.charges?.[0] || null;
      return {
        id: p.id,
        order_code: p.code,
        status: p.status,
        method: p.method,
        amount: p.amount,
        createdAt: p.createdAt,
        customer: {
          name: p.customerName,
          email: p.customerEmail,
          doc: p.customerDoc,
        },
        charge: c && {
          id: c.id,
          providerId: c.providerId,
          status: c.status,
          qrCodeUrl: c.qrCodeUrl,
          createdAt: c.createdAt,
        },
      };
    });

    return NextResponse.json({ data, nextCursor });
  } catch (e) {
    // Loga no server (opcional): console.error(e);
    return NextResponse.json(
      { error: 'Erro ao listar pagamentos', detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
