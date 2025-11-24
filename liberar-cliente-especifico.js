#!/usr/bin/env node
// Script para liberar acesso de um cliente específico
// Uso: node liberar-cliente-especifico.js <IP> <MAC> [mikId]

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
    const ip = process.argv[2];
    const mac = process.argv[3];
    const mikId = process.argv[4] || 'LOPESUL-HOTSPOT-06';
    
    if (!ip || !mac) {
      console.log('📋 Uso: node liberar-cliente-especifico.js <IP> <MAC> [mikId]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node liberar-cliente-especifico.js 192.168.88.82 4A:CE:1D:DC:36:E3');
      console.log('   node liberar-cliente-especifico.js 192.168.88.82 4A:CE:1D:DC:36:E3 LOPESUL-HOTSPOT-06');
      process.exit(1);
    }

    console.log('🔧 Liberando acesso para cliente específico...');
    console.log(`   IP: ${ip}`);
    console.log(`   MAC: ${mac}`);
    console.log(`   MikId: ${mikId}`);
    console.log('');

    // Buscar dispositivo
    const dispositivo = await prisma.dispositivo.findFirst({
      where: {
        mikId: { equals: mikId, mode: 'insensitive' },
      },
      include: {
        frota: {
          include: {
            roteador: true,
          },
        },
      },
    });

    if (!dispositivo) {
      console.log('❌ Dispositivo não encontrado!');
      return;
    }

    // Buscar pedido relacionado (se houver)
    let pedido = await prisma.pedido.findFirst({
      where: {
        OR: [
          { ip: ip },
          { deviceMac: mac.toUpperCase() },
        ],
        status: { in: ['PAID', 'PENDING'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Se não encontrou pedido pago, criar um temporário de cortesia
    if (!pedido || pedido.status !== 'PAID') {
      const pedidoCode = `CORTESIA-${Date.now()}`;
      console.log('📝 Criando pedido temporário de cortesia...');
      
      pedido = await prisma.pedido.create({
        data: {
          code: pedidoCode,
          status: 'PAID',
          amount: 0,
          method: 'PIX',
          description: 'Acesso de Cortesia',
          ip: ip,
          deviceMac: mac.toUpperCase(),
          deviceId: dispositivo.id,
        },
      });
      console.log(`   ✅ Pedido criado: ${pedidoCode}`);
      console.log('');
    } else {
      console.log(`✅ Pedido encontrado: ${pedido.code}`);
      console.log('');
    }

    // Chamar API de liberar acesso
    console.log('🔧 Chamando API de liberar acesso...');
    const apiUrl = env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${apiUrl}/api/liberar-acesso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: pedido.code,
          ip: ip,
          mac: mac.toUpperCase(),
          deviceId: dispositivo.id,
          mikId: dispositivo.mikId,
        }),
      });

      const result = await response.json();
      
      if (result.ok) {
        console.log('✅ Acesso liberado com sucesso no Mikrotik!');
        console.log('');
      } else {
        console.log(`⚠️  Aviso: ${result.error || 'Erro desconhecido'}`);
        console.log('');
      }
    } catch (apiErr) {
      console.error(`❌ Erro ao chamar API: ${apiErr.message}`);
      console.log('');
    }

    // Criar/atualizar sessão ativa
    console.log('🔧 Criando/atualizando sessão ativa...');
    const minutos = 120; // 2 horas
    const now = new Date();
    const expiraEm = new Date(now.getTime() + minutos * 60 * 1000);
    const ipClienteFinal = ip.slice(0, 255);

    try {
      const sessao = await prisma.sessaoAtiva.upsert({
        where: {
          ipCliente: ipClienteFinal,
        },
        update: {
          macCliente: mac.toUpperCase(),
          plano: pedido.description || 'Acesso',
          expiraEm,
          ativo: true,
          pedidoId: pedido.id,
        },
        create: {
          ipCliente: ipClienteFinal,
          macCliente: mac.toUpperCase(),
          plano: pedido.description || 'Acesso',
          inicioEm: now,
          expiraEm,
          ativo: true,
          pedidoId: pedido.id,
        },
      });

      console.log('✅ Sessão ativa criada/atualizada!');
      console.log(`   Sessão ID: ${sessao.id}`);
      console.log(`   IP: ${sessao.ipCliente}`);
      console.log(`   MAC: ${sessao.macCliente}`);
      console.log(`   Expira em: ${sessao.expiraEm.toISOString()}`);
      console.log('');
    } catch (sessaoErr) {
      console.error(`❌ Erro ao criar sessão: ${sessaoErr.message}`);
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ LIBERAÇÃO COMPLETA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 Próximos passos:');
    console.log('   1. Peça ao cliente para fazer uma nova requisição HTTP');
    console.log('   2. Abrir navegador e tentar acessar qualquer site');
    console.log('   3. Isso fará o Mikrotik reconhecer o binding e liberar o acesso');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

