import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic"; // evita cache em edge

/**
 * Revoga sessões ativas.
 * Body (JSON) – qualquer uma das combinações:
 *  - { id: "sessaoId" }
 *  - { ip: "1.2.3.4" }
 *  - { mac: "AA:BB:CC:DD:EE:FF" }
 *  - { ip: "...", mac: "..." }
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const id  = body?.id?.toString().trim();
    const ip  = body?.ip?.toString().trim();
    const mac = body?.mac?.toString().trim();

    if (!id && !ip && !mac) {
      return NextResponse.json(
        { error: "Informe 'id' OU 'ip'/'mac' no corpo da requisição." },
        { status: 400 }
      );
    }

    // 1) Descobrir quais sessões vamos revogar
    let sessions = [];
    if (id) {
      const s = await prisma.sessaoAtiva.findUnique({ where: { id } });
      if (!s) {
        return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
      }
      sessions = [s];
    } else {
      const AND = [{ ativo: true }];
      if (ip)  AND.push({ ipCliente:  ip });
      if (mac) AND.push({ macCliente: mac });

      sessions = await prisma.sessaoAtiva.findMany({
        where: { AND },
        orderBy: { inicioEm: "desc" },
        take: 50, // segurança
        select: { id: true, ipCliente: true, macCliente: true, ativo: true },
      });
    }

    if (!sessions.length) {
      return NextResponse.json({ ok: true, revoked: 0, ids: [] }, { status: 200 });
    }

    // 2) Revogar no banco
    const ids = sessions.map((s) => s.id);
    const now = new Date();

    await prisma.sessaoAtiva.updateMany({
      where: { id: { in: ids }, ativo: true },
      data: { ativo: false, expiraEm: now },
    });

    // (Opcional) Integração com Mikrotik/Starlink para derrubar a conexão pode ser feita aqui.
    // Deixe comentado ou proteja via env para não quebrar o build:
    //
    // try {
    //   if (process.env.MIKROTIK_HOST) {
    //     const { disconnectByIpMac } = await import("@/lib/router"); // sua lib
    //     for (const s of sessions) {
    //       await disconnectByIpMac({ ip: s.ipCliente, mac: s.macCliente });
    //     }
    //   }
    // } catch (e) {
    //   console.warn("Falha ao revogar no roteador:", e);
    // }

    return NextResponse.json({ ok: true, revoked: ids.length, ids }, { status: 200 });
  } catch (e) {
    console.error("POST /api/sessoes/revogar", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
