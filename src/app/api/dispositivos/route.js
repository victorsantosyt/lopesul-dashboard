import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// Cadastrar novo Mikrotik (POST)
export async function POST(req) {
  try {
    const body = await req.json();
    const { ip, frotaId } = body;

    if (!ip || !frotaId) {
      return NextResponse.json({ error: 'IP e frota são obrigatórios' }, { status: 400 });
    }

    const dispositivo = await prisma.dispositivo.create({
      data: {
        ip,
        frotaId,
      },
    });

    return NextResponse.json(dispositivo);
  } catch (error) {
    console.error('Erro ao cadastrar dispositivo:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Buscar todos os dispositivos (GET)
export async function GET() {
  try {
    const dispositivos = await prisma.dispositivo.findMany({
      include: { frota: true },
    });

    return NextResponse.json(dispositivos);
  } catch (error) {
    console.error('Erro ao buscar dispositivos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
