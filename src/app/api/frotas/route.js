// src/app/api/frotas/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkAnyOnline } from "@/lib/netcheck";

// força Node.js (precisamos de net/ping)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") || "30");

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Puxa IPs dos dispositivos para medir status.
    // Se o campo NÃO for "ip", troque abaixo para o nome real do seu schema:
    // ex.: select: { enderecoIp: true } e ajuste o map(d => d.enderecoIp)
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
          where: { data: { gte: since } }, // ajuste se seu campo de data for createdAt
          select: { valorCent: true },     // ajuste se for "valor" em reais
        },
        dispositivos: {
          select: { ip: true }, // <<-- TROQUE AQUI se o campo for outro nome
          take: 100,            // segurança: limita consulta
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    // Calcula receita + status em paralelo
    const rows = await Promise.all(
      (frotas ?? []).map(async (f) => {
        const receitaCentavos = (f.vendas ?? []).reduce(
          (acc, v) => acc + (Number(v?.valorCent) || 0),
          0
        );

        const ips = (f.dispositivos ?? []).map((d) => d?.ip).filter(Boolean); // <<-- ajuste se renomear o campo
        let status = "desconhecido";
        if (ips.length > 0) {
          const { online } = await checkAnyOnline(ips);
          status = online ? "online" : "offline";
        }

        return {
          id: f.id,
          nome: f.nome ?? "-",
          criadoEm: f.criadoEm,

          acessos: Number(f._count?.dispositivos ?? 0),
          valorTotal: Number(receitaCentavos / 100),
          valorTotalCentavos: Number(receitaCentavos),

          status,

          // extras informativos
          vendasTotal: Number(f._count?.vendas ?? 0),
          vendasPeriodoQtd: (f.vendas ?? []).length,
          periodoDias: days,
        };
      })
    );

    return NextResponse.json(rows, { status: 200 });
  } catch (e) {
    console.error("GET /api/frotas erro:", e?.message || e);
    return NextResponse.json([], { status: 200 });
  }
}
