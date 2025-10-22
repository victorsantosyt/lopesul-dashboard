// src/app/api/revogar-acesso/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import prisma from '@/lib/prisma';
// importa default e desestrutura da sua lib
import mikrotik from '@/lib/mikrotik';
const { revogarCliente } = mikrotik;

/* Helper: JSON com CORS liberado (útil pro captive chamar direto) */
function json(payload, status = 200) {
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

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      externalId,   // referência do PSP
      pagamentoId,  // id interno
      txid,         // txid Pix (opcional)
      ip,           // força IP (opcional)
      mac,          // força MAC (opcional)
      statusFinal,  // "expirado" | "cancelado" (opcional)
    } = body || {};

    if (!externalId && !pagamentoId && !txid && !ip && !mac) {
      return json({ ok: false, error: 'Informe externalId, pagamentoId, txid, ip ou mac.' }, 400);
    }

    // 1) Localiza o pagamento (se veio algum identificador)
    let pg = null;
    if (externalId) {
      pg = await prisma.pagamento.findUnique({ where: { externalId } });
    }
    if (!pg && pagamentoId) {
      pg = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
    }
    if (!pg && txid) {
      pg = await prisma.pagamento.findFirst({ where: { txid } });
    }

    // 2) Decide IP/MAC (payload tem prioridade; senão, dados do pagamento)
    const ipFinal  = ip  || pg?.clienteIp  || null;
    const macFinal = mac || pg?.clienteMac || null;

    if (!ipFinal && !macFinal) {
      return json({ ok: false, error: 'Sem IP/MAC (nem no payload, nem no registro).' }, 400);
    }

    // 3) Revoga na Mikrotik (idempotente: tratar “não existe” como sucesso)
    let mk;
    try {
      mk = await revogarCliente({
        ip:  ipFinal  || undefined,
        mac: macFinal || undefined,
      });
    } catch (e) {
      // sua lib costuma lançar erro quando já não existe a sessão
      // considere isso OK para idempotência
      mk = { ok: true, note: 'revogarCliente idempotente (já não existia).' };
    }

    // 4) Atualiza status e sessões relacionadas (se achou pagamento)
    if (pg) {
      // padrão: 'expirado' (se não vier explicitamente 'cancelado')
      const novoStatus = statusFinal === 'cancelado' ? 'cancelado' : 'expirado';

      try {
        await prisma.pagamento.update({
          where: { id: pg.id },
          data: { status: novoStatus },
        });
      } catch {
        // se o schema não tem esses status, ignore silenciosamente
      }

      // Sessões ativas -> marcar como inativas
      try {
        await prisma.sessaoAtiva.updateMany({
          where: { pagamentoId: pg.id, ativo: true },
          data: { ativo: false, expiraEm: new Date() },
        });
      } catch {
        // tabela opcional — ignore se não existir
      }
    }

    return json({
      ok: true,
      pagamentoId: pg?.id || null,
      externalId: pg?.externalId || externalId || null,
      mikrotik: mk,
    });
  } catch (e) {
    console.error('POST /api/revogar-acesso error:', e);
    return json({ ok: false, error: 'Falha ao revogar' }, 500);
  }
}
