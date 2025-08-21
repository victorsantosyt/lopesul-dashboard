import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') ?? '30', 10);

    // período opcional (últimos N dias)
    const since = new Date();
    since.setDate(since.getDate() - days);

    const frotas = await prisma.frota.findMany({
      include: {
        vendas: {
          where: { data: { gte: since } },
          select: { valor: true },
        },
        dispositivos: { select: { id: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });

    const resposta = frotas.map((f) => {
      const valorTotal = f.vendas.reduce((s, v) => s + (v.valor ?? 0), 0);
      // sem coluna "nome" no schema, usamos um rótulo amigável:
      const nome = `Frota ${f.id.slice(0, 4)}`;

      // Com o schema atual, não há como ligar SessaoAtiva -> Frota,
      // então não dá pra calcular "acessos por frota" de forma real.
      // Mantemos 0 e um status neutro.
      return {
        id: f.id,
        nome,
        valorTotal,
        acessos: 0,
        status: f.dispositivos.length > 0 ? 'desconhecido' : 'offline',
      };
    });

    return NextResponse.json(resposta, { status: 200 });
  } catch (error) {
    console.error('Erro na API /frotas:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
