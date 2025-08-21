import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit  = Math.min(Math.max(Number(searchParams.get("limit") || 10), 1), 50);
    const status = searchParams.get("status"); // ex: "pago"

    const where = {};
    if (status) where.status = status;

    const items = await prisma.pagamento.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: limit,
      select: {
        id: true,
        criadoEm: true,
        valor: true,
        descricao: true,
        plano: true,
        status: true,
      },
    });

    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/pagamentos", e);
    return NextResponse.json({ error: "Erro ao listar pagamentos" }, { status: 500 });
  }
}
