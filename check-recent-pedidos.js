#!/usr/bin/env node
/**
 * Script para verificar pedidos recentes no banco de dados
 * Uso: node check-recent-pedidos.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const pedidos = await prisma.pedido.findMany({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
      include: {
        device: {
          select: {
            id: true,
            nome: true,
            mikId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    console.log('\n📦 Pedidos criados na última hora:\n');
    console.log('─'.repeat(100));
    
    if (pedidos.length === 0) {
      console.log('Nenhum pedido encontrado na última hora.');
    } else {
      pedidos.forEach((pedido, index) => {
        console.log(`\n${index + 1}. Pedido ID: ${pedido.id}`);
        console.log(`   Code: ${pedido.code || '(sem code)'}`);
        console.log(`   Status: ${pedido.status}`);
        console.log(`   Device ID: ${pedido.deviceId || '(sem deviceId)'}`);
        console.log(`   Device Identifier: ${pedido.deviceIdentifier || '(sem identifier)'}`);
        console.log(`   IP: ${pedido.ip || '(sem IP)'}`);
        console.log(`   MAC: ${pedido.mac || '(sem MAC)'}`);
        console.log(`   Device: ${pedido.device ? `${pedido.device.nome} (mikId: ${pedido.device.mikId || 'N/A'})` : '(sem device)'}`);
        console.log(`   Criado em: ${pedido.createdAt.toISOString()}`);
        console.log('─'.repeat(100));
      });
    }

    // Também verificar pedidos PAID ou PENDING
    const paidOrPending = await prisma.pedido.findMany({
      where: {
        status: {
          in: ['PAID', 'PENDING'],
        },
      },
      include: {
        device: {
          select: {
            id: true,
            nome: true,
            mikId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    if (paidOrPending.length > 0) {
      console.log('\n\n💰 Pedidos PAID ou PENDING (últimos 5):\n');
      console.log('─'.repeat(100));
      paidOrPending.forEach((pedido, index) => {
        console.log(`\n${index + 1}. Pedido ID: ${pedido.id}`);
        console.log(`   Code: ${pedido.code || '(sem code)'}`);
        console.log(`   Status: ${pedido.status}`);
        console.log(`   Device ID: ${pedido.deviceId || '(sem deviceId)'}`);
        console.log(`   Device: ${pedido.device ? `${pedido.device.nome} (mikId: ${pedido.device.mikId || 'N/A'})` : '(sem device)'}`);
        console.log(`   IP: ${pedido.ip || '(sem IP)'}`);
        console.log(`   MAC: ${pedido.mac || '(sem MAC)'}`);
        console.log(`   Criado em: ${pedido.createdAt.toISOString()}`);
        console.log('─'.repeat(100));
      });
    }
  } catch (error) {
    console.error('❌ Erro ao consultar pedidos:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

