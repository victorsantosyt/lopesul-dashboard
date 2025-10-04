// src/app/api/pagamentos/checkout/route.js
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toCents = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const descricao = body?.descricao || "Acesso Wi-Fi";
    const cents = toCents(body?.valor); // REAIS → CENTAVOS
    if (cents == null || cents <= 0) {
      return NextResponse.json({ error: "valor (reais) inválido" }, { status: 400 });
    }
    if (!descricao) {
      return NextResponse.json({ error: "descricao é obrigatória" }, { status: 400 });
    }

    // --- customer/document deve vir do front (URL ou formulário) ---
    const customerIn = body?.customer || {
      name: body?.customerName || "Cliente",
      email: body?.customerEmail || undefined,
      document: body?.customerDoc,
    };
    const document = onlyDigits(customerIn?.document);
    if (!(document && (document.length === 11 || document.length === 14))) {
      return NextResponse.json(
        { error: "customer.document (CPF 11 dígitos ou CNPJ 14 dígitos) é obrigatório" },
        { status: 400 }
      );
    }
    const customer = {
      name: customerIn?.name || "Cliente",
      email: customerIn?.email || undefined,
      document, // já normalizado
    };

    // Idempotência/coerência entre /checkout e /payments/pix
    const orderId =
      body?.orderId ||
      body?.externalId ||
      randomUUID();

    // expiração opcional: aceita expiresIn ou expires_in (segundos)
    const expiresIn =
      Number.isFinite(Number(body?.expiresIn)) ? Number(body?.expiresIn)
      : Number.isFinite(Number(body?.expires_in)) ? Number(body?.expires_in)
      : undefined;

    // Encaminha para /api/payments/pix (centavos)
    // Usa a mesma origem do request para compatibilidade com desenvolvimento e produção
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? req.url 
      : "http://localhost:5000";
    const url = new URL("/api/payments/pix", baseUrl);
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,                 // garante Idempotency-Key lá
        valor: cents,            // CENTAVOS
        descricao,
        clienteIp: body?.clienteIp ?? null,
        deviceMac: body?.clienteMac ?? null,
        metadata: { origem: "checkout-endpoint", ...(body?.metadata || {}) },
        customer,                // inclui document normalizado
        ...(expiresIn ? { expires_in: expiresIn } : {}),
      }),
    });

    const j = await upstream.json().catch(() => ({}));
if (!upstream.ok) {
  console.error("Erro PIX interno:", j);   // <<< add log
  return NextResponse.json(
    { error: j?.error || `HTTP ${upstream.status}` },
    { status: upstream.status }
  );
}

    // Resposta no formato esperado pelo seu frontend
    return NextResponse.json({
      externalId: j?.orderId || orderId,
      copiaECola: j?.pix?.qr_code || null,
      payloadPix: j?.pix?.qr_code || null,
      expiresIn: j?.pix?.expires_in ?? null,
    });
  } catch (e) {
    console.error("[CHECKOUT] Erro:", e.message);
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
