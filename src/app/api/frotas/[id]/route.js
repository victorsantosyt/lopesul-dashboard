import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

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