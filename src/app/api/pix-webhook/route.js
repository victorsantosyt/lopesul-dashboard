import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function isValidSecret(req) {
  const got = req.headers.get('x-webhook-secret') || req.headers.get('x-pix-secret');
  return got && got === process.env.PIX_WEBHOOK_SECRET;
}

// Utilitário: tenta achar pagamento pelo melhor critério disponível
async function findPagamento({ valorNum, descricao, payload }) {
  // 1) Tenta com payload (mais específico, se o PSP te devolve o mesmo payload)
  if (payload) {
    const byPayload = await prisma.pagamento.findFirst({
      where: { valor: valorNum, descricao, payload },
      orderBy: { criadoEm: 'desc' },
    });
    if (byPayload) return byPayload;
  }

  // 2) Cai no valor + descricao (critério que você já usa)
  const byVD = await prisma.pagamento.findFirst({
    where: { valor: valorNum, descricao },
    orderBy: { criadoEm: 'desc' },
  });
  return byVD;
}

export async function POST(req) {
  try {
    // 🔐 Segurança simples via header secreto
    if (!isValidSecret(req)) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    // Esperado do PSP (ajuste conforme seu banco):
    // { valor, descricao, payload, status, horario, txid, e2eid, ... }
    const { valor, descricao, payload, status } = body;

    if (valor == null || !descricao) {
      return NextResponse.json(
        { ok: false, error: 'valor e descricao obrigatórios' },
        { status: 400 }
      );
    }

    const valorNum = Number(valor);
    if (Number.isNaN(valorNum)) {
      return NextResponse.json({ ok: false, error: 'valor inválido' }, { status: 400 });
    }

    // Localiza o pagamento
    const pagamento = await findPagamento({ valorNum, descricao, payload });

    if (!pagamento) {
      // Se não achou, opcionalmente você pode CRIAR um “pago” novo OU apenas logar e retornar 202.
      // Aqui vamos só aceitar para não quebrar o webhook e você investiga pelo log:
      console.warn('[pix-webhook] Pagamento não encontrado para', { valorNum, descricao, payload });
      return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
    }

    // Idempotência: se já estiver pago, não faz nada
    if (pagamento.status === 'pago') {
      return NextResponse.json({ ok: true, id: pagamento.id, alreadyPaid: true });
    }

    // Se o PSP mandar um status explícito e não for “pago”, você pode tratar diferente.
    // Aqui vamos marcar como pago independentemente de "status" recebido (ajuste se quiser).
    const updated = await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { status: 'pago', pagoEm: new Date() },
    });

    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  } catch (err) {
    console.error('[pix-webhook] erro:', err);
    return NextResponse.json({ ok: false, error: 'erro interno' }, { status: 500 });
  }
}
