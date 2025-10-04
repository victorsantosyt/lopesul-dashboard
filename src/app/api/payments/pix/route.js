// src/app/api/payments/pix/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const pagarmeResp = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${process.env.BASIC}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [
          { amount: body.valor, description: body.descricao, quantity: 1 }
        ],
        customer: {
          name: body.customer.name,
          email: body.customer.email,
          document: body.customer.document,
          type: body.customer.document.length === 14 ? "corporation" : "individual"
        },
        payments: [
          { payment_method: "pix", pix: { expires_in: body.expires_in ?? 1800 } }
        ]
      })
    });

    const result = await pagarmeResp.json();
    if (!pagarmeResp.ok) throw new Error(result.error || `HTTP ${pagarmeResp.status}`);
    return NextResponse.json({
      orderId: result.id,
      pix: result.charges[0].last_transaction
    });
  } catch (e) {
    console.error("Erro Pagar.me:", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
