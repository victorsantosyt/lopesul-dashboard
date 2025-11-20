#!/usr/bin/env node
/**
 * Script para zerar a receita do dashboard
 * 
 * Opções:
 * 1. Deletar pedidos antigos (antes de uma data)
 * 2. Marcar pedidos antigos como EXPIRED
 * 3. Deletar todos os pedidos pagos (CUIDADO!)
 * 
 * Uso:
 *   node zerar-receita-dashboard.js --data 2024-01-01  (deleta/marca pedidos antes desta data)
 *   node zerar-receita-dashboard.js --todos             (deleta TODOS os pedidos pagos - PERIGOSO!)
 *   node zerar-receita-dashboard.js --marcar-expired   (marca como EXPIRED em vez de deletar)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dataParam = args.find(arg => arg.startsWith('--data='))?.split('=')[1];
  const todos = args.includes('--todos');
  const marcarExpired = args.includes('--marcar-expired');

  if (!dataParam && !todos) {
    console.log('❌ Erro: Especifique uma opção:');
    console.log('   --data=YYYY-MM-DD  (deleta/marca pedidos antes desta data)');
    console.log('   --todos             (deleta TODOS os pedidos pagos - PERIGOSO!)');
    console.log('   --marcar-expired    (marca como EXPIRED em vez de deletar)');
    console.log('');
    console.log('Exemplos:');
    console.log('   node zerar-receita-dashboard.js --data=2024-12-01');
    console.log('   node zerar-receita-dashboard.js --data=2024-12-01 --marcar-expired');
    console.log('   node zerar-receita-dashboard.js --todos --marcar-expired');
    process.exit(1);
  }

  try {
    let whereClause = {};
    
    if (todos) {
      whereClause = { status: 'PAID' };
      console.log('⚠️  ATENÇÃO: Você está prestes a deletar/marcar TODOS os pedidos pagos!');
    } else if (dataParam) {
      const dataLimite = new Date(dataParam);
      if (isNaN(dataLimite.getTime())) {
        console.error('❌ Data inválida. Use formato YYYY-MM-DD');
        process.exit(1);
      }
      whereClause = {
        status: 'PAID',
        createdAt: { lt: dataLimite },
      };
      console.log(`📅 Processando pedidos pagos antes de ${dataParam}...`);
    }

    // Contar quantos pedidos serão afetados
    const count = await prisma.pedido.count({ where: whereClause });
    
    if (count === 0) {
      console.log('✅ Nenhum pedido encontrado para processar.');
      await prisma.$disconnect();
      return;
    }

    // Calcular receita total que será removida
    const receitaTotal = await prisma.pedido.aggregate({
      where: whereClause,
      _sum: { amount: true },
    });

    const receitaReais = (receitaTotal._sum?.amount || 0) / 100;

    console.log('');
    console.log('📊 Resumo:');
    console.log(`   Pedidos encontrados: ${count}`);
    console.log(`   Receita total: R$ ${receitaReais.toFixed(2)}`);
    console.log('');

    if (marcarExpired) {
      console.log('🔄 Marcando pedidos como EXPIRED...');
      const result = await prisma.pedido.updateMany({
        where: whereClause,
        data: { status: 'EXPIRED' },
      });
      console.log(`✅ ${result.count} pedidos marcados como EXPIRED.`);
      console.log('   (A receita não será mais contabilizada no dashboard)');
    } else {
      console.log('🗑️  Deletando pedidos...');
      
      // Deletar sessões ativas relacionadas primeiro
      const pedidosIds = await prisma.pedido.findMany({
        where: whereClause,
        select: { id: true },
      });
      
      if (pedidosIds.length > 0) {
        const pedidosIdsArray = pedidosIds.map(p => p.id);
        const sessoesDeletadas = await prisma.sessaoAtiva.deleteMany({
          where: { pedidoId: { in: pedidosIdsArray } },
        });
        console.log(`   ${sessoesDeletadas.count} sessões ativas deletadas.`);
      }
      
      // Deletar pedidos
      const result = await prisma.pedido.deleteMany({
        where: whereClause,
      });
      console.log(`✅ ${result.count} pedidos deletados.`);
    }

    console.log('');
    console.log('✅ Processo concluído!');
    console.log('   A receita no dashboard será recalculada na próxima atualização.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

