// src/app/api/payments/pix/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { findDeviceRecord } from "@/lib/device-router";

const toCents = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // --- validação de valor ---
    const amountInCents = toCents(body.valor);
    if (!amountInCents || amountInCents < 1) {
      return NextResponse.json({ error: "valor inválido" }, { status: 400 });
    }

    const descricao = body.descricao || "Acesso Wi-Fi";
    const sanitizeId = (value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (!trimmed || /^\$\(.+\)$/.test(trimmed)) return null;
      return trimmed;
    };
    const deviceIdRaw =
      sanitizeId(body.deviceId) ||
      sanitizeId(body.dispositivoId) ||
      sanitizeId(body.device);
    const mikIdRaw =
      sanitizeId(body.mikId) ||
      sanitizeId(body.mikID) ||
      sanitizeId(body.mikrotikId) ||
      sanitizeId(body.routerId);

    if (!deviceIdRaw && !mikIdRaw) {
      return NextResponse.json(
        { error: "deviceId ou mikId são obrigatórios para identificar o Mikrotik." },
        { status: 400 }
      );
    }

    const deviceRecord = await findDeviceRecord({ deviceId: deviceIdRaw, mikId: mikIdRaw });
    if (!deviceRecord) {
      return NextResponse.json(
        { error: "Dispositivo não encontrado para o identificador informado." },
        { status: 404 }
      );
    }

    // --- validação do cliente ---
    const customerIn = body.customer || {
      name: body.customerName || "Cliente",
      email: body.customerEmail || "cliente@lopesul.com.br",
      document: body.customerDoc,
    };

    const document = onlyDigits(customerIn.document);
    if (!(document && (document.length === 11 || document.length === 14))) {
      return NextResponse.json(
        {
          error: "customer.document (CPF 11 dígitos ou CNPJ 14 dígitos) é obrigatório"
        },
        { status: 400 }
      );
    }

    const customer = {
      name: customerIn.name || "Cliente",
      email: customerIn.email || "cliente@lopesul.com.br",
      document,
      type: document.length === 14 ? "corporation" : "individual",
      phones: {
        mobile_phone: {
          country_code: "55",
          area_code: "11",
          number: "999999999"
        }
      }
    };

    // --- chave secreta Pagar.me ---
    const secretKeyRaw = process.env.PAGARME_SECRET_KEY;
    const secretKey = typeof secretKeyRaw === 'string' ? secretKeyRaw.trim() : '';
    if (!secretKey) {
      console.error("[PIX] PAGARME_SECRET_KEY não configurada");
      return NextResponse.json({ error: "PAGARME_SECRET_KEY não configurada" }, { status: 500 });
    }
    const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");

    // --- payload para a API Pagar.me ---
    const payload = {
      items: [
        { amount: amountInCents, description: descricao, quantity: 1 }
      ],
      customer,
      payments: [
        { payment_method: "pix", pix: { expires_in: body.expires_in ?? 1800 } }
      ]
    };

    const pagarmeResp = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await pagarmeResp.json().catch(() => ({}));

    if (!pagarmeResp.ok) {
      console.error("[PIX] Erro da API Pagar.me:", result);
      return NextResponse.json(
        { error: result?.message || "Erro ao criar Pix", detail: result },
        { status: pagarmeResp.status }
      );
    }

    const lastTransaction = result.charges?.[0]?.last_transaction || {};

    // Normaliza campos de QR Code (Pagar.me varia entre qr_code, qr_code_emv, qr_code_text, emv, payload)
    const qrText =
      lastTransaction?.qr_code ||
      lastTransaction?.qr_code_emv ||
      lastTransaction?.qr_code_text ||
      lastTransaction?.emv ||
      lastTransaction?.payload ||
      null;

    if (lastTransaction.status === "failed") {
      console.error("[PIX] Transação falhou:", lastTransaction.gateway_response);
    }

    // Garante que pix.qr_code exista para os consumidores atuais
    const pixOut = { ...lastTransaction };
    if (!pixOut.qr_code && qrText) pixOut.qr_code = qrText;

    // --- Salva o pagamento no banco de dados ---
    try {
      // IMPORTANTE: Pagar.me retorna tanto 'id' (or_xxx) quanto 'code' (ABCDEF123)
      // Webhook pode enviar qualquer um dos dois, então salvamos o CODE no campo code
      const pedidoData = {
        code: result.code || result.id, // Usa CODE se existir, senão ID
        amount: amountInCents,
        method: "PIX",
        status: "PENDING",
        description: descricao,
        customerName: customer.name,
        customerEmail: customer.email,
        customerDoc: customer.document,
      metadata: {
        pagarmeOrderId: result.id,
        pagarmeOrderCode: result.code,
        deviceId: deviceRecord.id,
        mikId: deviceRecord.mikId ?? mikIdRaw ?? null,
      }
      };

      // Adiciona IP e MAC somente se forem válidos
      if (body.clienteIp && typeof body.clienteIp === 'string') {
        pedidoData.ip = body.clienteIp.trim();
      }
      if (body.deviceMac && typeof body.deviceMac === 'string') {
        pedidoData.deviceMac = body.deviceMac.trim().toUpperCase();
      }

      pedidoData.deviceId = deviceRecord.id;
      pedidoData.deviceIdentifier = deviceRecord.mikId || mikIdRaw || deviceIdRaw;

      console.log("[PIX] Saving to DB:", { code: result.id, ip: pedidoData.ip, mac: pedidoData.deviceMac });

      const savedPedido = await prisma.pedido.create({ data: pedidoData });
      console.log("[PIX] Saved payment to database:", result.id);
      console.log("[PIX] Saved data verification:", { ip: savedPedido.ip, mac: savedPedido.deviceMac });
    } catch (dbError) {
      console.error("[PIX] Error saving to database:", dbError);
      console.error("[PIX] Full error:", JSON.stringify(dbError, null, 2));
    }

    return NextResponse.json({
      orderId: result.id,
      pix: pixOut
    });
  } catch (e) {
    console.error("[PIX] Erro:", e.message || e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
