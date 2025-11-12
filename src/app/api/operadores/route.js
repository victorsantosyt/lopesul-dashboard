import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ GET /api/operadores → lista operadores sem expor senha
export async function GET(_req, _ctx) {
  try {
    const operadores = await prisma.operador.findMany({
      orderBy: { criadoEm: 'desc' },
      select: { id: true, nome: true, ativo: true, criadoEm: true },
    });

    return NextResponse.json(operadores);
  } catch (err) {
    console.error('GET /api/operadores =>', err);
    return NextResponse.json(
      { error: 'Erro ao listar operadores.' },
      { status: 500 }
    );
  }
}

// ✅ POST /api/operadores → cria operador com validação e bcrypt
export async function POST(req, _ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    const { nome, senha, ativo = true } = body;

    if (!nome?.trim() || !senha?.trim()) {
      return NextResponse.json(
        { error: 'Nome e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const existe = await prisma.operador.findUnique({
      where: { nome: nome.trim() },
    });
    if (existe) {
      return NextResponse.json(
        { error: 'Nome já cadastrado.' },
        { status: 409 }
      );
    }

    const senhaHash = await bcrypt.hash(senha.trim(), 10);

    const novo = await prisma.operador.create({
      data: { nome: nome.trim(), senha: senhaHash, ativo },
      select: { id: true, nome: true, ativo: true, criadoEm: true },
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (err) {
    console.error('POST /api/operadores =>', err);
    return NextResponse.json(
      { error: 'Erro ao criar operador.' },
      { status: 500 }
    );
  }
}
