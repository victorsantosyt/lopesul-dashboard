// src/app/api/payments/route.js (POST para cartão)
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createCardOrder } from "@/lib/pagarme";

export const dynamic = "force-dynamic";

const statusFromGateway = (pgChargeStatus) => {
  // Ajuste se o teu schema usar outros enums
  switch ((pgChargeStatus || "").toLowerCase()) {
    case "paid":
    case "succeeded":
      return "PAID";
    case "authorized":
      return "AUTHORIZED";
    case "pending":
    case "processing":
      return "PENDING";
    case "canceled":
      return "CANCELED";
    case "failed":
    default:
      return "FAILED";
  }
};

export async function POST(req) {
  try {
    const body = await req.json();

    // === validações mínimas ===
    const code = (body.orderId && String(body.orderId).trim()) || crypto.randomUUID();
    const amount = Number(body?.valor);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (!body?.cardToken) {
      return NextResponse.json({ error: "cardToken é obrigatório" }, { status: 400 });
    }

    // dados do cliente (opcional)
    const customer = body.customer ?? {};
    const description = body.descricao || "Acesso Wi-Fi";
    const installments = Number(body.installments || 1);

    // metadados úteis p/ Mikrotik
    const metadata = {
      ...(body.metadata || {}),
      deviceMac: body.deviceMac || null,
      ip: body.ip || null,
      busId: body.busId || null,
      origin: "card",
    };

    // === transação: cria pedido, chama gateway, grava charge ===
    const result = await prisma.$transaction(async (tx) => {
      // Idempotência por "code": se já existir, reaproveita (evita duplicar pedidos)
      const existing = await tx.pedido.findUnique({ where: { code } });

      const pedido =
        existing ??
        (await tx.pedido.create({
          data: {
            code,
            amount,
            method: "CARD",
            status: "PENDING",
            description,
            deviceMac: metadata.deviceMac,
            ip: metadata.ip,
            busId: metadata.busId,
            customerName: customer?.name || null,
            customerEmail: customer?.email || null,
            customerDoc: customer?.document || null,
            metadata,
          },
        }));

      // chamada ao PSP (usa teu helper)
      const items = [{ amount, description, quantity: 1 }];
      const pg = await createCardOrder({
        code,
        customer,
        items,
        metadata,
        cardToken: body.cardToken,
        installments,
        capture: true, // captura imediata (ajuste conforme teu fluxo)
        idempotencyKey: code, // bom passar pro PSP também
      });

      // extrai a primeira charge do gateway
      const pgCharge = pg?.charges?.[0] || null;
      const mappedStatus = statusFromGateway(pgCharge?.status || pg?.status);

      // grava/atualiza charge e pedido
      const charge = await tx.charge.upsert({
        where: { providerId: pgCharge?.id ?? `prov-${code}` }, // fallback se PSP não retornar id
        create: {
          pedidoId: pedido.id,
          providerId: pgCharge?.id || null,
          status: mappedStatus,
          method: "CARD",
          amount: amount,
          // campos extras úteis p/ debug/estorno/recorrência:
          authorizationCode: pgCharge?.last_transaction?.authorization_code || null,
          nsu: pgCharge?.last_transaction?.nsu || null,
          tid: pgCharge?.last_transaction?.tid || null,
          acquirer: pgCharge?.last_transaction?.acquirer_name || null,
          raw: pg, // manter no início; depois você pode filtrar
        },
        update: {
          status: mappedStatus,
          raw: pg,
        },
      });

      // status final do pedido
      const finalPedido = await tx.pedido.update({
        where: { id: pedido.id },
        data: { status: mappedStatus },
      });

      return { pedido: finalPedido, charge, pg };
    });

    // resposta ao front
    return NextResponse.json({
      orderId: result.pedido.code,
      status: result.pedido.status,
      chargeId: result.charge?.providerId || null,
      // se houver next actions (3DS/redirect), devolva:
      nextAction: result.pg?.next_action || result.pg?.charges?.[0]?.next_action || null,
    });
  } catch (err) {
    // se o PSP falhar, tente registrar erro no pedido (best-effort)
    try {
      const maybe = await req.json().catch(() => ({}));
      const code = (maybe.orderId && String(maybe.orderId).trim()) || null;
      if (code) {
        await prisma.pedido.update({
          where: { code },
          data: { status: "FAILED" },
        });
      }
    } catch (_) {
      // ignora
    }

    // retorno do erro
    return NextResponse.json(
      { error: "Falha ao processar pagamento", detail: String(err?.message || err) },
      { status: 400 }
    );
  }
}
