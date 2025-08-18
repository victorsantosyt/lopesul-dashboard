import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const dispositivos = await prisma.dispositivo.findMany();

    const atualizados = await Promise.all(
      dispositivos.map(async (dispositivo) => {
        const ip = dispositivo.ip.startsWith('http') ? dispositivo.ip : `http://${dispositivo.ip}`;

        let status = 'offline';
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);

          const res = await fetch(ip, { signal: controller.signal });
          clearTimeout(timeout);
          if (res.ok) status = 'online';
        } catch (error) {
          status = 'offline';
        }

        await prisma.dispositivo.update({
          where: { id: dispositivo.id },
          data: { status },
        });

        return { ...dispositivo, status };
      })
    );

    return NextResponse.json(atualizados);
  } catch (err) {
    console.error('Erro ao pingar dispositivos:', err);
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}
