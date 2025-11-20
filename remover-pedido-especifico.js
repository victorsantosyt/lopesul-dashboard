#!/usr/bin/env node
/**
 * Script para remover/marcar pedido específico
 * 
 * Uso:
 *   node remover-pedido-especifico.js --valor=9.90 --data=2025-11-20
 *   node remover-pedido-especifico.js --valor=9.90 --data=2025-11-20 --marcar-expired
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const valorParam = args.find(arg => arg.startsWith('--valor='))?.split('=')[1];
  const dataParam = args.find(arg => arg.startsWith('--data='))?.split('=')[1] || '2025-11-20';
  const marcarExpired = args.includes('--marcar-expired');

  if (!valorParam) {
    console.log('❌ Erro: Especifique o valor do pedido:');
    console.log('   --valor=9.90  (valor em reais)');
    console.log('   --data=YYYY-MM-DD  (data do pedido, padrão: 2025-11-20)');
    console.log('   --marcar-expired  (marca como EXPIRED em vez de deletar)');
    console.log('');
    console.log('Exemplo:');
    console.log('   node remover-pedido-especifico.js --valor=9.90 --data=2025-11-20');
    process.exit(1);
  }

  const valorCentavos = Math.round(parseFloat(valorParam) * 100);

  try {
    const dataInicio = new Date(dataParam);
    dataInicio.setHours(0, 0, 0, 0);
    const dataFim = new Date(dataParam);
    dataFim.setHours(23, 59, 59, 999);

    console.log(`🔍 Buscando pedidos de R$ ${valorParam} criados em ${dataParam}...`);

    // Buscar pedidos com valor exato e data específica
    const pedidos = await prisma.pedido.findMany({
      where: {
        amount: valorCentavos,
        status: 'PAID',
        createdAt: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (pedidos.length === 0) {
      console.log('✅ Nenhum pedido encontrado com esses critérios.');
      await prisma.$disconnect();
      return;
    }

    console.log('');
    console.log(`📊 Encontrados ${pedidos.length} pedido(s):`);
    pedidos.forEach((p, i) => {
      console.log(`   ${i + 1}. ID: ${p.id}`);
      console.log(`      Code: ${p.code}`);
      console.log(`      Valor: R$ ${(p.amount / 100).toFixed(2)}`);
      console.log(`      Criado em: ${p.createdAt.toISOString()}`);
      console.log(`      IP: ${p.ip || 'N/A'}`);
      console.log(`      MAC: ${p.deviceMac || 'N/A'}`);
      console.log('');
    });

    if (marcarExpired) {
      console.log('🔄 Marcando pedidos como EXPIRED...');
      for (const pedido of pedidos) {
        await prisma.pedido.update({
          where: { id: pedido.id },
          data: { status: 'EXPIRED' },
        });
        console.log(`   ✅ Pedido ${pedido.code} marcado como EXPIRED`);
      }
      console.log('');
      console.log('✅ Processo concluído!');
      console.log('   A receita no dashboard será recalculada na próxima atualização.');
    } else {
      console.log('🗑️  Deletando pedidos...');
      for (const pedido of pedidos) {
        // Deletar sessões ativas relacionadas
        await prisma.sessaoAtiva.deleteMany({
          where: { pedidoId: pedido.id },
        });
        
        // Deletar pedido
        await prisma.pedido.delete({
          where: { id: pedido.id },
        });
        console.log(`   ✅ Pedido ${pedido.code} deletado`);
      }
      console.log('');
      console.log('✅ Processo concluído!');
      console.log('   A receita no dashboard será recalculada na próxima atualização.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

