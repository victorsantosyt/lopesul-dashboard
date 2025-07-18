import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// GET – Listar dispositivos
export async function GET() {
  try {
    const dispositivos = await prisma.dispositivo.findMany();
    return NextResponse.json(dispositivos);
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao listar dispositivos.' }, { status: 500 });
  }
}

// POST – Cadastrar novo dispositivo
export async function POST(req) {
  try {
    const body = await req.json();
    const novo = await prisma.dispositivo.create({
      data: {
        tipo: body.tipo,
        ip: body.ip,
        onibusId: body.onibusId,
      },
    });
    return NextResponse.json(novo);
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao cadastrar dispositivo.' }, { status: 500 });
  }
}
