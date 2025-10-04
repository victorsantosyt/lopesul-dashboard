// src/app/api/webhook/pagarme/route.js
import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
// ⬇️ trocar named import por default + desestruturação
import mikrotik from "@/lib/mikrotik";
const { liberarClienteNoMikrotik } = mikrotik;

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

  if (!secret) {
    // sem secret configurado: não bloqueia (útil em dev/homolog)
    return true;
  }
  if (!signatureHeader) return false;

  // Aceita "sha1=abcdef..." ou só "abcdef..."
  const got = String(signatureHeader).trim();
  const provided = got.startsWith("sha1=") ? got : `sha1=${got}`;

  const expected =
    "sha1=" + crypto.createHmac("sha1", secret).update(rawBody).digest("hex");

  return timingSafeEq(expected, provided);
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

/** Marca pedido como pago e libera no Mikrotik */
async function markPaidAndRelease(orderCode) {
  const pedido = await prisma.pedido.findFirst({ where: { code: orderCode } });
  if (!pedido) return;

  if (pedido.status !== "PAID") {
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { status: "PAID" },
    });

    // tempo padrão 120 min; ajuste conforme sua regra/plano
    await liberarClienteNoMikrotik({
      ip: pedido.ip,
      mac: pedido.deviceMac,
      busId: pedido.busId,
      minutos: 120,
    });
  }
}

export async function POST(req) {
  try {
    const raw = await req.text();
    const sig =
      req.headers.get("x-hub-signature") ||
      req.headers.get("x-postbacks-signature") ||
      "";

    if (!verifyPagarmeSignature(raw, sig)) {
      return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
    }

    const evt = JSON.parse(raw);
    const basics = extractBasics(evt);
    const mapped = mapStatus({
      type: basics.type,
      orderStatus: basics.orderStatus,
      chargeStatus: basics.chargeStatus,
    });

    try {
      await prisma.webhookLog.create({
        data: {
          event: basics.type,
          orderCode: basics.orderCode,
          payload: evt,
        },
      });
    } catch {}

    if (basics.orderCode) {
      await prisma.pedido.updateMany({
        where: { code: basics.orderCode },
        data: { status: mapped },
      });
    }

    if (basics.chargeId) {
      const existing = await prisma.charge.findFirst({
        where: { providerId: basics.chargeId },
        select: { id: true },
      });

      const common = {
        status: mapped,
        method: basics.method === "PIX" ? "PIX" : (basics.method || "CARD"),
        qrCode: basics.qrText ?? undefined,
        qrCodeUrl: basics.qrUrl ?? undefined,
        raw: evt,
      };

      if (existing) {
        await prisma.charge.update({
          where: { id: existing.id },
          data: common,
        });
      } else {
        let pedidoConnect = undefined;
        if (basics.orderCode) {
          const p = await prisma.pedido.findFirst({ where: { code: basics.orderCode }, select: { id: true } });
          if (p) pedidoConnect = { connect: { id: p.id } };
        }
        await prisma.charge.create({
          data: {
            providerId: basics.chargeId,
            ...common,
            ...(pedidoConnect ? { pedido: pedidoConnect } : {}),
          },
        });
      }
    }

    if (mapped === "PAID" && basics.orderCode) {
      await markPaidAndRelease(basics.orderCode);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
