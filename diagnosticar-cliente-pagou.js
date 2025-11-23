#!/usr/bin/env node
// Script para diagnosticar quando cliente pagou mas não teve acesso
// Uso: node diagnosticar-cliente-pagou.js <IP ou MAC ou pedidoCode>

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

async function main() {
  try {
    const busca = process.argv[2];
    
    if (!busca) {
      console.log('📋 Uso: node diagnosticar-cliente-pagou.js <IP ou MAC ou pedidoCode>');
      console.log('');
      console.log('💡 Exemplos:');
      console.log('   node diagnosticar-cliente-pagou.js 192.168.88.69');
      console.log('   node diagnosticar-cliente-pagou.js DA:FD:FD:60:32:3D');
      console.log('   node diagnosticar-cliente-pagou.js Q70YI4IN5O');
      process.exit(1);
    }

    console.log('🔍 Diagnosticando cliente que pagou mas não teve acesso...');
    console.log(`   Busca: ${busca}`);
    console.log('');

    const agora = new Date();
    const ultimas2h = new Date(agora.getTime() - 2 * 60 * 60 * 1000);

    // Buscar pedidos recentes
    const pedidos = await prisma.pedido.findMany({
      where: {
        OR: [
          { code: { equals: busca, mode: 'insensitive' } },
          { ip: busca },
          { deviceMac: { contains: busca, mode: 'insensitive' } },
        ],
        createdAt: { gte: ultimas2h },
      },
      include: {
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (pedidos.length === 0) {
      console.log('❌ Nenhum pedido encontrado nas últimas 2h com essa busca.');
      console.log('');
      console.log('💡 Tente buscar por:');
      console.log('   - IP do cliente (ex: 192.168.88.69)');
      console.log('   - MAC do cliente (ex: DA:FD:FD:60:32:3D)');
      console.log('   - Código do pedido (ex: Q70YI4IN5O)');
      return;
    }

    console.log(`✅ ${pedidos.length} pedido(s) encontrado(s):`);
    console.log('');

    for (const pedido of pedidos) {
      const charge = pedidos[0].charges?.[0];
      const minutosAtras = Math.floor((agora - pedido.createdAt) / 60000);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 PEDIDO: ${pedido.code}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   Status: ${pedido.status}`);
      console.log(`   Criado: ${formatarData(pedido.createdAt)} (${minutosAtras} min atrás)`);
      console.log(`   Cliente: ${pedido.customerName || 'N/A'}`);
      console.log(`   IP: ${pedido.ip || 'N/A'}`);
      console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
      console.log('');

      // Verificar charge
      if (charge) {
        console.log(`   💳 Charge: ${charge.id}`);
        console.log(`      Status: ${charge.status}`);
        console.log(`      QR Code: ${charge.qrCode ? '✅ Gerado' : '❌ Não gerado'}`);
        console.log('');
      } else {
        console.log(`   ⚠️  Nenhuma charge associada!`);
        console.log('');
      }

      // Verificar sessão ativa
      const sessao = await prisma.sessaoAtiva.findFirst({
        where: {
          OR: [
            { pedidoId: pedido.id },
            { ipCliente: pedido.ip || '' },
            ...(pedido.deviceMac ? [{ macCliente: pedido.deviceMac }] : []),
          ],
        },
        include: {
          roteador: {
            select: {
              nome: true,
              ipLan: true,
            },
          },
        },
      });

      if (sessao) {
        const expirada = sessao.expiraEm < agora;
        const ativa = sessao.ativo && !expirada;
        const minutosRestantes = expirada ? 0 : Math.floor((sessao.expiraEm - agora) / 60000);

        console.log(`   ✅ SESSÃO ENCONTRADA:`);
        console.log(`      ID: ${sessao.id}`);
        console.log(`      IP: ${sessao.ipCliente}`);
        console.log(`      MAC: ${sessao.macCliente || 'N/A'}`);
        console.log(`      Status: ${ativa ? '✅ ATIVA' : expirada ? '⏰ EXPIRADA' : '❌ INATIVA'}`);
        console.log(`      Expira em: ${minutosRestantes} min`);
        console.log(`      Roteador: ${sessao.roteador?.nome || 'N/A'} (${sessao.roteador?.ipLan || 'N/A'})`);
        console.log('');

        if (!ativa) {
          console.log(`   ⚠️  PROBLEMA: Sessão não está ativa!`);
          if (expirada) {
            console.log(`      A sessão expirou há ${Math.floor((agora - sessao.expiraEm) / 60000)} minutos.`);
          } else {
            console.log(`      A sessão está marcada como inativa no banco.`);
          }
          console.log('');
        }
      } else {
        console.log(`   ❌ PROBLEMA CRÍTICO: Nenhuma sessão ativa encontrada!`);
        console.log(`      O cliente pagou mas o acesso não foi liberado.`);
        console.log('');
      }

      // Diagnóstico
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 DIAGNÓSTICO:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const problemas = [];

      if (pedido.status !== 'PAID') {
        problemas.push(`❌ Pedido não está marcado como PAID (status: ${pedido.status})`);
      }

      if (!charge) {
        problemas.push('❌ Nenhuma charge associada ao pedido');
      } else if (charge.status !== 'paid' && charge.status !== 'PAID') {
        problemas.push(`❌ Charge não está paga (status: ${charge.status})`);
      }

      if (!sessao) {
        problemas.push('❌ Nenhuma sessão ativa criada para este pedido');
      } else if (!sessao.ativo || sessao.expiraEm < agora) {
        problemas.push('❌ Sessão existe mas não está ativa ou já expirou');
      }

      if (problemas.length === 0) {
        console.log('   ✅ Tudo parece estar correto!');
        console.log('');
        console.log('   💡 Se o cliente ainda não tem acesso, pode ser:');
        console.log('      1. Mikrotik não recebeu os comandos (verificar relay)');
        console.log('      2. Cliente precisa recarregar a página');
        console.log('      3. Cache do navegador');
        console.log('      4. IP do cliente mudou (MAC randomization)');
      } else {
        console.log('   ⚠️  Problemas encontrados:');
        problemas.forEach((p, idx) => {
          console.log(`      ${idx + 1}. ${p}`);
        });
        console.log('');
        console.log('   💡 SOLUÇÕES:');
        
        if (pedido.status !== 'PAID') {
          console.log('      - Verificar se o webhook do Pagar.me foi recebido');
          console.log('      - Verificar logs: pm2 logs 4 | grep webhook');
        }
        
        if (!sessao) {
          console.log('      - Liberar acesso manualmente:');
          console.log(`        ./liberar-cliente-cortesia.sh ${pedido.ip || 'IP'} ${pedido.deviceMac || 'MAC'} ${pedido.code}`);
        } else if (!sessao.ativo || sessao.expiraEm < agora) {
          console.log('      - Reativar sessão:');
          console.log(`        node verificar-e-reativar-sessao.js ${sessao.ipCliente}`);
        }
      }
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

