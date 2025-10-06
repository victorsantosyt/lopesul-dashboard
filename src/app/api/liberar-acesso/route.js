// src/app/api/liberar-acesso/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import mikrotik from "@/lib/mikrotik";
const { liberarCliente } = mikrotik;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { externalId, pagamentoId, txid, ip, mac, linkOrig } = body || {};

    if (!externalId && !pagamentoId && !txid) {
      return NextResponse.json(
        { error: "Informe externalId (code), pagamentoId ou txid." },
        { status: 400 }
      );
    }

    let pedido = null;

    // busca por code
    if (externalId) {
      pedido = await prisma.pedido.findUnique({ where: { code: externalId } });
    }

    // busca por id
    if (!pedido && pagamentoId) {
      pedido = await prisma.pedido.findUnique({ where: { id: pagamentoId } });
    }

    // busca por txid (via tabela charge)
    if (!pedido && txid) {
      const charge = await prisma.charge.findFirst({ where: { providerId: txid } });
      if (charge) {
        pedido = await prisma.pedido.findUnique({ where: { id: charge.pedidoId } });
      }
    }

    if (!pedido) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    // atualiza status para PAID, se necessário
    if (pedido.status !== "PAID") {
      pedido = await prisma.pedido.update({
        where: { id: pedido.id },
        data: { status: "PAID" },
      });
    }

    const ipFinal = ip || pedido.ip || null;
    const macFinal = mac || pedido.deviceMac || null;

    // 🔥 liberar via Mikrotik (usa SSH por padrão)
    const lib = await liberarCliente({
      ip: ipFinal || undefined,
      mac: macFinal || undefined,
      comment: `pedido:${pedido.id}`, // <- campo correto
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
    console.error("POST /api/liberar-acesso error:", e);
    return NextResponse.json({ error: "Falha ao liberar acesso" }, { status: 500 });
  }
}
