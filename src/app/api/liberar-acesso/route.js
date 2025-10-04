export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import mikrotik from "@/lib/mikrotik";
const { liberarCliente } = mikrotik;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      externalId, // agora corresponde ao code do Pedido
      pagamentoId, // id do Pedido
      txid,       // providerId da Charge
      ip,
      mac,
      linkOrig,
    } = body || {};

    if (!externalId && !pagamentoId && !txid) {
      return NextResponse.json(
        { error: "Informe externalId (code), pagamentoId ou txid." },
        { status: 400 }
      );
    }

    let pedido = null;

    // buscar pelo code (externalId)
    if (externalId) {
      pedido = await prisma.pedido.findUnique({ where: { code: externalId } });
    }

    // buscar pelo id
    if (!pedido && pagamentoId) {
      pedido = await prisma.pedido.findUnique({ where: { id: pagamentoId } });
    }

    // buscar pelo txid na tabela Charge
    if (!pedido && txid) {
      const charge = await prisma.charge.findFirst({ where: { providerId: txid } });
      if (charge) {
        pedido = await prisma.pedido.findUnique({ where: { id: charge.pedidoId } });
      }
    }

    if (!pedido) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    // atualizar status se necessário
    if (pedido.status !== "PAID") {
      await prisma.pedido.update({
        where: { id: pedido.id },
        data: { status: "PAID" },
      });
      pedido = { ...pedido, status: "PAID" };
    }

    const ipFinal  = ip  || pedido.ip  || null;
    const macFinal = mac || pedido.deviceMac || null;

    // liberar acesso via Mikrotik
    const lib = await liberarCliente({
      ip: ipFinal || undefined,
      mac: macFinal || undefined,
      comentario: `pedido:${pedido.id}`,
      timeout: process.env.MKT_TIMEOUT || "4h",
    });

    return NextResponse.json({
      ok: true,
      pedidoId: pedido.id,
      code: pedido.code,
      status: pedido.status,
      mikrotik: lib,
      redirect: linkOrig || null,
    });
  } catch (e) {
    console.error("POST /api/liberar-acesso", e);
    return NextResponse.json({ error: "Falha ao liberar acesso" }, { status: 500 });
  }
}
