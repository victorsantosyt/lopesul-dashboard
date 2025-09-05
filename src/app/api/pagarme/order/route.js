import { NextResponse } from 'next/server';
import { pagarmePOST } from '@/lib/pagarme';
import prisma from '@/lib/prisma';

// NÃO declare runtime='edge' aqui.
export async function POST(req) {
  try {
    const body = await req.json();

    // ---- Validação mínima (sem libs) ----
    const amount = Number.isFinite(+body.amount) ? Math.round(+body.amount) : 0;
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const cpf = typeof body.cpf === 'string' ? body.cpf.replace(/\D/g, '') : '';

    if (amount <= 0 || !descricao) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
    }
    // CPF/CNPJ opcional aqui, mas se vier, precisa ter 11 ou 14 dígitos
    if (cpf && !(cpf.length === 11 || cpf.length === 14)) {
      return NextResponse.json({ error: 'Documento inválido.' }, { status: 400 });
    }

    // monte o payload de order conforme seu fluxo (exemplo mínimo Pix):
    const order = {
      items: [{ amount, description: descricao, quantity: 1 }],
      customer: {
        name: nome || 'Cliente',
        email: email || undefined,
        document: cpf || undefined,
        type: 'individual',
      },
      payments: [{
        payment_method: 'pix',
        pix: { expires_in: parseInt(process.env.PIX_EXPIRES_SEC || '1800', 10) }
      }],
      metadata: {
        busId: body.busId || null,
        deviceIp: body.deviceIp || null,
        deviceMac: body.deviceMac || null,
        plano: body.plano || null,
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
        amount,
        method: 'PIX',
        status: 'PENDING',
        description: descricao || null,
        deviceMac: order.metadata.deviceMac,
        ip: order.metadata.deviceIp,
        busId: order.metadata.busId,
        customerName: nome || null,
        customerEmail: email || null,
        customerDoc: cpf || null,
        metadata: order.metadata,
        charges: {
          create: [{
            method: 'PIX',
            status: 'CREATED',
            providerId: charge?.id || null,
            qrCode: qr || null,
            qrCodeUrl: qrUrl || null,
            // mantém o raw APENAS no banco; não exponha ao cliente
            raw: created,
          }]
        }
      }
    });

    // resposta ao cliente (sem dados sensíveis / raw)
    return NextResponse.json({
      pedido_id: pedido.id,
      order_id: created.id || created.code || null,
      charge_id: charge?.id || null,
      qr_code: qr,
      qr_code_url: qrUrl,
    });
  } catch (e) {
    // Log detalhado apenas no servidor
    console.error('POST /api/pagarme/order error:', e);

    // Resposta genérica ao cliente (sem stack/message internas)
    // Se for erro do PSP com status conhecido, normalize para 400/402; senão 500
    const status = (typeof e?.status === 'number' && e.status >= 400 && e.status < 600)
      ? e.status
      : 500;

    const clientMsg = status === 400
      ? 'Falha de validação na cobrança.'
      : status === 402
        ? 'Pagamento recusado.'
        : 'Falha ao processar o pagamento.';

    return NextResponse.json({ error: clientMsg }, { status });
  }
}
