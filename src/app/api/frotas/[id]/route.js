// src/app/api/frotas/[id]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAnyOnline } from '@/lib/netcheck';
import { getStarlinkStatus } from '@/lib/mikrotik';

export async function GET(req, { params }) {
  try {
    const id = String(params?.id || '');
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const url = new URL(req.url);
    const days = Number(url.searchParams.get('days') || '30');

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Busca frota + IPs dos dispositivos
    const frota = await prisma.frota.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        criadoEm: true,
        _count: {
          select: {
            dispositivos: true,
            vendas: true,
          },
        },
        dispositivos: {
          select: { ip: true },
          take: 100,
        },
      },
    });

    if (!frota) {
      return NextResponse.json({ error: 'Frota não encontrada' }, { status: 404 });
    }

    // Soma das vendas no período
    const vendasPeriodo = await prisma.venda.findMany({
      where: {
        frotaId: id,
        data: { gte: since },
      },
      select: { valorCent: true },
      take: 10000,
    });

    const receitaCentavos = (vendasPeriodo ?? []).reduce(
      (acc, v) => acc + (Number(v?.valorCent) || 0),
      0
    );

    // Status técnico (Mikrotik)
    const ips = (frota.dispositivos ?? []).map((d) => d?.ip).filter(Boolean);
    let status = 'desconhecido';
    let pingMs = null;
    let perda = null;
    let ipAtivo = ips[0] ?? null;

    if (ips.length > 0) {
      try {
        const result = await getStarlinkStatus({
          host: process.env.MIKROTIK_HOST,
          user: process.env.MIKROTIK_USER,
          pass: process.env.MIKROTIK_PASS,
        });
        status = result?.internet?.ok ? 'online' : 'offline';
        pingMs = result?.internet?.rtt_ms ?? null;
        perda = result?.internet?.loss_pct ?? null;
      } catch (err) {
        console.warn('[frotas/id] Falha ao obter status Mikrotik:', err.message);
        const { online } = await checkAnyOnline(ips);
        status = online ? 'online' : 'offline';
      }
    } else if ((frota._count?.dispositivos ?? 0) === 0) {
      status = 'offline';
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
