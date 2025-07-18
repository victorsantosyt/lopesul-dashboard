import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { valor, descricao, payload } = await req.json();

    if (!valor || !descricao) {
      return NextResponse.json({ error: 'Valor e descrição são obrigatórios' }, { status: 400 });
    }

    // Busca o pagamento no banco
    const pagamento = await prisma.pagamento.findFirst({
      where: {
        valor: parseFloat(valor),
        descricao: descricao,
        status: 'pago'
      }
    });

    if (pagamento) {
      return NextResponse.json({ 
        pago: true, 
        pagamentoId: pagamento.id,
        plano: pagamento.plano 
      });
    }

    // Se não encontrou como pago, verifica se existe como pendente
    const pagamentoPendente = await prisma.pagamento.findFirst({
      where: {
        valor: parseFloat(valor),
        descricao: descricao,
        status: 'pendente'
      }
    });

    if (!pagamentoPendente && payload) {
      // Cria o registro de pagamento pendente se não existir
      await prisma.pagamento.create({
        data: {
          valor: parseFloat(valor),
          descricao: descricao,
          chavePix: "fsolucoes1@hotmail.com",
          payload: payload,
          plano: extrairPlano(descricao),
          status: 'pendente'
        }
      });
    }

    return NextResponse.json({ pago: false });

  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// Função auxiliar para extrair o plano da descrição
function extrairPlano(descricao) {
  if (descricao.includes('12h')) return '12h';
  if (descricao.includes('24h')) return '24h';
  if (descricao.includes('48h')) return '48h';
  return '12h'; // padrão
}