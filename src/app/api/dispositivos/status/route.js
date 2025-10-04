import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import ping from 'ping';

import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const dispositivos = await prisma.dispositivo.findMany({
      include: { frota: true },
    });

    const resultados = await Promise.all(
      dispositivos.map(async (d) => {
        const res = await ping.promise.probe(d.ip, { timeout: 2 });
        return {
          id: d.id,
          ip: d.ip,
          frota: d.frota?.nome || d.frotaId,
          status: res.alive ? 'online' : 'offline',
        };
      })
    );

    return NextResponse.json(resultados);
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
