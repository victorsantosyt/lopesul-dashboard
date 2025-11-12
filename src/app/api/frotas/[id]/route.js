// runtime & caching
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { relayFetch } from '@/lib/relay';
import { checkAnyOnline } from '@/lib/netcheck';

/**
 * GET /api/frotas/[id]
 * Retorna detalhes da frota: dispositivos, vendas e status técnico.
 */
export async function GET(_req, { params }) {
  try {
    const id = String(params?.id || '');
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    // 1) Busca frota no banco
    const frota = await prisma.frota.findUnique({
      where: { id },
      include: {
        _count: { select: { dispositivos: true, vendas: true } },
        dispositivos: true,
      },
    });
    if (!frota) return NextResponse.json({ error: 'Frota não encontrada' }, { status: 404 });

    // 2) Vendas no período (últimos X dias)
    const days = 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const vendasPeriodo = await prisma.venda.findMany({
      where: { frotaId: id, data: { gte: since } },
      select: { valorCent: true },
      take: 10000,
    });
    const receitaCentavos = (vendasPeriodo ?? []).reduce(
      (acc, v) => acc + (Number(v?.valorCent) || 0),
      0
    );

    // 3) Status técnico (relay → Mikrotik → fallback)
    const ips = (frota.dispositivos ?? []).map(d => d?.ip).filter(Boolean);
    let status = 'desconhecido';
    let pingMs = null;
    let perda = null;
    const ipAtivo = ips[0] ?? null;

    const host = process.env.MIKROTIK_HOST || '';
    const user = process.env.MIKROTIK_USER || '';
    const pass = process.env.MIKROTIK_PASS || '';

    if (ips.length === 0) {
      status = (frota._count?.dispositivos ?? 0) === 0 ? 'offline' : 'desconhecido';
    } else if (!host || !user || !pass) {
      const { online } = await safeCheckAnyOnline(ips);
      status = online ? 'online' : 'offline';
    } else {
      const relayOk = await probeRelayPing(host, user, pass).catch(() => false);
      if (relayOk) {
        status = 'online';
      } else {
        const { online } = await safeCheckAnyOnline(ips);
        status = online ? 'online' : 'offline';
      }
    }

    return NextResponse.json(
      {
        id: frota.id,
        nome: frota.nome ?? `Frota ${frota.id.slice(0, 4)}`,
        criadoEm: frota.criadoEm,
        acessos: Number(frota._count?.dispositivos ?? 0),
        status,
        ipAtivo,
        pingMs,
        perdaPacotes: perda,
        valorTotal: Number(receitaCentavos / 100),
        valorTotalCentavos: Number(receitaCentavos),
        vendasTotal: Number(frota._count?.vendas ?? 0),
        vendasPeriodoQtd: (vendasPeriodo ?? []).length,
        periodoDias: days,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/frotas/[id]', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

/* ---------- Helpers ---------- */

async function probeRelayPing(host, user, pass) {
  try {
    const r = await relayFetch('/relay/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host,
        user,
        pass,
        command: '/ping address=1.1.1.1 count=3',
      }),
    });
    const j = await r.json().catch(() => ({}));
    const rows = Array.isArray(j?.data) ? j.data : [];
    return Boolean(j?.ok && rows.length > 0);
  } catch {
    return false;
  }
}

async function safeCheckAnyOnline(ips) {
  try {
    return await checkAnyOnline(ips);
  } catch {
    return { online: false };
  }
}
