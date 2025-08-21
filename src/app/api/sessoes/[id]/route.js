import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(_req, { params }) {
  try {
    const id = String(params.id);
    const now = new Date();

    const sessao = await prisma.sessaoAtiva.findUnique({ where: { id } });
    if (!sessao) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    await prisma.sessaoAtiva.update({
      where: { id },
      data: { ativo: false, expiraEm: now },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/sessoes/[id]", e);
    return NextResponse.json({ error: "Erro ao encerrar sessão" }, { status: 500 });
  }
}