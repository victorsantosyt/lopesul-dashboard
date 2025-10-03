export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// src/app/api/revogar-acesso/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revogarCliente } from "@/lib/mikrotik";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      externalId,   // ref do PSP
      pagamentoId,  // id interno do pagamento
      txid,         // txid Pix (opcional)
      ip,           // opcional: força IP
      mac,          // opcional: força MAC
      statusFinal,  // opcional: "expirado" | "cancelado"
    } = body || {};

    if (!externalId && !pagamentoId && !txid && !ip && !mac) {
      return NextResponse.json(
        { error: "Informe externalId, pagamentoId, txid, ip ou mac." },
        { status: 400 }
      );
    }

    // 1) localizar pagamento (se houver chave)
    let pg = null;
    if (externalId) {
      pg = await prisma.pagamento.findUnique({ where: { externalId } });
    }
    if (!pg && pagamentoId) {
      pg = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
    }
    if (!pg && txid) {
      pg = await prisma.pagamento.findFirst({ where: { txid } });
    }

    // 2) determinar IP/MAC finais
    const ipFinal  = ip  || pg?.clienteIp  || null;
    const macFinal = mac || pg?.clienteMac || null;

    if (!ipFinal && !macFinal) {
      return NextResponse.json({ error: "IP/MAC não fornecidos e não encontrados." }, { status: 400 });
    }

    // 3) remover no Mikrotik (resolverá IP via MAC se preciso)
    const rm = await revogarCliente({ ip: ipFinal || undefined, mac: macFinal || undefined });

    // 4) marcar pagamento como expirado/cancelado (se localizamos pg)
    if (pg) {
      const novoStatus = statusFinal === "cancelado" ? "cancelado" : "expirado";
      await prisma.pagamento.update({
        where: { id: pg.id },
        data: { status: novoStatus },
      });

      // 5) encerrar sessões ativas associadas
      try {
        await prisma.sessaoAtiva.updateMany({
          where: { pagamentoId: pg.id, ativo: true },
          data: { ativo: false, expiraEm: new Date() },
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      mikrotik: rm,
      pagamentoId: pg?.id || null,
      externalId: pg?.externalId || externalId || null,
    });
  } catch (e) {
    console.error("POST /api/revogar-acesso", e);
    return NextResponse.json({ error: "Falha ao revogar" }, { status: 500 });
  }
}
