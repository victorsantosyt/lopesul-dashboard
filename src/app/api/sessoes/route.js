// src/app/api/sessoes/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function badRequest(msg) {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function isIsoDate(s) {
  // aceita YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    // --- ativas=true|false (default: todas) ---
    const ativasParam = searchParams.get('ativas');
    const ativas =
      ativasParam == null
        ? null
        : ativasParam === 'true'
          ? true
          : ativasParam === 'false'
            ? false
            : null;

    if (ativasParam != null && ativas == null) {
      return badRequest('Parâmetro "ativas" deve ser "true" ou "false".');
    }

    // --- limit (1..200) ---
    const limitRaw = Number(searchParams.get('limit') || '50');
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 200)
      : 50;

    // --- período opcional (from/to em YYYY-MM-DD) ---
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (fromStr && !isIsoDate(fromStr)) {
      return badRequest('Parâmetro "from" deve ser YYYY-MM-DD.');
    }
    if (toStr && !isIsoDate(toStr)) {
      return badRequest('Parâmetro "to" deve ser YYYY-MM-DD.');
    }

    // bordas do dia, em UTC
    const AND = [];
    if (fromStr) {
      const from = new Date(`${fromStr}T00:00:00.000Z`);
      AND.push({ inicioEm: { gte: from } });
    }
    if (toStr) {
      const to = new Date(`${toStr}T23:59:59.999Z`);
      AND.push({ inicioEm: { lte: to } });
    }

    const where = {};
    if (ativas !== null) where.ativo = ativas;
    if (AND.length) where.AND = AND;

    const items = await prisma.sessaoAtiva.findMany({
      where,
      orderBy: { inicioEm: 'desc' },
      take: limit,
      select: {
        id: true,
        ipCliente: true,
        macCliente: true,
        inicioEm: true,
        expiraEm: true,
        ativo: true,
        plano: true,
        // pagamentoId: true, // <- descomente se quiser correlacionar no front
        // createdAt: true,   // <- se existir
        // updatedAt: true,   // <- se existir
      },
    });

    return NextResponse.json(items, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('GET /api/sessoes', e?.message || e);
    return NextResponse.json({ error: 'Erro ao listar sessões' }, { status: 500 });
  }
}
