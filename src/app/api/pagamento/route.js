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
    const { valor, descricao, payload, ip, mac, roteador } = await req.json();

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

    // Evita duplicar pagamento pendente
    const existente = await prisma.pagamento.findFirst({
      where: { valor: valorNum, descricao, status: 'pendente' },
      orderBy: { criadoEm: 'desc' },
    });

    if (existente) {
      return NextResponse.json({ success: true, pagamento: existente });
    }

    const pagamento = await prisma.pagamento.create({
      data: {
        valor: valorNum,
        descricao,
        chavePix: 'fsolucoes1@hotmail.com',
        payload: payload || null,
        plano: extrairPlano(descricao),
        status: 'pendente',
        ip: ip || null,
        mac: mac || null,
        roteador: roteador || null,
      },
    });

    return NextResponse.json({ success: true, pagamento });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao registrar pagamento' },
      { status: 500 }
    );
  }
}
