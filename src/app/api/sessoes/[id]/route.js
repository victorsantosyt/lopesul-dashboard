// src/app/api/sessoes/[id]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/* Helper JSON + CORS */
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

/* CORS preflight para DELETE */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function DELETE(_req, { params }) {
  try {
    const id = String(params?.id || '').trim();
    if (!id) return json({ error: 'ID inválido' }, 400);

    const sessao = await prisma.sessaoAtiva.findUnique({
      where: { id },
      select: { id: true, ativo: true, ipCliente: true, macCliente: true },
    });

    if (!sessao) return json({ error: 'Sessão não encontrada' }, 404);

    // Idempotente: se já está inativa, não falha
    if (!sessao.ativo) {
      return json({ ok: true, id: sessao.id, note: 'já inativa' });
    }

    const now = new Date();
    await prisma.sessaoAtiva.update({
      where: { id: sessao.id },
      data: { ativo: false, expiraEm: now },
    });

    // (Opcional) Derrubar no Mikrotik aqui.
    // try {
    //   if (process.env.MIKROTIK_HOST) {
    //     const { disconnectByIpMac } = await import('@/lib/router'); // sua lib
    //     await disconnectByIpMac({ ip: sessao.ipCliente, mac: sessao.macCliente });
    //   }
    // } catch (e) {
    //   console.warn('Falha ao derrubar no roteador:', e?.message || e);
    // }

    return json({ ok: true, id: sessao.id });
  } catch (e) {
    console.error('DELETE /api/sessoes/[id]', e?.message || e);
    return json({ error: 'Erro ao encerrar sessão' }, 500);
  }
}
