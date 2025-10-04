// src/app/api/dispositivos/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// LISTAR
export async function GET() {
  try {
    const dispositivos = await prisma.dispositivo.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        // Seu schema de Frota não tem "nome", então só retornamos o id.
        frota: { select: { id: true } },
      },
    });
    return NextResponse.json(dispositivos);
  } catch (e) {
    console.error('GET /api/dispositivos', e);
    return NextResponse.json({ error: 'Erro ao listar dispositivos' }, { status: 500 });
  }
}

// CRIAR (opcional)
export async function POST(req) {
  try {
    const { ip, frotaId } = await req.json();
    if (!ip || !frotaId) {
      return NextResponse.json({ error: 'ip e frotaId são obrigatórios.' }, { status: 400 });
    }
    const created = await prisma.dispositivo.create({
      data: { ip, frotaId },
      include: { frota: { select: { id: true } } },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('POST /api/dispositivos', e);
    return NextResponse.json({ error: 'Erro ao criar dispositivo' }, { status: 500 });
  }
}
