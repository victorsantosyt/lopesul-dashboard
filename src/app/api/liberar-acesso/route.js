// src/app/api/liberar-acesso/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { liberarCliente } from "@/lib/mikrotik";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // aceita múltiplas formas de identificar o pagamento
    const {
      externalId,     // referência do PSP (preferido no fluxo novo)
      pagamentoId,    // id interno (cuid/uuid) – opcional
      txid,           // txid Pix – opcional
      ip,             // pode sobrescrever IP salvo
      mac,            // pode sobrescrever MAC salvo
      linkOrig,       // para redirecionar o cliente depois
    } = body || {};

    if (!externalId && !pagamentoId && !txid) {
      return NextResponse.json(
        { error: "Informe externalId, pagamentoId ou txid." },
        { status: 400 }
      );
    }

    // 1) localizar o pagamento pela melhor chave disponível
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

    // 2) se ainda não está marcado como pago, marque agora
    if (pagamento.status !== "pago") {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: "pago" },
      });
      // recarrega apenas o necessário
      pagamento = { ...pagamento, status: "pago" };
    }

    // 3) define IP/MAC finais (body tem prioridade; depois registro)
    const ipFinal  = ip  || pagamento.clienteIp  || null;
    const macFinal = mac || pagamento.clienteMac || null;

    // 4) chama a lib do Mikrotik (address-list / PPPoE – conforme sua implementação)
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
