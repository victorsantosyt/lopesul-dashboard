#!/usr/bin/env node
// Script para corrigir pedidos pagos sem sessão ativa
// Uso: node corrigir-pedidos-pagos-sem-sessao.js [pedidoCode opcional]

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
    const pedidoCode = process.argv[2];
    
    console.log('🔧 Corrigindo pedidos pagos sem sessão ativa...');
    if (pedidoCode) {
      console.log(`   Pedido específico: ${pedidoCode}`);
    }
    console.log('');

    // Buscar pedidos pagos sem sessão ativa
    const where = {
      status: 'PAID',
      ...(pedidoCode ? { code: pedidoCode } : {}),
    };

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        SessaoAtiva: {
          where: { ativo: true },
          take: 1,
        },
        device: {
          select: {
            id: true,
            mikId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pedidosSemSessao = pedidos.filter(p => !p.SessaoAtiva || p.SessaoAtiva.length === 0);

    if (pedidosSemSessao.length === 0) {
      console.log('✅ Todos os pedidos pagos têm sessão ativa!');
      return;
    }

    console.log(`📋 ${pedidosSemSessao.length} pedido(s) pago(s) sem sessão ativa:`);
    console.log('');

    for (const pedido of pedidosSemSessao) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 Pedido: ${pedido.code}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   ID: ${pedido.id}`);
      console.log(`   IP: ${pedido.ip || 'N/A'}`);
      console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
      console.log(`   Criado em: ${pedido.createdAt.toISOString()}`);
      console.log('');

      if (!pedido.ip && !pedido.deviceMac) {
        console.log('   ⚠️  Pedido sem IP/MAC, não é possível criar sessão');
        console.log('');
        continue;
      }

      // Criar sessão ativa
      const minutos = 120; // 2 horas
      const now = new Date();
      const expiraEm = new Date(now.getTime() + minutos * 60 * 1000);
      const ipClienteFinal = pedido.ip || `sem-ip-${pedido.id}`.slice(0, 255);

      try {
        const sessao = await prisma.sessaoAtiva.upsert({
          where: {
            ipCliente: ipClienteFinal,
          },
          update: {
            macCliente: pedido.deviceMac || null,
            plano: pedido.description || 'Acesso',
            expiraEm,
            ativo: true,
            pedidoId: pedido.id,
          },
          create: {
            ipCliente: ipClienteFinal,
            macCliente: pedido.deviceMac || null,
            plano: pedido.description || 'Acesso',
            inicioEm: now,
            expiraEm,
            ativo: true,
            pedidoId: pedido.id,
          },
        });

        console.log('   ✅ Sessão ativa criada/atualizada!');
        console.log(`      Sessão ID: ${sessao.id}`);
        console.log(`      IP: ${sessao.ipCliente}`);
        console.log(`      MAC: ${sessao.macCliente || 'N/A'}`);
        console.log(`      Expira em: ${sessao.expiraEm.toISOString()}`);
        console.log('');

        // Tentar liberar acesso no Mikrotik via API
        if (pedido.ip && pedido.deviceMac) {
          console.log('   🔧 Tentando liberar acesso no Mikrotik...');
          try {
            const response = await fetch(`${env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/liberar-acesso`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                externalId: pedido.code,
                ip: pedido.ip,
                mac: pedido.deviceMac,
                deviceId: pedido.deviceId,
                mikId: pedido.device?.mikId,
              }),
            });

            const result = await response.json();
            if (result.ok) {
              console.log('   ✅ Acesso liberado no Mikrotik!');
            } else {
              console.log(`   ⚠️  Aviso ao liberar acesso: ${result.error || 'Erro desconhecido'}`);
            }
          } catch (apiErr) {
            console.log(`   ⚠️  Erro ao chamar API: ${apiErr.message}`);
          }
          console.log('');
        }
      } catch (sessaoErr) {
        console.error(`   ❌ Erro ao criar sessão: ${sessaoErr.message}`);
        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CORREÇÃO COMPLETA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

