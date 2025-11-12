// src/app/api/payments/pix/route.js
import { NextResponse } from "next/server";

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
    const secretKey = process.env.PAGARME_SECRET_KEY;
    if (!secretKey) {
      console.error("[PIX] PAGARME_SECRET_KEY não configurada");
      throw new Error("PAGARME_SECRET_KEY não configurada");
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

    const result = await pagarmeResp.json();

    if (!pagarmeResp.ok) {
      console.error("[PIX] Erro da API Pagar.me:", result);
      throw new Error(JSON.stringify(result) || `HTTP ${pagarmeResp.status}`);
    }

    const lastTransaction = result.charges?.[0]?.last_transaction || {};

    if (lastTransaction.status === "failed") {
      console.error("[PIX] Transação falhou:", lastTransaction.gateway_response);
    }

    return NextResponse.json({
      orderId: result.id,
      pix: lastTransaction
    });
  } catch (e) {
    console.error("[PIX] Erro:", e.message || e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
