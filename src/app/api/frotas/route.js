// src/app/api/frotas/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { relayFetch } from '@/lib/relay';

export const dynamic = 'force-dynamic';

export async function GET() {
  // envs mínimas para o relay construir o comando
  const host = process.env.MIKROTIK_HOST || '';
  const user = process.env.MIKROTIK_USER || '';
  const pass = process.env.MIKROTIK_PASS || '';

  // se faltar qualquer env, já responde modo offline (sem travar a página)
  if (!host || !user || !pass) {
    console.warn('⚠️ MIKROTIK_* ausentes. Respondendo /frotas em modo offline.');
    return buildFrotasOffline();
  }

  try {
    // 1) tenta pegar PPP active via relay (/relay/exec)
    const r = await relayFetch('/relay/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // relay executa no Mikrotik usando nossas credenciais
      body: JSON.stringify({
        host, user, pass,
        command: '/ppp/active/print',
      }),
    }).catch(() => null);

    // se o relay caiu, retorna offline
    if (!r) {
      console.warn('⚠️ Relay sem resposta. Respondendo /frotas em modo offline.');
      return buildFrotasOffline();
    }

    const j = await r.json().catch(() => ({}));
    // estrutura esperada do relay: { ok: true, data: [...] }
    const rows = Array.isArray(j?.data) ? j.data : [];

    // 2) frotas do banco
    const frotas = await prisma.frota.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    });

    // 3) casa cada frota com PPP active (heurística: name contém o nome da frota)
    const resposta = frotas.map((f) => {
      const match = rows.find((s) => {
        const nm = (s?.name || s?.user || '').toString().toLowerCase();
        return nm.includes(f.nome.toLowerCase());
      });
      return {
        ...f,
        vendas: 0,
        acessos: match ? 1 : 0,
        status: match ? 'online' : 'offline',
      };
    });

    return NextResponse.json(resposta, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.warn('⚠️ /api/frotas caiu para offline:', err?.message || err);
    return buildFrotasOffline();
  }
}

/* ---------- Fallback “offline” seguro ---------- */
async function buildFrotasOffline() {
  try {
    const frotas = await prisma.frota.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    });

    const resposta = frotas.map((f) => ({
      ...f,
      vendas: 0,
      acessos: 0,
      status: 'offline',
    }));

    return NextResponse.json(resposta, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (dbErr) {
    console.error('⚠️ /api/frotas offline: erro ao consultar banco:', dbErr);
    return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
