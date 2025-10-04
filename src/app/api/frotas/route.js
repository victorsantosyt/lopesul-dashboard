import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") || "30");

    const since = new Date();
    since.setDate(since.getDate() - days);

    const frotas = await prisma.frota.findMany({
      select: {
        id: true,
        nome: true,
        criadoEm: true,
        _count: {
          select: {
            dispositivos: true,
            vendas: true,
          },
        },
        vendas: {
          where: { data: { gte: since } },
          select: { valorCent: true }, // <-- aqui!
        },
        dispositivos: {
          select: { id: true },
          take: 0,
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const rows = (frotas || []).map((f) => {
      const vendas = f.vendas || [];
      // soma centavos -> converte para reais
      const receita = vendas.reduce(
        (acc, v) => acc + (Number(v.valorCent) || 0),
        0
      ) / 100;

      return {
        id: f.id,
        nome: f.nome || "-",
        criadoEm: f.criadoEm,
        dispositivos: f._count?.dispositivos || 0,
        vendasTotal: f._count?.vendas || 0, // total histórico (count)
        vendasPeriodoQtd: vendas.length,     // no período
        vendasPeriodoReceita: receita,       // no período (R$)
      };
    });

    return NextResponse.json(rows);
  } catch (e) {
    console.error("GET /api/frotas erro:", e?.message || e);
    return NextResponse.json([], { status: 200 });
  }
}
