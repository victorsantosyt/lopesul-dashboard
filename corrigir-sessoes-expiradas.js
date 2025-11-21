#!/usr/bin/env node
// Script para corrigir sessões marcadas como ativas mas já expiradas
// Uso: node corrigir-sessoes-expiradas.js [--dry-run]

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

function formatarData(data) {
  if (!data) return 'N/A';
  const d = new Date(data);
  return d.toLocaleString('pt-BR');
}

async function main() {
  try {
    const agora = new Date();

    console.log('🔍 Procurando sessões expiradas mas marcadas como ativas...');
    if (DRY_RUN) {
      console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita');
    }
    console.log('');

    const sessoesExpiradas = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        expiraEm: { lt: agora },
      },
      include: {
        pedido: {
          select: {
            code: true,
            customerName: true,
            status: true,
          },
        },
      },
      orderBy: { expiraEm: 'desc' },
    });

    if (sessoesExpiradas.length === 0) {
      console.log('✅ Nenhuma sessão expirada encontrada!');
      return;
    }

    console.log(`⚠️  ${sessoesExpiradas.length} sessão(ões) expirada(s) mas marcada(s) como ativa:`);
    console.log('');

    for (const sessao of sessoesExpiradas) {
      const minutosExpirados = Math.floor((agora - sessao.expiraEm) / 60000);
      const horasExpiradas = Math.floor(minutosExpirados / 60);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 Sessão ID: ${sessao.id}`);
      console.log(`   IP: ${sessao.ipCliente}`);
      console.log(`   MAC: ${sessao.macCliente || 'N/A'}`);
      console.log(`   Plano: ${sessao.plano || 'N/A'}`);
      console.log(`   Início: ${formatarData(sessao.inicioEm)}`);
      console.log(`   Expira: ${formatarData(sessao.expiraEm)}`);
      console.log(`   ⏰ Expirada há: ${horasExpiradas}h (${minutosExpirados} min)`);
      console.log(`   Status atual: ${sessao.ativo ? '✅ ATIVA (INCORRETO)' : '❌ INATIVA'}`);

      if (sessao.pedido) {
        console.log(`   Pedido: ${sessao.pedido.code}`);
        console.log(`   Cliente: ${sessao.pedido.customerName || 'N/A'}`);
        console.log(`   Status do pedido: ${sessao.pedido.status}`);
      }

      if (!DRY_RUN) {
        try {
          await prisma.sessaoAtiva.update({
            where: { id: sessao.id },
            data: { ativo: false },
          });
          console.log(`   ✅ Corrigido: marcado como INATIVA`);
        } catch (error) {
          console.log(`   ❌ Erro ao corrigir: ${error.message}`);
        }
      } else {
        console.log(`   🔍 Seria marcado como INATIVA (dry-run)`);
      }
      console.log('');
    }

    if (!DRY_RUN) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ ${sessoesExpiradas.length} sessão(ões) corrigida(s)!`);
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Para aplicar as correções, execute sem --dry-run:');
      console.log('   node corrigir-sessoes-expiradas.js');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

