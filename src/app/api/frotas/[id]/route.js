import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const frotas = await prisma.frota.findMany({
      orderBy: { criadoEm: 'desc' } // <- nome correto
    });

    return NextResponse.json(frotas);
  } catch (error) {
    console.error('Erro ao buscar frotas:', error);
    return NextResponse.json({ error: 'Erro ao buscar frotas' }, { status: 500 });
  }
}