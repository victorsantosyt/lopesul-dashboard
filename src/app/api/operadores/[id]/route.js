import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ PUT /api/operadores/[id]
export async function PUT(req, ctx) {
  try {
    const { params } = await ctx; // 👈 obrigatório no Next 15

    if (!params?.id) {
      return NextResponse.json({ error: 'ID do operador é obrigatório.' }, { status: 400 });
    }

    const id = String(params.id).trim();
    const body = await req.json().catch(() => ({}));
    const data = {};

    if (body.nome?.trim()) data.nome = body.nome.trim();
    if (typeof body.ativo === 'boolean') data.ativo = body.ativo;
    if (body.senha?.trim()) {
      data.senha = await bcrypt.hash(body.senha.trim(), 10);
    }

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    }

    const operador = await prisma.operador.findUnique({ where: { id } });
    if (!operador) {
      return NextResponse.json({ error: 'Operador não encontrado.' }, { status: 404 });
    }

    const updated = await prisma.operador.update({
      where: { id },
      data,
      select: { id: true, nome: true, ativo: true, criadoEm: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error('PUT /api/operadores/[id] =>', err);
    return NextResponse.json({ error: 'Erro ao atualizar operador.' }, { status: 500 });
  }
}

// ✅ DELETE /api/operadores/[id]
export async function DELETE(_req, ctx) {
  try {
    const { params } = await ctx; // 👈 idem aqui

    if (!params?.id) {
      return NextResponse.json({ error: 'ID do operador é obrigatório.' }, { status: 400 });
    }

    const id = String(params.id).trim();
    const existe = await prisma.operador.findUnique({ where: { id } });

    if (!existe) {
      return NextResponse.json({ error: 'Operador não encontrado.' }, { status: 404 });
    }

    await prisma.operador.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: 'Operador excluído com sucesso.' });
  } catch (err) {
    console.error('DELETE /api/operadores/[id] =>', err);
    return NextResponse.json({ error: 'Erro ao excluir operador.' }, { status: 500 });
  }
}
