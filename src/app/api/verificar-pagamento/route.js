import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function extrairPlano(descricao = '') {
  const d = (descricao || '').toLowerCase();
  if (d.includes('12h')) return '12h';
  if (d.includes('24h')) return '24h';
  if (d.includes('48h')) return '48h';
  return '12h';
}

export async function POST(req) {
  try {
    const { valor, descricao, payload } = await req.json();

    if (valor == null || !descricao) {
      return NextResponse.json(
        { error: 'Valor e descrição são obrigatórios' },
        { status: 400 }
      );
    }

    const valorNum = Number(valor);
    if (Number.isNaN(valorNum)) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
    }

    // 1) Busca como "pago"
    const pago = await prisma.pagamento.findFirst({
      where: { valor: valorNum, descricao, status: 'pago' },
      orderBy: { criadoEm: 'desc' },
    });

    if (pago) {
      return NextResponse.json({
        pago: true,
        pagamentoId: pago.id,
        plano: pago.plano,
      });
    }

    // 2) Busca como "pendente"
    const pendente = await prisma.pagamento.findFirst({
      where: { valor: valorNum, descricao, status: 'pendente' },
      orderBy: { criadoEm: 'desc' },
    });

    // 3) Se não existir pendente e tiver payload → cria um
    if (!pendente && payload) {
      await prisma.pagamento.create({
        data: {
          valor: valorNum,
          descricao,
          chavePix: 'fsolucoes1@hotmail.com',
          payload,
          plano: extrairPlano(descricao),
          status: 'pendente',
        },
      });
    }

    return NextResponse.json({ pago: false });
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
