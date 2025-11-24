#!/usr/bin/env node
// Script para investigar pedido que aparece como expirado incorretamente
// Uso: node investigar-pedido-expirado.js [IP ou MAC ou código do pedido]

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
    const busca = process.argv[2];
    
    if (!busca) {
      console.log('📋 Uso: node investigar-pedido-expirado.js [IP ou MAC ou código do pedido]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node investigar-pedido-expirado.js 192.168.88.54');
      console.log('   node investigar-pedido-expirado.js CE:AE:67:5D:39:13');
      console.log('   node investigar-pedido-expirado.js Maria');
      process.exit(1);
    }

    console.log('🔍 Investigando pedido expirado...');
    console.log(`   Busca: ${busca}`);
    console.log('');

    // Buscar pedidos relacionados
    const pedidos = await prisma.pedido.findMany({
      where: {
        OR: [
          { ip: busca },
          { deviceMac: { contains: busca, mode: 'insensitive' } },
          { code: { contains: busca, mode: 'insensitive' } },
          { customerName: { contains: busca, mode: 'insensitive' } },
        ],
      },
      include: {
        SessaoAtiva: {
          orderBy: { inicioEm: 'desc' },
          take: 5,
        },
        device: {
          select: {
            id: true,
            mikId: true,
            ip: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (pedidos.length === 0) {
      console.log('❌ Nenhum pedido encontrado!');
      return;
    }

    console.log(`✅ ${pedidos.length} pedido(s) encontrado(s):`);
    console.log('');

    for (const pedido of pedidos) {
      const agora = new Date();
      const sessaoMaisRecente = pedidos[0].SessaoAtiva?.[0];
      const expirada = sessaoMaisRecente ? sessaoMaisRecente.expiraEm < agora : false;
      const ativa = sessaoMaisRecente ? sessaoMaisRecente.ativo && !expirada : false;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 Pedido: ${pedido.code}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   ID: ${pedido.id}`);
      console.log(`   Status: ${pedido.status}`);
      console.log(`   Valor: R$ ${((pedido.amount || 0) / 100).toFixed(2)}`);
      console.log(`   Descrição: ${pedido.description || 'N/A'}`);
      console.log(`   Cliente: ${pedido.customerName || 'N/A'}`);
      console.log(`   CPF/CNPJ: ${pedido.customerDoc || 'N/A'}`);
      console.log(`   IP: ${pedido.ip || 'N/A'}`);
      console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
      console.log(`   Criado em: ${pedido.createdAt.toISOString()}`);
      console.log('');
      
      if (pedido.SessaoAtiva && pedido.SessaoAtiva.length > 0) {
        console.log(`   🔐 ${pedido.SessaoAtiva.length} sessão(ões) encontrada(s):`);
        pedido.SessaoAtiva.forEach((s, idx) => {
          const expiradaSessao = s.expiraEm < agora;
          const ativaSessao = s.ativo && !expiradaSessao;
          const minutosRestantes = expiradaSessao ? 0 : Math.floor((s.expiraEm - agora) / 60000);
          
          console.log(`   ${idx + 1}. Sessão ID: ${s.id}`);
          console.log(`      IP: ${s.ipCliente}`);
          console.log(`      MAC: ${s.macCliente || 'N/A'}`);
          console.log(`      Ativo (banco): ${s.ativo ? 'Sim' : 'Não'}`);
          console.log(`      Início: ${s.inicioEm.toISOString()}`);
          console.log(`      Expira: ${s.expiraEm.toISOString()}`);
          console.log(`      Status: ${ativaSessao ? '✅ ATIVA' : expiradaSessao ? '⏰ EXPIRADA' : '❌ INATIVA'}`);
          if (!expiradaSessao && s.ativo) {
            console.log(`      Minutos restantes: ${minutosRestantes} min`);
          } else if (expiradaSessao) {
            const minutosExpirados = Math.floor((agora - s.expiraEm) / 60000);
            console.log(`      Expirado há: ${minutosExpirados} minutos`);
          }
          console.log('');
        });
      } else {
        console.log('   ⚠️  Nenhuma sessão ativa encontrada');
        console.log('');
      }

      // Verificar problemas
      const problemas = [];
      if (pedido.status === 'PAID' && !sessaoMaisRecente) {
        problemas.push('❌ Pedido pago mas sem sessão ativa');
      }
      if (pedido.status === 'PAID' && sessaoMaisRecente && !ativa) {
        problemas.push('❌ Pedido pago mas sessão inativa/expirada');
      }
      if (pedido.status === 'EXPIRED' && pedido.description?.includes('12h')) {
        // Verificar se foi criado há menos de 12 horas
        const horasDesdeCriacao = (agora - pedido.createdAt) / (1000 * 60 * 60);
        if (horasDesdeCriacao < 12) {
          problemas.push(`⚠️  Pedido marcado como EXPIRED mas foi criado há apenas ${horasDesdeCriacao.toFixed(1)} horas (deveria ter 12h de acesso)`);
        }
      }

      if (problemas.length > 0) {
        console.log(`   🚨 PROBLEMAS:`);
        problemas.forEach(p => console.log(`      ${p}`));
        console.log('');
      }

      // Se o pedido está PAID mas sem sessão ativa ou expirada, oferecer correção
      if (pedido.status === 'PAID' && (!sessaoMaisRecente || !ativa)) {
        console.log('   💡 CORREÇÃO DISPONÍVEL:');
        console.log('      Este pedido está pago mas não tem sessão ativa.');
        console.log('      Execute: node corrigir-pedido-pago.js ' + pedido.code);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

