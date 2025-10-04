// src/app/api/payments/pix/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    
    const secretKey = process.env.PAGARME_SECRET_KEY;
    if (!secretKey) {
      console.error("[PIX] PAGARME_SECRET_KEY não configurada");
      throw new Error("PAGARME_SECRET_KEY não configurada");
    }
    const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');
    
    const payload = {
      items: [
        { amount: body.valor, description: body.descricao, quantity: 1 }
      ],
      customer: {
        name: body.customer.name,
        email: body.customer.email || "cliente@lopesul.com.br",
        document: body.customer.document,
        type: body.customer.document.length === 14 ? "corporation" : "individual",
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: "11",
            number: "999999999"
          }
        }
      },
      payments: [
        { payment_method: "pix", pix: { expires_in: body.expires_in ?? 1800 } }
      ]
    };
    
    const pagarmeResp = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
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
    
    if (lastTransaction.status === 'failed') {
      console.error("[PIX] Transação falhou:", lastTransaction.gateway_response);
    }
    
    return NextResponse.json({
      orderId: result.id,
      pix: lastTransaction
    });
  } catch (e) {
    console.error("[PIX] Erro:", e.message);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
