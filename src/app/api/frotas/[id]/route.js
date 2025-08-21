// src/app/api/frotas/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// evita cache em prod (Vercel/Railway/proxies)
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const id = String(params?.id || '');
    if (!id) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const frota = await prisma.frota.findUnique({
      where: { id },
      include: { _count: { select: { dispositivos: true } } },
    });
    if (!frota) {
      return NextResponse.json({ error: 'Frota não encontrada' }, { status: 404 });
    }

    // opcional: permitir somar últimos N dias (?days=30)
    const url = new URL(req.url);
    const days = url.searchParams.get('days');
    const whereVenda = { frotaId: id };
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - Number(days));
      whereVenda.data = { gte: since };
    }

    const { _sum } = await prisma.venda.aggregate({
      where: whereVenda,
      _sum: { valor: true },
    });

    const valorTotal = Number(_sum.valor ?? 0);
    const acessos = frota._count?.dispositivos ?? 0;

    // sem monitoramento em tempo real: 'desconhecido' se há dispositivos; 'offline' se não há
    const status = acessos > 0 ? 'desconhecido' : 'offline';

    return NextResponse.json(
      {
        id: frota.id,
        // seu schema não tem "nome"; usamos um rótulo amigável
        nome: frota.nome ?? `Frota ${frota.id.slice(0, 4)}`,
        valorTotal,
        acessos,
        status,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/frotas/[id]', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
