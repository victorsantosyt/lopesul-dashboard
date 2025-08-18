import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const frotas = await prisma.frota.findMany();
    const vendasPorFrota = await prisma.venda.groupBy({
      by: ['frotaId'],
      _count: { id: true },
      _sum: { valor: true },
    });

    const dispositivos = await prisma.dispositivo.findMany();

    const resposta = frotas.map((frota) => {
      const vendas = vendasPorFrota.find(v => v.frotaId === frota.id);
      const dispositivosDaFrota = dispositivos.filter(d => d.frotaId === frota.id);
      const dispositivo = dispositivosDaFrota[0];

      return {
        id: frota.id,
        nome: `Bus${frota.id.slice(0, 4)}`,
        valorTotal: vendas?._sum.valor || 0,
        acessos: Math.floor(Math.random() * 30), // simulação de dispositivos conectados
        status: dispositivo ? (Math.random() < 0.8 ? 'online' : 'offline') : 'offline',
      };
    });

    return NextResponse.json(resposta);
  } catch (error) {
    console.error("Erro na API /frotas:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
