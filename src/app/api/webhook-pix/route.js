// src/app/api/pix-webhook/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function corsJson(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',           // ajuste para o seu domínio se quiser
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function OPTIONS() {
  return corsJson({});
}

function normalizarStatus(s) {
  if (!s) return 'pendente';
  const t = String(s).trim().toLowerCase();
  if (['pago', 'aprovado', 'approved', 'paid', 'confirmado', 'concluido'].includes(t)) return 'pago';
  if (['expirado', 'expired', 'cancelado', 'canceled', 'falhou', 'failed'].includes(t)) return 'expirado';
  return 'pendente';
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Ajuste os nomes conforme o PSP real que você usar:
    const {
      valor,           // "10.00" (string) ou number
      status,          // "PAGO" | "APROVADO" | ...
      referencia,      // id/txid que você enviou na criação da cobrança
      txid,            // alguns PSPs mandam como txid
      chavePix,        // sua chave
      dataHora,        // ISO ou epoch
    } = body || {};

    const statusNorm = normalizarStatus(status);

    // 1) Prioridade: achar pelo ID que você conhece (referencia/txid = pagamento.id)
    let pagamento = null;

    if (referencia) {
      pagamento = await prisma.pagamento.findUnique({ where: { id: referencia } }).catch(() => null);
    }
    if (!pagamento && txid) {
      pagamento = await prisma.pagamento.findUnique({ where: { id: txid } }).catch(() => null);
    }

    // 2) Fallback: procurar por valor + chavePix + status pendente (menos seguro; só se faltar id)
    if (!pagamento && (valor != null || chavePix)) {
      const valorNum = valor != null ? Number(String(valor).replace(',', '.')) : undefined;
      pagamento = await prisma.pagamento.findFirst({
        where: {
          ...(valorNum != null ? { valor: valorNum } : {}),
          ...(chavePix ? { chavePix } : {}),
          status: 'pendente',
        },
        orderBy: { criadoEm: 'desc' },
      });
    }

    if (!pagamento) {
      // Não encontrou — ignore com 200 para o PSP não reenfileirar eternamente
      return corsJson({ ok: true, ignored: true, reason: 'pagamento não encontrado' });
    }

    if (statusNorm === 'pago') {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          status: 'pago',
          pagoEm: dataHora ? new Date(dataHora) : new Date(),
        },
      });
      console.log(`✅ Pagamento confirmado via webhook: ${pagamento.id}`);
    } else if (statusNorm === 'expirado') {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: 'expirado' },
      });
      console.log(`⌛ Pagamento expirado via webhook: ${pagamento.id}`);
    } else {
      // outros estados — apenas aceite para não reprocessar
      console.log(`ℹ️ Webhook ignorado (status=${status}) para pagamento: ${pagamento.id}`);
    }

    return corsJson({ ok: true });
  } catch (error) {
    console.error('Erro no webhook Pix:', error);
    return corsJson({ error: 'Erro interno' }, 500);
  }
}
