// src/app/api/operadores/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const rows = await prisma.operador.findMany({
    orderBy: { criadoEm: 'desc' },
    select: { id: true, usuario: true, criadoEm: true }, // sem senha
  });
  return NextResponse.json(rows);
}

export async function POST(req) {
  try {
    const { nome, usuario, senha } = await req.json();
    const u = (usuario || nome || '').trim();
    if (!u || !senha) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    const exists = await prisma.operador.findUnique({ where: { usuario: u } });
    if (exists) return NextResponse.json({ error: 'Usuário já existe.' }, { status: 409 });

    const hash = await bcrypt.hash(senha, 10);
    const op = await prisma.operador.create({
      data: { usuario: u, senha: hash },
      select: { id: true, usuario: true, criadoEm: true },
    });
    return NextResponse.json(op, { status: 201 });
  } catch (e) {
    console.error('POST /api/operadores', e);
    return NextResponse.json({ error: 'Erro ao criar operador' }, { status: 500 });
  }
}
