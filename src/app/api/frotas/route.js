// src/app/api/frotas/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { relayFetch } from '@/lib/relay';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const host = process.env.MIKROTIK_HOST || '';
    const user = process.env.MIKROTIK_USER || '';
    const pass = process.env.MIKROTIK_PASS || '';

    if (!host || !user || !pass) {
      return NextResponse.json(
        { ok: false, error: 'mikrotik_env_missing' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 1) busca frotas do banco
    const frotas = await prisma.frota.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    });

    // 2) tenta pegar sessões ativas do hotspot via relay
    const r = await relayFetch('/relay/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host, user, pass,
        command: '/ip/hotspot/active/print',
      }),
    }).catch(() => null);

    if (!r) {
      return NextResponse.json(
        { ok: false, error: 'relay_unreachable' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const j = await r.json().catch(() => ({}));
    const sessoes = Array.isArray(j?.data) ? j.data : [];

    // 3) busca IP-bindings bypassed (clientes liberados automaticamente)
    const r2 = await relayFetch('/relay/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host, user, pass,
        command: '/ip/hotspot/ip-binding/print',
      }),
    }).catch(() => null);

    const j2 = await r2?.json().catch(() => ({}));
    const bindings = Array.isArray(j2?.data) ? j2.data : [];
    const bypassedBindings = bindings.filter(b => b?.type === 'bypassed' || b?.bypassed === 'true');

    // 4) conta total de acessos (sessões ativas + bindings bypassed)
    const totalAcessos = sessoes.length + bypassedBindings.length;

    // 5) monta resposta com acessos totais para cada frota
    const resposta = frotas.map((f) => {
      return {
        ...f,
        valorTotal: 0,
        acessos: totalAcessos,
        status: totalAcessos > 0 ? 'online' : 'offline',
      };
    });

    return NextResponse.json(
      {
        ok: true,
        count: resposta.length,
        frotas: resposta,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/frotas erro geral:', error);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: String(error) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
