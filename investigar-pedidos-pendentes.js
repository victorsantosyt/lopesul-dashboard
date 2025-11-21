#!/usr/bin/env node
// Script para investigar pedidos pendentes
// Uso: node investigar-pedidos-pendentes.js

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env
const envPath = join(__dirname, '.env');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch (e) {
  console.error('❌ Erro ao ler .env:', e.message);
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
});

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

function formatarData(data) {
  if (!data) return 'N/A';
  const d = new Date(data);
  return d.toLocaleString('pt-BR');
}

function formatarValor(centavos) {
  return `R$ ${((centavos || 0) / 100).toFixed(2)}`;
}

async function main() {
  try {
    const agora = new Date();
    const ultimas24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    console.log('🔍 Investigando pedidos pendentes (últimas 24h)...');
    console.log('');

    const pedidosPendentes = await prisma.pedido.findMany({
      where: {
        status: 'PENDING',
        createdAt: { gte: ultimas24h },
      },
      include: {
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pedidosPendentes.length === 0) {
      console.log('✅ Nenhum pedido pendente nas últimas 24h!');
      return;
    }

    console.log(`⚠️  ${pedidosPendentes.length} pedido(s) pendente(s) encontrado(s):`);
    console.log('');

    for (const pedido of pedidosPendentes) {
      const charge = pedido.charges?.[0];
      const minutosAtras = Math.floor((agora - pedido.createdAt) / 60000);
      const horasAtras = Math.floor(minutosAtras / 60);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 Pedido: ${pedido.code}`);
      console.log(`   ID: ${pedido.id}`);
      console.log(`   Status: ${pedido.status}`);
      console.log(`   Valor: ${formatarValor(pedido.amount)}`);
      console.log(`   Criado: ${formatarData(pedido.createdAt)} (${horasAtras}h atrás)`);
      console.log(`   Cliente: ${pedido.customerName || 'N/A'}`);
      console.log(`   IP: ${pedido.ip || 'N/A'}`);
      console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);

      if (charge) {
        console.log(`   Charge ID: ${charge.id}`);
        console.log(`   Charge Status: ${charge.status}`);
        console.log(`   Charge Criado: ${formatarData(charge.createdAt)}`);
        if (charge.qrCode) {
          console.log(`   ✅ QR Code gerado`);
        } else {
          console.log(`   ⚠️  QR Code não gerado`);
        }
      } else {
        console.log(`   ⚠️  Nenhuma charge associada`);
      }

      // Verificar se há sessão ativa para este pedido
      const sessao = await prisma.sessaoAtiva.findFirst({
        where: {
          pedidoId: pedido.id,
        },
      });

      if (sessao) {
        console.log(`   ⚠️  ATENÇÃO: Já existe sessão ativa para este pedido pendente!`);
        console.log(`      Sessão ID: ${sessao.id}`);
        console.log(`      IP: ${sessao.ipCliente}`);
        console.log(`      Ativo: ${sessao.ativo ? 'Sim' : 'Não'}`);
      }

      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 Análise:');
    console.log('');
    console.log('   Pedidos pendentes podem ser:');
    console.log('   1. Cliente gerou QR Code mas ainda não pagou');
    console.log('   2. Pagamento em processamento (aguardando confirmação)');
    console.log('   3. QR Code expirado (precisa gerar novo)');
    console.log('   4. Cliente abandonou o checkout');
    console.log('');
    console.log('   ⚠️  Se o pedido está pendente há mais de 2 horas, pode ser:');
    console.log('      - Cliente não pagou e esqueceu');
    console.log('      - QR Code expirou');
    console.log('      - Problema no webhook do Pagar.me');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
