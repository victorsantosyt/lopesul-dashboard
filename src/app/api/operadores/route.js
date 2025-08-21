import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

// Força a rota a ser dinâmica (evita cache do Next em dev/prod)
export const dynamic = 'force-dynamic';

// GET /api/operadores
export async function GET() {
  try {
    const rows = await prisma.operador.findMany({
      orderBy: { criadoEm: 'desc' },
      select: { id: true, nome: true, ativo: true, criadoEm: true }, // sem senha
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /api/operadores', e);
    return NextResponse.json({ error: 'Erro ao listar operadores' }, { status: 500 });
  }
}

// POST /api/operadores
export async function POST(req) {
  try {
    const { nome, senha, ativo = true } = await req.json();
    if (!nome?.trim() || !senha?.trim()) {
      return NextResponse.json({ error: 'Nome e senha são obrigatórios.' }, { status: 400 });
    }

    const existe = await prisma.operador.findUnique({ where: { nome: nome.trim() } });
    if (existe) return NextResponse.json({ error: 'Nome já cadastrado.' }, { status: 409 });

    const hash = await bcrypt.hash(senha.trim(), 10);

    const created = await prisma.operador.create({
      data: { nome: nome.trim(), senha: hash, ativo },
      select: { id: true, nome: true, ativo: true, criadoEm: true }, // sem senha
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('POST /api/operadores', e);
    return NextResponse.json({ error: 'Erro ao criar operador' }, { status: 500 });
  }
}
