// src/app/api/pagamentos/[id]/confirmar/route.js
export const runtime = "nodejs";        // Prisma precisa de Node
export const dynamic = "force-dynamic"; // evita cache

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { liberarCliente } from "@/lib/mikrotik"; // ajuste o path se necessário

export async function POST(_req, { params }) {
  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json({ ok: false, error: "id ausente" }, { status: 400 });
    }

    // 1) Busca o pagamento
    const atual = await prisma.pagamento.findUnique({ where: { id } });
    if (!atual) {
      return NextResponse.json({ ok: false, error: "pagamento não encontrado" }, { status: 404 });
    }

    // 2) Se já estiver pago, responda OK (idempotente)
    if ((atual.status || "").toLowerCase() === "pago") {
      return NextResponse.json({
        ok: true,
        pagamento: {
          id: atual.id,
          status: "pago",
          pagoEm: atual.pagoEm,
          ip: atual.ip,
          mac: atual.mac,
        },
      });
    }

    // 3) Atualiza para pago
    const pago = await prisma.pagamento.update({
      where: { id },
      data: { status: "pago", pagoEm: new Date() },
      select: { id: true, status: true, pagoEm: true, ip: true, mac: true },
    });

    // 4) Libera no Mikrotik (não falhe a confirmação se der erro aqui)
    try {
      if (pago.ip)  await liberarCliente({ ip: pago.ip });
      if (pago.mac) await liberarCliente({ mac: pago.mac });
    } catch (e) {
      console.warn("Mikrotik/liberarCliente falhou:", e);
      // ainda retornamos ok=true pois o pagamento já foi confirmado no banco
      return NextResponse.json({
        ok: true,
        pagamento: pago,
        warning: "Pagamento confirmado, mas houve falha ao liberar no Mikrotik.",
      });
    }

    return NextResponse.json({ ok: true, pagamento: pago });
  } catch (e) {
    console.error("confirmar pagamento:", e);
    return NextResponse.json({ ok: false, error: "Falha ao confirmar" }, { status: 500 });
  }
}
