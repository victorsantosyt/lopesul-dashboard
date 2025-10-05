// src/app/api/dispositivos/status/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAnyOnline, tcpCheck, pingCheck } from '@/lib/netcheck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickIp(row) {
  return row?.ip ?? row?.enderecoIp ?? row?.ipAddress ?? row?.host ?? null;
}

export async function GET() {
  try {
    // NÃO usa select com campos incertos; traz tudo e escolhe o IP em memória
    const dispositivos = await prisma.dispositivo.findMany({
      take: 1000,
    });

    const ipsDb = Array.from(
      new Set((dispositivos ?? []).map(pickIp).filter(Boolean))
    );

    // hosts extras via .env (opcional)
    if (process.env.MIKROTIK_HOST) ipsDb.push(process.env.MIKROTIK_HOST);
    if (process.env.STARLINK_HOST) ipsDb.push(process.env.STARLINK_HOST);

    // Mikrotik: TCP 8728 ou ping
    const mk = await checkAnyOnline(ipsDb);

    // Starlink: tenta HTTP (80) e, se falhar, ping
    async function starlinkOnline(hosts) {
      const arr = Array.from(new Set((hosts ?? []).filter(Boolean)));
      for (const h of arr) {
        if (await tcpCheck(h, 80, 1200)) return { online: true, lastHost: h };
        if (await pingCheck(h, 1200))   return { online: true, lastHost: h };
      }
      return { online: false, lastHost: arr[0] || null };
    }
    const sl = await starlinkOnline(ipsDb);

    return NextResponse.json(
      {
        mikrotik: {
          online: mk.online,
          hosts: ipsDb,
          lastHost: mk.lastHost,
          port: Number(process.env.MIKROTIK_PORT || 8728),
          via: 'tcp(8728)|ping',
        },
        starlink: {
          online: sl.online,
          hosts: ipsDb,
          lastHost: sl.lastHost,
          via: 'tcp(80)|ping',
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('GET /api/dispositivos/status', e?.message || e);
    return NextResponse.json(
      { mikrotik: { online: false }, starlink: { online: false } },
      { status: 200 }
    );
  }
}
