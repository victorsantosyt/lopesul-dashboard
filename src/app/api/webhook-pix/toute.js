import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Exemplo de payload de webhook (ajuste conforme seu gateway)
    const { 
      valor, 
      status, 
      referencia, 
      chavePix,
      dataHora 
    } = body;

    if (status === 'APROVADO' || status === 'PAGO') {
      // Busca o pagamento pendente
      const pagamento = await prisma.pagamento.findFirst({
        where: {
          valor: parseFloat(valor),
          chavePix: chavePix,
          status: 'pendente'
        }
      });

      if (pagamento) {
        // Atualiza o status para pago
        await prisma.pagamento.update({
          where: { id: pagamento.id },
          data: {
            status: 'pago',
            pagoEm: new Date(dataHora || Date.now())
          }
        });

        console.log(`✅ Pagamento confirmado via webhook: ${pagamento.id}`);
      }
    }

    return NextResponse.json({ recebido: true });

  } catch (error) {
    console.error('Erro no webhook Pix:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}