import { NextResponse } from 'next/server';
import { pagarmePOST } from '@/lib/pagarme';
import prisma from '@/lib/prisma';

// NÃO declare runtime='edge' aqui.
export async function POST(req) {
  try {
    const body = await req.json();

    // monte o payload de order conforme seu fluxo (exemplo mínimo Pix):
    const order = {
      items: [{ amount: body.amount, description: body.descricao, quantity: 1 }],
      customer: {
        name: body.nome,
        email: body.email,
        document: body.cpf,
        type: 'individual',
      },
      payments: [{
        payment_method: 'pix',
        pix: { expires_in: parseInt(process.env.PIX_EXPIRES_SEC || '1800', 10) }
      }],
      metadata: {
        busId: body.busId,
        deviceIp: body.deviceIp,
        deviceMac: body.deviceMac,
        plano: body.plano,
      },
    };

    const created = await pagarmePOST('/orders', order);

    // pegue charge/qr_code conforme retorno real da API v5:
    const charge = created?.charges?.[0] || null;
    const qr = charge?.last_transaction?.qr_code || null;
    const qrUrl = charge?.last_transaction?.qr_code_url || null;

    // persista no seu banco
    const pedido = await prisma.pedido.create({
      data: {
        code: created.code || created.id || created.order_id || '',
        amount: body.amount,
        method: 'PIX',
        status: 'PENDING',
        description: body.descricao || null,
        deviceMac: body.deviceMac || null,
        ip: body.deviceIp || null,
        busId: body.busId || null,
        customerName: body.nome || null,
        customerEmail: body.email || null,
        customerDoc: body.cpf || null,
        metadata: order.metadata,
        charges: {
          create: [{
            method: 'PIX',
            status: 'CREATED',
            providerId: charge?.id || null,
            qrCode: qr || null,
            qrCodeUrl: qrUrl || null,
            raw: created,
          }]
        }
      }
    });

    return NextResponse.json({
      pedido_id: pedido.id,
      order_id: created.id || created.code,
      charge_id: charge?.id || null,
      qr_code: qr,
      qr_code_url: qrUrl,
      raw: created,
    });
  } catch (e) {
    // se veio da lib, trará e.status e e.data
    console.error('POST /api/pagarme/order error:', e.status, e.data || e.message);
    const msg = e.data ? JSON.stringify(e.data) : e.message;
    return NextResponse.json({ error: `Pagar.me POST /orders ${e.status || ''}: ${msg}` }, { status: e.status || 500 });
  }
}
