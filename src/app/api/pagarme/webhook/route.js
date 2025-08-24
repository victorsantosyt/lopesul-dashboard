import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getProvider } from '@/lib/psp';
import { liberarClienteNoMikrotik } from '@/lib/mikrotik-actions';

// Opcional: se você for validar HMAC em breve, descomente a captura do rawBody e passe para o adapter
export async function POST(req) {
  try {
    // --- Validação de assinatura (deixa pronto p/ futuro) ---
    // const raw = Buffer.from(await req.arrayBuffer());
    // const ok = getProvider().validarAssinaturaWebhook({ raw, headers: req.headers });
    // if (!ok) return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });

    // --- Payload ---
    const evento = await req.json().catch(() => null);
    if (!evento) return NextResponse.json({ error: 'payload inválido' }, { status: 400 });

    const { externalId, status } = getProvider().normalizarEventoWebhook(evento);
    if (!externalId) {
      // Webhooks podem chegar com eventos que não te interessam; 200 evita reentrega em loop
      return NextResponse.json({ ok: true });
    }

    // --- Busca pagamento por externalId (chave do PSP)
    const pagamento = await prisma.pagamento.findUnique({
      where: { externalId }, // externalId é @unique no schema
      select: {
        id: true,
        status: true,
        clienteIp: true,
        clienteMac: true,
      },
    });

    if (!pagamento) {
      // Pode acontecer de webhook chegar antes do create (latência); responda 200 e logue.
      console.warn('[webhook] pagamento não encontrado para externalId:', externalId);
      return NextResponse.json({ ok: true });
    }

    // --- Normaliza status vindo do PSP para o nosso domínio
    const s = String(status || '').toLowerCase();
    let novoStatus = null;

    if (s.includes('paid') || s === 'pago' || s === 'approved') novoStatus = 'pago';
    else if (s.includes('expired') || s === 'expirado') novoStatus = 'expirado';
    else if (s.includes('canceled') || s === 'cancelado' || s === 'refused') novoStatus = 'cancelado';

    if (!novoStatus) {
      // Evento não muda estado relevante → nada a fazer
      return NextResponse.json({ ok: true });
    }

    // --- Idempotência: se já está no estado final, não repita efeitos colaterais
    if (pagamento.status === novoStatus) {
      return NextResponse.json({ ok: true });
    }

    // --- Atualiza status
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        status: novoStatus,
        // Se você adicionar paidAt no schema, já deixa pronto:
        // ...(novoStatus === 'pago' ? { paidAt: new Date() } : {}),
      },
    });

    // --- Efeito colateral somente quando for "pago"
    if (novoStatus === 'pago') {
      try {
        await liberarClienteNoMikrotik({
          ip: pagamento.clienteIp || undefined,
          mac: pagamento.clienteMac || undefined,
        });
      } catch (e) {
        // Não falhe o webhook por causa do Mikrotik; logue para retry manual
        console.error('[webhook] erro ao liberar Mikrotik:', e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[webhook] erro inesperado:', e);
    return NextResponse.json({ error: 'Erro no webhook' }, { status: 500 });
  }
}
