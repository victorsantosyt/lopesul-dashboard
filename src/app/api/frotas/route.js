// src/app/api/frotas/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { relayFetch } from '@/lib/relay';

export const dynamic = 'force-dynamic';

export async function GET() {
  const host = process.env.MIKROTIK_HOST || '';
  const user = process.env.MIKROTIK_USER || '';
  const pass = process.env.MIKROTIK_PASS || '';

  if (!host || !user || !pass) {
    return NextResponse.json(
      { ok: false, error: 'mikrotik_env_missing' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 1) Consulta Relay -> Mikrotik (PPPoE/Hotspot ativos)
  const r = await relayFetch('/relay/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, user, pass, command: '/ppp/active/print' }),
  }).catch(() => null);

  if (!r) {
    return NextResponse.json(
      { ok: false, error: 'relay_unreachable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const j = await r.json().catch(() => ({}));
  if (!j?.ok || !Array.isArray(j?.data)) {
    return NextResponse.json(
      { ok: false, error: 'relay_bad_payload', payload: j },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const rows = j.data; // Linhas reais vindas do Mikrotik via Relay

  // 2) Frotas do banco
  const frotas = await prisma.frota.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });

  // 3) Casa cada frota com sessão ativa
  const resposta = frotas.map((f) => {
    const match = rows.find((s) => {
      const nm = (s?.name || s?.user || '').toString().toLowerCase();
      return nm.includes((f.nome || '').toLowerCase());
    });
    return {
      ...f,
      vendas: 0,       // real vem de outra rota/resumo; aqui não “inventamos”
      acessos: match ? 1 : 0,
      status: match ? 'online' : 'offline',
    };
  });

  return NextResponse.json(resposta, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}