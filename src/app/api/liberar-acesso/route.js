export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
// ajuste: importa default e desestrutura
import mikrotik from "@/lib/mikrotik";
const { liberarCliente } = mikrotik;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      externalId,
      pagamentoId,
      txid,
      ip,
      mac,
      linkOrig,
    } = body || {};

    if (!externalId && !pagamentoId && !txid) {
      return NextResponse.json(
        { error: "Informe externalId, pagamentoId ou txid." },
        { status: 400 }
      );
    }

    let pagamento = null;

    if (externalId) {
      pagamento = await prisma.pagamento.findUnique({ where: { externalId } });
    }
    if (!pagamento && pagamentoId) {
      pagamento = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
    }
    if (!pagamento && txid) {
      pagamento = await prisma.pagamento.findFirst({ where: { txid } });
    }

    if (!pagamento) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    if (pagamento.status !== "pago") {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: "pago" },
      });
      pagamento = { ...pagamento, status: "pago" };
    }

    const ipFinal  = ip  || pagamento.clienteIp  || null;
    const macFinal = mac || pagamento.clienteMac || null;

    const lib = await liberarCliente({
      ip: ipFinal || undefined,
      mac: macFinal || undefined,
      comentario: `pagamento:${pagamento.id}`,
      timeout: process.env.MKT_TIMEOUT || "4h",
    });

    return NextResponse.json({
      ok: true,
      pagamentoId: pagamento.id,
      externalId: pagamento.externalId,
      status: "pago",
      mikrotik: lib,
      redirect: linkOrig || null,
    });
  } catch (e) {
    console.error("POST /api/liberar-acesso", e);
    return NextResponse.json({ error: "Falha ao liberar acesso" }, { status: 500 });
  }
}
