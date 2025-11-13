#!/usr/bin/env node
// worker-liberar-acesso.mjs
// Worker que processa pedidos PAID e libera acesso no MikroTik automaticamente

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

const RELAY_URL = process.env.RELAY_URL || process.env.RELAY_BASE || 'http://localhost:3001';
const RELAY_TOKEN = process.env.RELAY_TOKEN;
const CHECK_INTERVAL_MS = 5000; // Checa a cada 5 segundos

async function executeRelayCommand(sentences) {
  if (!RELAY_TOKEN) {
    throw new Error('RELAY_TOKEN não configurado');
  }

  const response = await fetch(`${RELAY_URL}/relay/exec2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RELAY_TOKEN}`
    },
    body: JSON.stringify({ sentences })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Relay HTTP ${response.status}: ${text}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || 'Comando falhou');
  }

  return result.data;
}

async function liberarAcessoMikrotik(pedido) {
  const { id, ip, deviceMac: mac } = pedido;
  
  console.log(`[Worker] Liberando acesso pedido ${id}:`, { ip, mac });

  try {
    // Adiciona IP no firewall
    if (ip) {
      const ipCmd = [
        '/ip/firewall/address-list/add',
        '=list=paid_clients',
        `=address=${ip}`,
        `=comment=pedido:${id}`
      ];
      console.log('[Worker] Executando:', ipCmd.join(' '));
      await executeRelayCommand(ipCmd);
      console.log('[Worker] ✅ IP adicionado:', ip);
    }

    // Adiciona MAC na access-list
    if (mac) {
      const macCmd = [
        '/interface/wireless/access-list/add',
        `=mac-address=${mac}`,
        `=comment=pedido:${id}`
      ];
      console.log('[Worker] Executando:', macCmd.join(' '));
      await executeRelayCommand(macCmd);
      console.log('[Worker] ✅ MAC adicionado:', mac);
    }

    return true;
  } catch (error) {
    console.error('[Worker] ❌ Erro ao liberar acesso:', error.message);
    throw error;
  }
}

async function processarPedidosPendentes() {
  try {
    // Busca pedidos PAID que ainda não foram processados
    const pedidos = await prisma.pedido.findMany({
      where: {
        status: 'PAID',
        processedAt: null, // Ainda não processado
        OR: [
          { ip: { not: null } },
          { deviceMac: { not: null } }
        ]
      },
      take: 10 // Processa até 10 por vez
    });

    if (pedidos.length === 0) {
      return; // Nada a fazer
    }

    console.log(`[Worker] 🔄 Processando ${pedidos.length} pedidos...`);

    for (const pedido of pedidos) {
      try {
        await liberarAcessoMikrotik(pedido);

        // Marca como processado
        await prisma.pedido.update({
          where: { id: pedido.id },
          data: { processedAt: new Date() }
        });

        console.log(`[Worker] ✅ Pedido ${pedido.id} processado com sucesso!`);
      } catch (error) {
        console.error(`[Worker] ❌ Falha ao processar pedido ${pedido.id}:`, error.message);
        // Continua processando os próximos
      }
    }
  } catch (error) {
    console.error('[Worker] ❌ Erro ao buscar pedidos:', error.message);
  }
}

async function main() {
  console.log('');
  console.log('==========================================');
  console.log('🚀 Worker de Liberação Automática');
  console.log('==========================================');
  console.log(`Relay: ${RELAY_URL}`);
  console.log(`Intervalo: ${CHECK_INTERVAL_MS}ms`);
  console.log('==========================================');
  console.log('');

  // Loop infinito
  while (true) {
    await processarPedidosPendentes();
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
  }
}

// Tratamento de sinais
process.on('SIGINT', async () => {
  console.log('\n[Worker] 🛑 Encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Worker] 🛑 Encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (error) => {
  console.error('[Worker] ❌ Erro fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
