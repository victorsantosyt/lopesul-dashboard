#!/usr/bin/env node
// Script para limpar pedidos pendentes antigos sem charge
// Uso: node limpar-pedidos-pendentes-antigos.js [--horas=24] [--dry-run]

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

const DRY_RUN = process.argv.includes('--dry-run');
const horasArg = process.argv.find(arg => arg.startsWith('--horas='));
const horas = horasArg ? parseInt(horasArg.split('=')[1]) : 24;

function formatarData(data) {
  if (!data) return 'N/A';
  const d = new Date(data);
  return d.toLocaleString('pt-BR');
}

async function main() {
  try {
    const agora = new Date();
    const limite = new Date(agora.getTime() - horas * 60 * 60 * 1000);

    console.log(`🔍 Procurando pedidos pendentes sem charge criados há mais de ${horas}h...`);
    if (DRY_RUN) {
      console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita');
    }
    console.log('');

    // Buscar pedidos pendentes sem charge e antigos
    const pedidos = await prisma.pedido.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: limite },
      },
      include: {
        charges: true,
      },
    });

    // Filtrar apenas os que não têm charge
    const pedidosSemCharge = pedidos.filter(p => !p.charges || p.charges.length === 0);

    if (pedidosSemCharge.length === 0) {
      console.log(`✅ Nenhum pedido pendente sem charge encontrado (mais de ${horas}h)`);
      return;
    }

    console.log(`⚠️  ${pedidosSemCharge.length} pedido(s) pendente(s) sem charge encontrado(s):`);
    console.log('');

    for (const pedido of pedidosSemCharge) {
      const horasAtras = Math.floor((agora - pedido.createdAt) / (60 * 60 * 1000));
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 Pedido: ${pedido.code}`);
      console.log(`   ID: ${pedido.id}`);
      console.log(`   Criado: ${formatarData(pedido.createdAt)} (${horasAtras}h atrás)`);
      console.log(`   Cliente: ${pedido.customerName || 'N/A'}`);
      console.log(`   IP: ${pedido.ip || 'N/A'}`);
      console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
      console.log(`   ⚠️  Sem charge (QR Code nunca foi gerado)`);

      // Verificar se há sessão ativa
      const sessao = await prisma.sessaoAtiva.findFirst({
        where: {
          pedidoId: pedido.id,
        },
      });

      if (sessao) {
        console.log(`   ⚠️  ATENÇÃO: Tem sessão ativa associada!`);
        console.log(`      Sessão ID: ${sessao.id}`);
        console.log(`      IP: ${sessao.ipCliente}`);
      }

      if (!DRY_RUN) {
        try {
          // Marcar como EXPIRED ao invés de deletar (mais seguro)
          await prisma.pedido.update({
            where: { id: pedido.id },
            data: { status: 'EXPIRED' },
          });
          console.log(`   ✅ Marcado como EXPIRED`);
        } catch (error) {
          console.log(`   ❌ Erro ao atualizar: ${error.message}`);
        }
      } else {
        console.log(`   🔍 Seria marcado como EXPIRED (dry-run)`);
      }
      console.log('');
    }

    if (!DRY_RUN) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ ${pedidosSemCharge.length} pedido(s) marcado(s) como EXPIRED!`);
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Para aplicar as correções, execute sem --dry-run:');
      console.log(`   node limpar-pedidos-pendentes-antigos.js --horas=${horas}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

