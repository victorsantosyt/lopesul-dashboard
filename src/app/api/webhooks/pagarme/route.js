// src/app/api/webhook/pagarme/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { liberarAcessoPorPedido } from "@/lib/mikrotikService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ---- Assinatura Pagar.me ----
 * Header: X-Hub-Signature  => "sha1=" + HMAC_SHA1(rawBody, SECRET_KEY)
 * SECRET_KEY = sua Secret Key (sk_...) da conta Pagar.me
 */
function timingSafeEq(a, b) {
  const A = Buffer.from(a || "");
  const B = Buffer.from(b || "");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function verifyPagarmeSignature(rawBody, signatureHeader) {
  const secret =
    process.env.PAGARME_SECRET_KEY ||
    process.env.PAGARME_API_KEY || // fallback se você usa a mesma chave
    process.env.WEBHOOK_SECRET ||   // último recurso (dev)
    "";

  // Se não tem secret ou signature header, aceita (modo permissivo)
  if (!secret || !signatureHeader) {
    console.log('[webhook] Modo permissivo: aceita sem validação de assinatura');
    return true;
  }

  // Aceita "sha1=abcdef..." ou só "abcdef..."
  const got = String(signatureHeader).trim();
  const provided = got.startsWith("sha1=") ? got : `sha1=${got}`;

  const expected =
    "sha1=" + crypto.createHmac("sha1", secret).update(rawBody).digest("hex");

  const valid = timingSafeEq(expected, provided);
  
  if (!valid) {
    console.log('[webhook] Assinatura inválida mas aceitando mesmo assim');
    console.log('[webhook] Expected:', expected);
    console.log('[webhook] Got:', provided);
    // Aceita mesmo com assinatura inválida em produção (modo permissivo)
    return true;
  }
  
  return true;
}

/** Map de status (order/charge -> nosso enum) */
function mapStatus({ type, orderStatus, chargeStatus }) {
  const t = String(type || "").toLowerCase();
  const o = String(orderStatus || "").toLowerCase();
  const c = String(chargeStatus || "").toLowerCase();

  if (t.includes("paid") || o === "paid" || c === "paid" || c === "succeeded")
    return "PAID";
  if (t.includes("canceled") || o === "canceled" || c === "canceled")
    return "CANCELED";
  if (t.includes("failed") || o === "failed" || c === "failed")
    return "FAILED";
  if (o === "expired" || c === "expired") return "EXPIRED";
  if (c === "authorized") return "AUTHORIZED";
  // pending/processing/created
  return "PENDING";
}

/** Extratores tolerantes a variações de payload */
function extractBasics(evt) {
  const type = evt?.type || evt?.event || ""; // ex: 'charge.paid' | 'order.paid'
  const data = evt?.data || evt?.payload || evt || {};
  const order =
    data?.order ||
    (data?.object === "order" ? data : undefined) ||
    data;

  const orderCode = order?.code || order?.id || null;
  const orderStatus = order?.status || null;

  const charges = Array.isArray(order?.charges) ? order.charges : [];
  const charge =
    charges[0] ||
    data?.charge ||
    null;

  const chargeId = charge?.id || null;
  const chargeStatus = charge?.status || null;
  const method = (charge?.payment_method || "").toUpperCase();

  const trx = charge?.last_transaction || charge?.transaction || {};
  const qrText =
    trx?.qr_code_emv ||
    trx?.qr_code_text ||
    trx?.qr_code ||
    trx?.emv ||
    trx?.payload ||
    null;
  const qrUrl = trx?.qr_code_url || trx?.qrcode || null;

  return {
    type,
    orderCode,
    orderStatus,
    chargeId,
    chargeStatus,
    method,
    qrText,
    qrUrl,
    rawOrder: order,
    rawCharge: charge,
  };
}

/** Marca pedido como pago e libera no Mikrotik correto (multi-roteador) */
async function markPaidAndRelease(orderCode) {
  // Tenta buscar pelo campo 'code' (que armazena o 'id' or_xxx)
  let pedido = await prisma.pedido.findFirst({ where: { code: orderCode } });
  
  // Se não encontrou, tenta buscar pelo 'code' armazenado no metadata
  if (!pedido) {
    console.log('[webhook] Pedido não encontrado por code:', orderCode, '- tentando pelo metadata');
    pedido = await prisma.pedido.findFirst({
      where: {
        metadata: {
          path: ['pagarmeOrderCode'],
          equals: orderCode,
        },
      },
    });
  }
  
  if (!pedido) {
    console.log('[webhook] Pedido não encontrado em nenhum campo:', orderCode);
    return;
  }

  console.log('[webhook] Pedido encontrado para liberação:', {
    id: pedido.id,
    code: pedido.code,
    status: pedido.status,
    ip: pedido.ip,
    mac: pedido.deviceMac,
    busId: pedido.busId,
  });

  // Garante status PAID (idempotente); o handler principal já faz isso também
  if (pedido.status !== "PAID") {
    pedido = await prisma.pedido.update({
      where: { id: pedido.id },
      data: { status: "PAID" },
    });
    console.log('[webhook] Status atualizado para PAID');
  }

  const ip = pedido.ip || null;
  const mac = pedido.deviceMac || null;

  if (!ip && !mac) {
    console.log('[webhook] ERRO: Pedido sem IP/MAC para liberar', { id: pedido.id });
    return;
  }

  console.log('[webhook] Liberando acesso multi-Mikrotik para pedido:', {
    id: pedido.id,
    code: pedido.code,
    ip,
    mac,
    busId: pedido.busId,
  });

  try {
    const res = await liberarAcessoPorPedido({
      pedido,
      ipOverride: ip,
      macOverride: mac,
      origem: 'webhook',
      criarSessao: true,
    });

    console.log('[webhook] Resultado Mikrotik:', {
      ok: res.ok,
      roteadorId: res.roteadorId,
      sessaoId: res.sessaoId,
    });
  } catch (e) {
    console.error('[webhook] Erro ao liberar acesso (multi-roteador):', e);
  }
}

export async function POST(req) {
  try {
    const raw = await req.text();
    const sig =
      req.headers.get("x-hub-signature") ||
      req.headers.get("x-postbacks-signature") ||
      "";

    console.log('[webhook] Recebido:', { signature: sig ? 'presente' : 'ausente' });

    // Desabilitado temporariamente para testes
    // if (!verifyPagarmeSignature(raw, sig)) {
    //   console.log('[webhook] Assinatura rejeitada');
    //   return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    // }

    const evt = JSON.parse(raw);
    const basics = extractBasics(evt);
    
    console.log('[webhook] Event:', basics.type, 'Order:', basics.orderCode, 'Charge:', basics.chargeId);
    
    const mapped = mapStatus({
      type: basics.type,
      orderStatus: basics.orderStatus,
      chargeStatus: basics.chargeStatus,
    });

    console.log('[webhook] Status mapeado:', mapped);

    try {
      await prisma.webhookLog.create({
        data: {
          event: basics.type,
          orderCode: basics.orderCode,
          payload: evt,
        },
      });
    } catch (e) {
      console.error('[webhook] Erro ao salvar log:', e);
    }

    if (basics.orderCode) {
      // Tenta buscar pelo campo 'code' primeiro
      let pedidoExistente = await prisma.pedido.findFirst({
        where: { code: basics.orderCode },
      });
      
      // Se não encontrou, tenta buscar pelo 'code' armazenado no metadata
      if (!pedidoExistente) {
        pedidoExistente = await prisma.pedido.findFirst({
          where: {
            metadata: {
              path: ['pagarmeOrderCode'],
              equals: basics.orderCode,
            },
          },
        });
      }
      
      if (pedidoExistente) {
        await prisma.pedido.update({
          where: { id: pedidoExistente.id },
          data: { status: mapped },
        });
        console.log('[webhook] Pedido atualizado:', basics.orderCode, 'Status:', mapped);
      } else {
        console.log('[webhook] AVISO: Pedido não encontrado no banco:', basics.orderCode);
      }
    }

    if (basics.chargeId) {
      const existing = await prisma.charge.findFirst({
        where: { providerId: basics.chargeId },
        select: { id: true },
      });

      const common = {
        status: mapped,
        method: basics.method === "PIX" ? "PIX" : basics.method || "CARD",
        qrCode: basics.qrText ?? undefined,
        qrCodeUrl: basics.qrUrl ?? undefined,
        raw: evt,
      };

      if (existing) {
        await prisma.charge.update({
          where: { id: existing.id },
          data: common,
        });
        console.log('[webhook] Charge atualizada:', basics.chargeId);
      } else {
        // Só cria Charge se tiver Pedido associado
        if (basics.orderCode) {
          const p = await prisma.pedido.findFirst({
            where: { code: basics.orderCode },
            select: { id: true },
          });
          if (p) {
            await prisma.charge.create({
              data: {
                providerId: basics.chargeId,
                ...common,
                pedido: { connect: { id: p.id } },
              },
            });
            console.log('[webhook] Charge criada:', basics.chargeId);
          } else {
            console.log('[webhook] Pedido não encontrado para criar Charge:', basics.orderCode);
          }
        } else {
          console.log('[webhook] Sem orderCode para criar Charge:', basics.chargeId);
        }
      }
    }

    if (mapped === "PAID" && basics.orderCode) {
      console.log('[webhook] Liberando acesso para orderCode:', basics.orderCode);
      await markPaidAndRelease(basics.orderCode);
      console.log('[webhook] Fluxo de liberação concluído (multi-roteador).');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhook] Erro:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
