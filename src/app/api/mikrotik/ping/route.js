// src/app/api/mikrotik/ping/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { RouterOSClient } from 'routeros-client';
import dns from 'node:dns/promises';

const yes = (v) => ['1','true','yes','on'].includes(String(v ?? '').toLowerCase());
function getCfg() {
  const host = process.env.MIKROTIK_HOST || process.env.MIKOTIK_HOST || null;
  const user = process.env.MIKROTIK_USER || process.env.MIKROTIK_USERNAME || null;
  const pass = process.env.MIKROTIK_PASS || process.env.MIKROTIK_PASSWORD || null;
  const secure = yes(process.env.MIKROTIK_SSL) || yes(process.env.MIKROTIK_SECURE);
  const port = Number(process.env.MIKROTIK_PORT || process.env.PORTA_MIKROTIK || (secure ? 8729 : 8728));
  const timeout = Number(process.env.MIKROTIK_TIMEOUT_MS || 3000); // <= keep curto
  const tlsInsecure = yes(process.env.MIKROTIK_TLS_INSECURE);
  const hard = Number(process.env.MIKROTIK_HARD_TIMEOUT_MS || 2500); // <= corta geral
  return { host, user, pass, secure, port, timeout, tlsInsecure, hard };
}

async function resolveToIp(host) {
  if (!host) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return host;
  try { const { address } = await dns.lookup(host); return address; } catch { return null; }
}

const withHardTimeout = (p, ms) =>
  Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject(new Error('HARD_TIMEOUT')), ms)),
  ]);

export async function GET() {
  const cfg = getCfg();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return NextResponse.json({ ok:false, error:'Configuração Mikrotik ausente (host/user/pass)' }, { status: 400 });
  }

  let api;
  try {
    api = new RouterOSClient({
      host: cfg.host,
      user: cfg.user,
      password: cfg.pass,
      port: cfg.port,
      ssl: cfg.secure,
      timeout: cfg.timeout,
      ...(cfg.secure ? { rejectUnauthorized: !cfg.tlsInsecure } : {}),
    });

    await withHardTimeout(api.connect(), cfg.hard).catch(() => { throw new Error('CONNECTION_TIMEOUT'); });

    let identity = null;
    try {
      const idRes = await withHardTimeout(api.menu('/system/identity').print(), cfg.hard);
      identity = Array.isArray(idRes) && idRes[0]?.name ? idRes[0].name : null;
    } catch {}

    let internet = { ok:false, rtt_ms:null };
    try {
      const pong = await withHardTimeout(api.menu('/ping').once({ address:'1.1.1.1', count:1 }), cfg.hard);
      const rtt = (pong?.['avg-rtt'] ?? pong?.time ?? pong?.rt ?? null);
      const rttNum = rtt ? Number(String(rtt).replace('ms','').trim()) : null;
      const received = Number(pong?.received || pong?.rx || 0);
      internet = { ok: (received > 0) || (rttNum !== null), rtt_ms: rttNum };
    } catch {}

    // opcional: registra/atualiza Dispositivo rapidamente, mas sem travar resposta
    const ipInet = await resolveToIp(cfg.host);
    (async () => {
      try {
        let frota = await prisma.frota.findFirst();
        if (!frota) frota = await prisma.frota.create({ data: { nome:'Padrão' } });
        if (ipInet) {
          await prisma.dispositivo.upsert({
            where: { frotaId_ip: { frotaId: frota.id, ip: ipInet } },
            update: { atualizadoEm: new Date() },
            create: { ip: ipInet, frotaId: frota.id },
          });
        }
      } catch {}
    })();

    await api.close().catch(()=>{});
    return NextResponse.json({ ok:true, connected:true, host:cfg.host, ip:ipInet, port:cfg.port, secure:cfg.secure, identity, internet });
  } catch (e) {
    try { await api?.close(); } catch {}
    // 200 pra não quebrar, mas **rápido**
    return NextResponse.json({ ok:false, connected:false, error:'timeout' }, { status: 200 });
  }
}
