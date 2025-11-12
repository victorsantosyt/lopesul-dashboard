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
    const valorCent = toCents(body?.valor);

    if (valorCent == null || valorCent <= 0) {
      return NextResponse.json({ error: "valor (reais) inválido" }, { status: 400 });
    }

    // --- customer/document ---
    const customerIn = body?.customer || {
      name: body?.customerName || "Cliente",
      email: body?.customerEmail || "cliente@lopesul.com.br",
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
      email: customerIn?.email || "cliente@lopesul.com.br",
      document,
    };

    // --- idempotency ---
    const orderId = body?.orderId || body?.externalId || randomUUID();

    // --- expires_in opcional ---
    const expiresIn =
      Number.isFinite(Number(body?.expiresIn))
        ? Number(body?.expiresIn)
        : Number.isFinite(Number(body?.expires_in))
        ? Number(body?.expires_in)
        : 1800; // padrão 30min

    // --- Construção da URL base (CORRIGIDO) ---
    const headers = req.headers;
    const host = headers.get('host');
    const protocol = headers.get('x-forwarded-proto') || 
                    (host && host.includes('localhost') ? 'http' : 'https');
    
    // URL base mais robusta
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const pixUrl = `${baseUrl}/api/payments/pix`;

    console.log('[CHECKOUT] URL PIX:', pixUrl); // Debug

    const upstream = await fetch(pixUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valor: body?.valor,          // VALOR EM REAIS (não centavos)
        descricao,
        customer,
        expires_in: expiresIn,
        clienteIp: body?.clienteIp ?? null,
        deviceMac: body?.clienteMac ?? null,
        metadata: { origem: "checkout-endpoint", ...(body?.metadata || {}) },
        orderId,
      }),
    });

    const j = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error("Erro PIX interno:", j);
      console.error("Status:", upstream.status);
      return NextResponse.json(
        { error: j?.error || `HTTP ${upstream.status}` },
        { status: upstream.status }
      );
    }

    // --- resposta para o frontend ---
    return NextResponse.json({
      externalId: j?.orderId || orderId,
      copiaECola: j?.pix?.qr_code || null,
      payloadPix: j?.pix?.qr_code || null,
      expiresIn: j?.pix?.expires_in ?? expiresIn,
    });
  } catch (e) {
    console.error("[CHECKOUT] Erro:", e.message || e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}