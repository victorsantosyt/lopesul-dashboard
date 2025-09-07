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

  return { host, user, pass, secure, port, timeout };
}

async function resolveToIp(host) {
  if (!host) return null;
  // já é IPv4/IPv6?
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return host;
  try {
    const { address } = await dns.lookup(host);
    return address; // IPv4/IPv6
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
    // 1) testa a conexão com o Mikrotik
    const api = new RouterOSClient({
      host: cfg.host,
      user: cfg.user,
      pass: cfg.pass,     // <- chave correta
      port: cfg.port,
      secure: cfg.secure, // <- chave correta
      timeout: cfg.timeout,
    });

    await api.connect();

    // identity opcional (nome do roteador)
    let identity = null;
    try {
      const idRes = await api.menu('/system/identity').print();
      identity = Array.isArray(idRes) && idRes[0]?.name ? idRes[0].name : null;
    } catch {}
    await api.close();

    // 2) garante uma frota para associar o dispositivo
    let frota = await prisma.frota.findFirst();
    if (!frota) {
      frota = await prisma.frota.create({ data: { nome: 'Padrão' } });
    }

    // 3) resolve host -> IP para caber na coluna INET
    const ipInet = await resolveToIp(cfg.host);

    if (!ipInet) {
      // conectado OK, mas não vamos inserir hostname em coluna INET
      return NextResponse.json({
        ok: true,
        connected: true,
        note:
          'Conexão OK, mas não inserido na tabela: host não é IP e DNS não resolveu.',
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        identity,
      });
    }

    // 4) upsert do dispositivo (único por frotaId + ip)
    await prisma.dispositivo.upsert({
      where: { frotaId_ip: { frotaId: frota.id, ip: ipInet } },
      update: { atualizadoEm: new Date() },
      create: { ip: ipInet, frotaId: frota.id },
    });

    return NextResponse.json({
      ok: true,
      connected: true,
      host: cfg.host,
      ip: ipInet,
      port: cfg.port,
      secure: cfg.secure,
      identity,
    });
  } catch (e) {
    console.error('GET /api/mikrotik/ping error:', e?.message, e?.stack || e);
    // resposta genérica ao cliente (sem stack)
    return NextResponse.json(
      { ok: false, error: 'Falha ao conectar ao Mikrotik' },
      { status: 502 }
    );
  }
}
