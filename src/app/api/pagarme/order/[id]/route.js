// src/app/api/pagarme/order/[id]/route.js
import { NextResponse } from 'next/server';
import { pagarmeGET } from '@/lib/pagarme';

export async function GET(_req, { params }) {
  try {
    const { id } = params;
    const order = await pagarmeGET(`/orders/${id}`);
    const charge = order?.charges?.[0] || null;
    const lastTx = charge?.last_transaction || {};

    return NextResponse.json({
      order_id: order?.id,
      order_status: order?.status,
      charge_id: charge?.id,
      charge_status: charge?.status,
      qr_code: lastTx?.qr_code || null,
      qr_code_url: lastTx?.qr_code_url || null,
      paid_at: lastTx?.paid_at || null,
      raw: { order },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
