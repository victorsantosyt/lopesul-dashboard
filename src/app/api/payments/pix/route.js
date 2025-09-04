// src/app/api/payments/pix/route.js
import { NextResponse } from "next/server";
import { pagarmePOST } from "@/lib/pagarme";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- helpers ----
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

function extractPix(order) {
  const charge = order?.charges?.[0] || null;
  const trx = charge?.last_transaction || charge?.transaction || null;

  const emv =
    trx?.qr_code_emv ||
    trx?.qr_code_text ||
    trx?.qr_code ||
    trx?.emv ||
    trx?.payload ||
    null;

  const url = trx?.qr_code_url || trx?.qrcode || null;
  const expires_in = trx?.expires_in ?? null;
  return { emv, url, expires_in, trx };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // ⚠️ aqui "valor" é em CENTAVOS (checkout converte de reais → centavos)
    const amount = Number(body?.valor);
    const description = body?.descricao || "Acesso Wi-Fi";
    const customerIn = body?.customer || {};

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "valor (centavos) inválido" }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "descricao é obrigatória" }, { status: 400 });
    }

    // —— customer/document obrigatório ——
    const rawDoc = customerIn.document || body?.customerDoc;
    const document = onlyDigits(rawDoc);
    if (!(document && (document.length === 11 || document.length === 14))) {
      return NextResponse.json(
        { error: "customer.document (CPF 11 dígitos ou CNPJ 14 dígitos) é obrigatório" },
        { status: 400 }
      );
    }
    const customerType = document.length === 14 ? "company" : "individual";

    // opcional: email e nome
    const customerName = customerIn.name || body?.customerName || "Cliente";
    const customerEmail = customerIn.email || body?.customerEmail || undefined;

    // monta objeto customer no formato do Pagar.me v5
    const customer = {
      name: customerName,
      email: customerEmail,
      document,
      type: customerType,
      // phones é opcional; só envie se tiver certeza do formato.
      // Ex.: phones: { mobile_phone: { country_code: "55", area_code: "11", number: "999999999" } }
    };

    const code = String(body?.orderId || randomUUID());
    const expiresIn = Number.isFinite(Number(body?.expires_in)) ? Number(body.expires_in) : 1800;

    const payload = {
      code,
      amount,               // opcional no Pagar.me; usamos por compat com alguns setups
      currency: "BRL",
      items: [{ amount, description, quantity: 1 }],
      customer,
      payments: [{ payment_method: "pix", pix: { expires_in: expiresIn } }],
      metadata: {
        ...(body?.metadata || {}),
        origin: "pix",
        deviceMac: body?.deviceMac ?? body?.mac ?? null,
        ip: body?.ip ?? body?.clienteIp ?? null,
        busId: body?.busId ?? null,
      },
    };

    // Sua lib já aponta para https://api.pagar.me/core/v5 => aqui usamos apenas "/orders"
    const resp = await pagarmePOST("/orders", payload, {
      headers: { "Idempotency-Key": code },
    });
    const order = resp?.data ?? resp;

    const { emv, url, expires_in, trx } = extractPix(order);
    if (!emv) {
      const gwErr = trx?.gateway_response?.errors?.[0]?.message;
      return NextResponse.json({ error: gwErr || "Falha ao gerar QR" }, { status: 400 });
    }

    return NextResponse.json({
      orderId: order?.code || code, // referência (externalId) que o front usa
      pix: {
        qr_code: emv,               // EMV "copia-e-cola" para o QR
        qr_code_url: url,           // imagem pronta (se vier)
        expires_in,                 // segundos
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Falha ao criar Pix", detail: String(e?.message || e) },
      { status: 400 }
    );
  }
}
