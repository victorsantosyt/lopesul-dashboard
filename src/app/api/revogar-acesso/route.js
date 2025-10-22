// src/app/api/revogar-acesso/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import prisma from '@/lib/prisma';
import mikrotik from '@/lib/mikrotik';
const { revogarCliente } = mikrotik;

/* ===== helpers ===== */
const hasModel = (name) => {
  const m = prisma?.[name];
  return !!m && typeof m === 'object';
};

const tryAwait = async (fn, fallback = null) => {
  try { return await fn(); } catch { return fallback; }
};

function corsJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/* Preflight CORS */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/* ===== main ===== */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      // identificadores (qualquer um deles)
      externalId,   // ref do PSP (no legado pode estar em pagamento.externalId; no novo costuma ser pedido.code)
      pagamentoId,  // id interno legado
      txid,         // txid Pix (legado)
      pedidoId,     // id do novo 'pedido' (opcional)
      code,         // code do 'pedido' (opcional)

      // overrides de rede
      ip,
      mac,

      // status desejado (opcional): 'expirado' | 'cancelado'
      statusFinal,
    } = body || {};

    if (!externalId && !pagamentoId && !txid && !pedidoId && !code && !ip && !mac) {
      return corsJson({ ok: false, error: 'Informe externalId, pagamentoId, txid, pedidoId, code, ip ou mac.' }, 400);
    }

    /* 1) localizar registro em uma das tabelas (pagamento OU pedido) */
    let pg = null; // pagamento (legado)
    let pd = null; // pedido   (novo)

    if (hasModel('pagamento')) {
      if (externalId && !pg) pg = await tryAwait(() =>
        prisma.pagamento.findUnique({ where: { externalId } })
      );
      if (pagamentoId && !pg) pg = await tryAwait(() =>
        prisma.pagamento.findUnique({ where: { id: pagamentoId } })
      );
      if (txid && !pg) pg = await tryAwait(() =>
        prisma.pagamento.findFirst({ where: { txid } })
      );
    }

    if (!pg && hasModel('pedido')) {
      // no novo fluxo o "externalId" costuma ser o 'code' do pedido
      const pedidoCode = code || externalId || null;
      if (pedidoId && !pd) pd = await tryAwait(() =>
        prisma.pedido.findUnique({ where: { id: pedidoId } })
      );
      if (pedidoCode && !pd) pd = await tryAwait(() =>
        prisma.pedido.findUnique({ where: { code: pedidoCode } })
      );
    }

    /* 2) decidir IP/MAC (payload > registro encontrado) */
    const ipFinal  = ip  || pg?.clienteIp  || pd?.ip        || pd?.clienteIp  || null;
    const macFinal = mac || pg?.clienteMac || pd?.deviceMac || pd?.clienteMac || null;

    if (!ipFinal && !macFinal) {
      return corsJson({ ok: false, error: 'Sem IP/MAC (nem no payload, nem no registro).' }, 400);
    }

    /* 3) revogar na Mikrotik — idempotente */
    let mk;
    try {
      mk = await revogarCliente({
        ip:  ipFinal  || undefined,
        mac: macFinal || undefined,
      });
    } catch {
      // se já não existia, tratamos como sucesso para idempotência
      mk = { ok: true, note: 'revogarCliente idempotente (já não existia).' };
    }

    /* 4) atualizar status e sessão(ões) relacionadas */
    const now = new Date();

    if (pg && hasModel('pagamento')) {
      const novoStatus = statusFinal === 'cancelado' ? 'cancelado' : 'expirado';
      await tryAwait(() => prisma.pagamento.update({
        where: { id: pg.id },
        data: { status: novoStatus },
      }));
      await tryAwait(() => prisma.sessaoAtiva.updateMany({
        where: { pagamentoId: pg.id, ativo: true },
        data: { ativo: false, expiraEm: now },
      }));
    }

    if (pd && hasModel('pedido')) {
      // mapeia para o esquema novo (MAIÚSCULAS)
      const novoStatus = (statusFinal === 'cancelado') ? 'CANCELED' : 'EXPIRED';
      await tryAwait(() => prisma.pedido.update({
        where: { id: pd.id },
        data: { status: novoStatus },
      }));
      await tryAwait(() => prisma.sessaoAtiva.updateMany({
        where: { pedidoId: pd.id, ativo: true },
        data: { ativo: false, expiraEm: now },
      }));
    }

    return corsJson({
      ok: true,
      mikrotik: mk,
      // ecos úteis para o chamador
      pagamentoId: pg?.id || null,
      pedidoId:    pd?.id || null,
      externalId:  pg?.externalId || pd?.code || externalId || code || null,
      ip:          ipFinal || null,
      mac:         macFinal || null,
    });
  } catch (e) {
    console.error('POST /api/revogar-acesso error:', e);
    return corsJson({ ok: false, error: 'Falha ao revogar' }, 500);
  }
}
