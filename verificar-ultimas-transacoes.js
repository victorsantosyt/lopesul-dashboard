#!/usr/bin/env node
// Script para verificar as últimas transações e seus status
// Uso: node verificar-ultimas-transacoes.js [limite]

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

async function main() {
  try {
    const limite = parseInt(process.argv[2] || '20');
    
    console.log('🔍 Verificando últimas transações...');
    console.log(`   Limite: ${limite}`);
    console.log('');

    // Buscar últimas transações
    const pedidos = await prisma.pedido.findMany({
      orderBy: { createdAt: 'desc' },
      take: limite,
      include: {
        device: {
          select: {
            id: true,
            mikId: true,
            ip: true,
          },
        },
        SessaoAtiva: {
          select: {
            id: true,
            ativo: true,
            expiraEm: true,
            ipCliente: true,
            macCliente: true,
          },
          orderBy: { inicioEm: 'desc' },
          take: 1,
        },
      },
    });

    if (pedidos.length === 0) {
      console.log('⚠️  Nenhuma transação encontrada');
      return;
    }

    console.log(`✅ ${pedidos.length} transação(ões) encontrada(s):`);
    console.log('');

    for (const pedido of pedidos) {
      const sessao = pedido.SessaoAtiva?.[0];
      const agora = new Date();
      const expirada = sessao ? sessao.expiraEm < agora : false;
      const ativa = sessao ? sessao.ativo && !expirada : false;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 Pedido: ${pedido.code}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   ID: ${pedido.id}`);
      console.log(`   Status: ${pedido.status}`);
      console.log(`   Valor: R$ ${((pedido.amount || 0) / 100).toFixed(2)}`);
      console.log(`   Método: ${pedido.method || 'N/A'}`);
      console.log(`   Descrição: ${pedido.description || 'N/A'}`);
      console.log(`   Cliente: ${pedido.customerName || 'N/A'}`);
      console.log(`   CPF/CNPJ: ${pedido.customerDoc || 'N/A'}`);
      console.log(`   IP: ${pedido.ip || 'N/A'}`);
      console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
      console.log(`   Criado em: ${pedido.createdAt.toISOString()}`);
      console.log('');
      
      if (pedido.device) {
        console.log(`   📱 Dispositivo:`);
        console.log(`      ID: ${pedido.device.id}`);
        console.log(`      MikId: ${pedido.device.mikId || 'N/A'}`);
        console.log(`      IP: ${pedido.device.ip || 'N/A'}`);
        console.log('');
      }
      
      if (sessao) {
        console.log(`   🔐 Sessão Ativa:`);
        console.log(`      ID: ${sessao.id}`);
        console.log(`      IP: ${sessao.ipCliente}`);
        console.log(`      MAC: ${sessao.macCliente || 'N/A'}`);
        console.log(`      Ativo (banco): ${sessao.ativo ? 'Sim' : 'Não'}`);
        console.log(`      Expira em: ${sessao.expiraEm.toISOString()}`);
        console.log(`      Status: ${ativa ? '✅ ATIVA' : expirada ? '⏰ EXPIRADA' : '❌ INATIVA'}`);
        if (!expirada && sessao.ativo) {
          const minutosRestantes = Math.floor((sessao.expiraEm - agora) / 60000);
          console.log(`      Minutos restantes: ${minutosRestantes} min`);
        }
      } else {
        console.log(`   ⚠️  Nenhuma sessão ativa encontrada`);
      }
      console.log('');

      // Verificar se há problemas
      const problemas = [];
      if (pedido.status === 'PAID' && !sessao) {
        problemas.push('❌ Pedido pago mas sem sessão ativa');
      }
      if (pedido.status === 'PAID' && sessao && !ativa) {
        problemas.push('❌ Pedido pago mas sessão inativa/expirada');
      }
      if (pedido.status === 'PAID' && !pedido.ip && !pedido.deviceMac) {
        problemas.push('⚠️  Pedido pago mas sem IP/MAC');
      }
      if (pedido.status === 'PENDING' && pedido.createdAt < new Date(Date.now() - 30 * 60 * 1000)) {
        problemas.push('⚠️  Pedido pendente há mais de 30 minutos');
      }

      if (problemas.length > 0) {
        console.log(`   🚨 PROBLEMAS:`);
        problemas.forEach(p => console.log(`      ${p}`));
        console.log('');
      }
    }

    // Resumo
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const pagos = pedidos.filter(p => p.status === 'PAID');
    const pendentes = pedidos.filter(p => p.status === 'PENDING');
    const expirados = pedidos.filter(p => p.status === 'EXPIRED');
    const pagosComSessao = pagos.filter(p => p.SessaoAtiva && p.SessaoAtiva.length > 0);
    const pagosSemSessao = pagos.filter(p => !p.SessaoAtiva || p.SessaoAtiva.length === 0);
    
    console.log(`   Total: ${pedidos.length}`);
    console.log(`   Pagos: ${pagos.length}`);
    console.log(`   Pendentes: ${pendentes.length}`);
    console.log(`   Expirados: ${expirados.length}`);
    console.log(`   Pagos com sessão: ${pagosComSessao.length}`);
    console.log(`   Pagos sem sessão: ${pagosSemSessao.length} ${pagosSemSessao.length > 0 ? '⚠️' : ''}`);
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

