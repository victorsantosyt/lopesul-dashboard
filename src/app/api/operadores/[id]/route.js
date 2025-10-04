import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PUT /api/operadores/:id
export async function PUT(req, { params }) {
  try {
    const id = String(params.id);
    const body = await req.json();

    const data = {};
    if (body.nome?.trim()) data.nome = body.nome.trim();
    if (typeof body.ativo === 'boolean') data.ativo = body.ativo;
    if (body.senha?.trim()) data.senha = await bcrypt.hash(body.senha.trim(), 10);

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    }

    const updated = await prisma.operador.update({
      where: { id },
      data,
      select: { id: true, nome: true, ativo: true, criadoEm: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('PUT /api/operadores/[id]', e);
    return NextResponse.json({ error: 'Erro ao salvar alterações.' }, { status: 500 });
  }
}

// DELETE /api/operadores/:id
export async function DELETE(_req, { params }) {
  try {
    const id = String(params.id);
    await prisma.operador.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/operadores/[id]', e);
    return NextResponse.json({ error: 'Erro ao excluir.' }, { status: 500 });
  }
}
