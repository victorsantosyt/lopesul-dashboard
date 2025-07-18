import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { usuario, senha } = await req.json();

    const operador = await prisma.operador.findUnique({
      where: { usuario },
    });

    if (!operador || !(await bcrypt.compare(senha, operador.senha))) {
      return NextResponse.json({ error: 'Usuário ou senha inválidos' }, { status: 401 });
    }

    return NextResponse.json({
      id: operador.id,
      usuario: operador.usuario,
      status: 200,
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json({ error: 'Erro interno no login' }, { status: 500 });
  }
}
