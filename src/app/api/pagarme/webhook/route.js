// src/app/api/pagarme/webhook/route.js
import { NextResponse } from 'next/server';
import { pagarmeGET } from '@/lib/pagarme';
import prisma from '@/lib/prisma';
import { mapChargeStatusToEnum, mapOrderStatusToPaymentEnum } from '@/lib/payments-map';
// import { liberarAcesso } from '@/lib/mikrotik'; // quando quiser liberar de fato

function validaAssinaturaOpcional() {
  // implemente HMAC quando configurar no dashboard
  return true;
}

async function logWebhook({ event, orderCode, payload }) {
  try {
    await prisma.webhookLog.create({
      data: { event, orderCode: orderCode || null, payload },
    });
  } catch { /* evita quebrar fluxo por log */ }
}

async function onPaid({ orderId, chargeId, metadata = {} }) {
  // Atualiza Pedido e Charge idempotente
  await prisma.$transaction(async (tx) => {
    // Pedido por code=orderId
    const pedido = await tx.pedido.findUnique({ where: { code: orderId } });

    if (pedido && pedido.status !== 'PAID') {
      await tx.pedido.update({
        where: { id: pedido.id },
        data: { status: 'PAID' },
      });
    }

    if (chargeId) {
      const ch = await tx.charge.findFirst({ where: { providerId: chargeId } });
      if (ch && ch.status !== 'PAID') {
        await tx.charge.update({
          where: { id: ch.id },
          data: { status: 'PAID' },
        });
      }
    }
  });

  // Libera no Mikrotik (se quiser agora)
  const { deviceIp, busId } = metadata || {};
if (deviceIp) {
  try {
    await liberarAcesso({ ip: deviceIp, busId });
  } catch (e) {
    // logue erro mas não quebre o webhook
    console.error('Erro ao liberar no Mikrotik:', e?.message || e);
  }
}

  // (Opcional) criar/atualizar SessaoAtiva vinculada ao Pedido:
  // - procura pelo Pedido via code=orderId
  const pedido = await prisma.pedido.findUnique({ where: { code: orderId } });
  if (pedido?.ip) {
    // upsert por ipCliente
    await prisma.sessaoAtiva.upsert({
      where: { ipCliente: pedido.ip },
      create: {
        ipCliente: pedido.ip,
        macCliente: pedido.deviceMac || null,
        plano: (metadata?.plano || 'PIX'),
        inicioEm: new Date(),
        expiraEm: new Date(Date.now() + 2 * 60 * 60 * 1000), // exemplo: +2h
        ativo: true,
        pedidoId: pedido.id,
      },
      update: {
        ativo: true,
        expiraEm: new Date(Date.now() + 2 * 60 * 60 * 1000),
        pedidoId: pedido.id,
      },
    });
  }
}

export async function POST(req) {
  const raw = await req.text();
  if (!validaAssinaturaOpcional(req, raw)) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  }

  try {
    const evt = JSON.parse(raw || '{}');
    const type = evt?.type || evt?.event || '';
    const data = evt?.data || {};

    // charge.paid
    if (type === 'charge.paid') {
      const chargeId = data?.id || null;
      const orderId  = data?.order_id || data?.order?.id || null;

      // Busca pedido completo para pegar metadata e status
      let order = null; let metadata = {};
      if (orderId) {
        try {
          order = await pagarmeGET(`/orders/${orderId}`);
          metadata = order?.metadata || {};
        } catch {}
      }

      // Atualiza DB com os status atuais do Pagar.me (idempotente)
      if (order) {
        const orderStatusEnum  = mapOrderStatusToPaymentEnum(order?.status);
        const chargeObj        = order?.charges?.find(c => c?.id === chargeId) || order?.charges?.[0] || null;
        const chargeStatusEnum = mapChargeStatusToEnum(chargeObj?.status);

        await prisma.$transaction(async (tx) => {
          await tx.pedido.updateMany({
            where: { code: orderId },
            data: { status: orderStatusEnum },
          });
          if (chargeId) {
            await tx.charge.updateMany({
              where: { providerId: chargeId },
              data: { status: chargeStatusEnum, raw: chargeObj || {} },
            });
          }
        });
      }

      await logWebhook({ event: type, orderCode: orderId, payload: evt });
      await onPaid({ orderId, chargeId, metadata });
      return NextResponse.json({ ok: true, handled: 'charge.paid' });
    }

    // order.paid
    if (type === 'order.paid') {
      const orderId = data?.id || null;

      let order = null; let metadata = {};
      if (orderId) {
        try {
          order = await pagarmeGET(`/orders/${orderId}`);
          metadata = order?.metadata || {};
        } catch {}
      }

      if (order) {
        const orderStatusEnum = mapOrderStatusToPaymentEnum(order?.status);
        const chargeObj       = order?.charges?.[0] || null;
        const chargeId        = chargeObj?.id || null;
        const chargeStatusEnum= mapChargeStatusToEnum(chargeObj?.status);

        await prisma.$transaction(async (tx) => {
          await tx.pedido.updateMany({
            where: { code: orderId },
            data: { status: orderStatusEnum },
          });
          if (chargeId) {
            await tx.charge.updateMany({
              where: { providerId: chargeId },
              data: { status: chargeStatusEnum, raw: chargeObj || {} },
            });
          }
        });

        await logWebhook({ event: type, orderCode: orderId, payload: evt });
        await onPaid({ orderId, chargeId, metadata });
        return NextResponse.json({ ok: true, handled: 'order.paid' });
      }

      await logWebhook({ event: type, orderCode: orderId, payload: evt });
      return NextResponse.json({ ok: true, handled: 'order.paid', note: 'order not found via API' });
    }

    // Outros eventos → só log (evita retries chatos)
    await logWebhook({ event: type, orderCode: null, payload: evt });
    return NextResponse.json({ received: true, ignored_type: type }, { status: 200 });
  } catch (err) {
    // Em dev, devolve 200 para não gerar loop de retries
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
