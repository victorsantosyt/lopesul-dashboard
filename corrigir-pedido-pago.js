#!/usr/bin/env node
// Script para corrigir pedido pago que está sem sessão ativa ou expirada
// Uso: node corrigir-pedido-pago.js <código do pedido>

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

function calcularMinutos(descricao) {
  if (!descricao) return 120; // Default 2 horas
  
  const desc = descricao.toLowerCase();
  if (desc.includes('12h') || desc.includes('12 horas')) return 12 * 60; // 12 horas
  if (desc.includes('24h') || desc.includes('24 horas')) return 24 * 60; // 24 horas
  if (desc.includes('48h') || desc.includes('48 horas')) return 48 * 60; // 48 horas
  if (desc.includes('2h') || desc.includes('2 horas')) return 2 * 60; // 2 horas
  
  return 120; // Default 2 horas
}

async function main() {
  try {
    const pedidoCode = process.argv[2];
    
    if (!pedidoCode) {
      console.log('📋 Uso: node corrigir-pedido-pago.js <código do pedido>');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node corrigir-pedido-pago.js ABC123XYZ');
      process.exit(1);
    }

    console.log('🔧 Corrigindo pedido pago...');
    console.log(`   Código: ${pedidoCode}`);
    console.log('');

    // Buscar pedido
    const pedido = await prisma.pedido.findUnique({
      where: { code: pedidoCode },
      include: {
        SessaoAtiva: {
          where: { ativo: true },
          orderBy: { inicioEm: 'desc' },
          take: 1,
        },
        device: {
          select: {
            id: true,
            mikId: true,
            ip: true,
          },
        },
      },
    });

    if (!pedido) {
      console.log('❌ Pedido não encontrado!');
      return;
    }

    console.log(`✅ Pedido encontrado: ${pedido.code}`);
    console.log(`   Status: ${pedido.status}`);
    console.log(`   Descrição: ${pedido.description || 'N/A'}`);
    console.log(`   IP: ${pedido.ip || 'N/A'}`);
    console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
    console.log('');

    if (pedido.status !== 'PAID') {
      console.log('⚠️  Pedido não está pago (status: ' + pedido.status + ')');
      console.log('   Não é possível criar sessão para pedido não pago.');
      return;
    }

    // Verificar se já tem sessão ativa
    const sessaoAtual = pedido.SessaoAtiva?.[0];
    const agora = new Date();
    
    if (sessaoAtual) {
      const expirada = sessaoAtual.expiraEm < agora;
      const ativa = sessaoAtual.ativo && !expirada;
      
      if (ativa) {
        console.log('✅ Pedido já tem sessão ativa!');
        console.log(`   Sessão ID: ${sessaoAtual.id}`);
        console.log(`   Expira em: ${sessaoAtual.expiraEm.toISOString()}`);
        const minutosRestantes = Math.floor((sessaoAtual.expiraEm - agora) / 60000);
        console.log(`   Minutos restantes: ${minutosRestantes} min`);
        return;
      }
      
      if (expirada) {
        console.log('⏰ Sessão expirada. Reativando...');
      } else {
        console.log('❌ Sessão não está ativa. Reativando...');
      }
    } else {
      console.log('⚠️  Nenhuma sessão ativa encontrada. Criando...');
    }

    // Calcular minutos baseado na descrição
    const minutos = calcularMinutos(pedido.description);
    const expiraEm = new Date(agora.getTime() + minutos * 60 * 1000);
    const ipClienteFinal = pedido.ip || `sem-ip-${pedido.id}`.slice(0, 255);

    // Criar/atualizar sessão
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
          inicioEm: agora,
          expiraEm,
          ativo: true,
          pedidoId: pedido.id,
        },
      });

      console.log('✅ Sessão criada/atualizada com sucesso!');
      console.log(`   Sessão ID: ${sessao.id}`);
      console.log(`   IP: ${sessao.ipCliente}`);
      console.log(`   MAC: ${sessao.macCliente || 'N/A'}`);
      console.log(`   Minutos: ${minutos} min (${(minutos / 60).toFixed(1)} horas)`);
      console.log(`   Expira em: ${sessao.expiraEm.toISOString()}`);
      console.log('');

      // Tentar liberar acesso no Mikrotik
      if (pedido.ip && pedido.deviceMac) {
        console.log('🔧 Tentando liberar acesso no Mikrotik...');
        try {
          const apiUrl = env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
          const response = await fetch(`${apiUrl}/api/liberar-acesso`, {
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
            console.log('✅ Acesso liberado no Mikrotik!');
          } else {
            console.log(`⚠️  Aviso ao liberar acesso: ${result.error || 'Erro desconhecido'}`);
          }
        } catch (apiErr) {
          console.log(`⚠️  Erro ao chamar API: ${apiErr.message}`);
        }
        console.log('');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ CORREÇÃO COMPLETA!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

    } catch (sessaoErr) {
      console.error(`❌ Erro ao criar/atualizar sessão: ${sessaoErr.message}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

