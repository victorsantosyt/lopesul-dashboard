import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ativas = searchParams.get("ativas") === "true";
    const limit  = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 100);

    const where = {};
    if (ativas) where.ativo = true;

    const items = await prisma.sessaoAtiva.findMany({
      where,
      orderBy: { inicioEm: "desc" },
      take: limit,
      select: {
        id: true,
        ipCliente: true,
        macCliente: true,
        inicioEm: true,
        expiraEm: true,
        ativo: true,
      },
    });

    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/sessoes", e);
    return NextResponse.json({ error: "Erro ao listar sessões" }, { status: 500 });
  }
}
