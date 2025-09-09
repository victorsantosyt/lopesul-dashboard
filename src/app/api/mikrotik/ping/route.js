// src/app/api/mikrotik/ping/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { RouterOSClient } from 'routeros-client';
import dns from 'node:dns/promises';

// helpers
const yes = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase());
function getCfg() {
  const host =
    process.env.MIKROTIK_HOST ||
    process.env.MIKOTIK_HOST || // fallback p/ typo
    null;

  const user = process.env.MIKROTIK_USER || process.env.MIKROTIK_USERNAME || null;
  const pass = process.env.MIKROTIK_PASS || process.env.MIKROTIK_PASSWORD || null;

  const secure = yes(process.env.MIKROTIK_SSL) || yes(process.env.MIKROTIK_SECURE);
  const port = Number(
    process.env.MIKROTIK_PORT ||
      process.env.PORTA_MIKROTIK ||
      (secure ? 8729 : 8728)
  );

  const timeout = Number(process.env.MIKROTIK_TIMEOUT_MS || 8000);
  const tlsInsecure = yes(process.env.MIKROTIK_TLS_INSECURE); // aceita cert self-signed

  return { host, user, pass, secure, port, timeout, tlsInsecure };
}

async function resolveToIp(host) {
  if (!host) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return host;
  try {
    const { address } = await dns.lookup(host);
    return address;
  } catch {
    return null;
  }
}

export async function GET() {
  const cfg = getCfg();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return NextResponse.json(
      { ok: false, error: 'Configuração Mikrotik ausente (host/user/pass)' },
      { status: 400 }
    );
  }

  try {
    // 1) conecta no MikroTik
    const api = new RouterOSClient({
      host: cfg.host,
      user: cfg.user,
      password: cfg.pass,        // chave correta
      port: cfg.port,
      ssl: cfg.secure,           // chave correta
      timeout: cfg.timeout,
      ...(cfg.secure ? { rejectUnauthorized: !cfg.tlsInsecure } : {}),
    });

    await api.connect();

    // identity (nome do roteador)
    let identity = null;
    try {
      const idRes = await api.menu('/system/identity').print();
      identity = Array.isArray(idRes) && idRes[0]?.name ? idRes[0].name : null;
    } catch {}

    // 2) teste de internet A PARTIR DO MIKROTIK (equivale ao “Starlink OK”)
    let internet = { ok: false, rtt_ms: null };
    try {
      // Nota: em ROS 6, usar /ping ... count=1 (menu '/ping' ou '/tool/ping', ambos funcionam via client)
      const pong = await api.menu('/ping').once({ address: '1.1.1.1', count: 1 });
      // Campos variam por versão; tenta extrair RTT/recebidos:
      const received = Number(pong?.received || pong?.rx || 0);
      const avgRtt = (pong?.['avg-rtt'] ?? pong?.time ?? pong?.rt ?? null);
      const rtt = avgRtt ? Number(String(avgRtt).replace('ms','').trim()) : null;
      internet = { ok: received > 0 || rtt !== null, rtt_ms: rtt };
    } catch (e) {
      // se der erro, mantém { ok:false }
      // console.error('ping upstream error:', e?.message);
    }

    await api.close();

    // 3) garante um registro de Dispositivo (como você já fazia)
    let frota = await prisma.frota.findFirst();
    if (!frota) {
      frota = await prisma.frota.create({ data: { nome: 'Padrão' } });
    }
    const ipInet = await resolveToIp(cfg.host);
    if (ipInet) {
      await prisma.dispositivo.upsert({
        where: { frotaId_ip: { frotaId: frota.id, ip: ipInet } },
        update: { atualizadoEm: new Date() },
        create: { ip: ipInet, frotaId: frota.id },
      });
    }

    return NextResponse.json({
      ok: true,
      connected: true,        // MikroTik acessível pela API
      host: cfg.host,
      ip: ipInet,
      port: cfg.port,
      secure: cfg.secure,
      identity,

      // “Starlink online” (se o MikroTik só tem Starlink como uplink):
      internet,               // { ok: boolean, rtt_ms: number|null }
    });
  } catch (e) {
    console.error('GET /api/mikrotik/ping error:', e?.message, e?.stack || e);
    return NextResponse.json(
      { ok: false, connected: false, error: 'Falha ao conectar ao Mikrotik' },
      { status: 200 } // 200 pra não “quebrar” o dashboard
    );
  }
}
