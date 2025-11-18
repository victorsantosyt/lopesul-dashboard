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

    const sanitizeId = (value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (!trimmed || /^\$\(.+\)$/.test(trimmed)) return null;
      return trimmed;
    };
    const deviceId = sanitizeId(body?.deviceId) ||
      sanitizeId(body?.dispositivoId) ||
      sanitizeId(body?.device);
    const mikId = sanitizeId(body?.mikId) ||
      sanitizeId(body?.mikID) ||
      sanitizeId(body?.mikrotikId) ||
      sanitizeId(body?.routerId);

    if (!deviceId && !mikId) {
      return NextResponse.json(
        { error: "deviceId ou mikId são obrigatórios para identificar o Mikrotik." },
        { status: 400 }
      );
    }

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

    // Detectar IP do cliente automaticamente se não vier nos parâmetros
    let clienteIp = body?.clienteIp || null;
    if (!clienteIp || clienteIp === '$(ip)') {
      // Tentar detectar via headers HTTP
      clienteIp = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                  headers.get('x-real-ip') ||
                  headers.get('cf-connecting-ip') ||
                  null;
      console.log('[CHECKOUT] IP detectado via header:', clienteIp);
    }
    
    const pixPayload = {
      valor: body?.valor,          // VALOR EM REAIS (não centavos)
      descricao,
      customer,
      expires_in: expiresIn,
      clienteIp,
      deviceMac: body?.clienteMac && body?.clienteMac !== '$(mac)' ? body?.clienteMac : null,
      deviceId,
      mikId,
      metadata: {
        origem: "checkout-endpoint",
        deviceId,
        mikId,
        ...(body?.metadata || {}),
      },
      orderId,
    };
    
    // Descobrir MAC automaticamente se temos IP mas não temos MAC
    let deviceMac = pixPayload.deviceMac;
    if (!deviceMac && clienteIp && (deviceId || mikId)) {
      try {
        console.log('[CHECKOUT] Tentando descobrir MAC via IP (API interna):', clienteIp);

        // Usa o endpoint interno que já fala com o Relay e parseia a ARP table
        const params = new URLSearchParams({ ip: clienteIp });
        if (deviceId) params.set('deviceId', deviceId);
        else if (mikId) params.set('mikId', mikId);

        const arpRes = await fetch(`${baseUrl}/api/mikrotik/arp?${params.toString()}`, {
          cache: 'no-store',
        }).catch(() => null);

        if (arpRes?.ok) {
          const data = await arpRes.json().catch(() => ({}));
          if (data?.mac) {
            deviceMac = String(data.mac).trim().toUpperCase();
            console.log('[CHECKOUT] MAC descoberto via /api/mikrotik/arp:', deviceMac);
          } else {
            console.log('[CHECKOUT] /api/mikrotik/arp não retornou MAC:', data?.message || data?.error || null);
          }
        } else if (arpRes) {
          console.warn('[CHECKOUT] /api/mikrotik/arp HTTP status:', arpRes.status);
        }
      } catch (err) {
        console.warn('[CHECKOUT] Erro ao descobrir MAC via API interna:', err.message);
      }
    }
    
    // Atualizar deviceMac no payload
    pixPayload.deviceMac = deviceMac;
    
    console.log('[CHECKOUT] Sending to PIX:', { clienteIp: pixPayload.clienteIp, deviceMac: pixPayload.deviceMac });

    const upstream = await fetch(pixUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pixPayload),
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