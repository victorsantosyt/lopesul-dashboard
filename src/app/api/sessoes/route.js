import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ativas = searchParams.get("ativas") === "true";
    const limit  = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);

    const fromStr = searchParams.get("from");
    const toStr   = searchParams.get("to");

    const where = {};
    if (ativas) where.ativo = true;

    // Filtro por período (inicioEm dentro do range)
    const AND = [];
    if (fromStr) {
      const from = new Date(`${fromStr}T00:00:00.000Z`);
      AND.push({ inicioEm: { gte: from } });
    }
    if (toStr) {
      const to = new Date(`${toStr}T23:59:59.999Z`);
      AND.push({ inicioEm: { lte: to } });
    }
    if (AND.length) where.AND = AND;

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
        plano: true,
      },
    });

    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/sessoes", e);
    return NextResponse.json({ error: "Erro ao listar sessões" }, { status: 500 });
  }
}