#!/usr/bin/env node
// Script para investigar pedidos pendentes do cliente

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const MAC = '8A:22:3C:F4:F9:70';
const IP = '192.168.88.80';

async function investigar() {
  console.log('🔍 Investigando pedidos pendentes:');
  console.log(`   MAC: ${MAC}`);
  console.log(`   IP:  ${IP}`);
  console.log('');

  try {
    // Buscar pedidos pendentes
    const pedidosPendentes = await prisma.pedido.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { deviceMac: { equals: MAC, mode: 'insensitive' } },
          { ip: IP },
        ],
      },
      include: {
        charges: {
          orderBy: { createdAt: 'desc' },
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

    console.log(`📋 Encontrados ${pedidosPendentes.length} pedido(s) pendente(s):\n`);

    if (pedidosPendentes.length === 0) {
      console.log('✅ Nenhum pedido pendente encontrado!');
      return;
    }

    pedidosPendentes.forEach((p, idx) => {
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`Pedido ${idx + 1}: ${p.code}`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  Valor: R$ ${(p.amount / 100).toFixed(2)}`);
      console.log(`  Método: ${p.method}`);
      console.log(`  Criado em: ${p.createdAt.toISOString()}`);
      console.log(`  Atualizado em: ${p.updatedAt.toISOString()}`);
      console.log(`  IP: ${p.ip || 'N/A'}`);
      console.log(`  MAC: ${p.deviceMac || 'N/A'}`);
      console.log(`  Device MikId: ${p.device?.mikId || 'N/A'}`);

      // Analisar charges
      if (p.charges && p.charges.length > 0) {
        console.log(`  📦 Charges (${p.charges.length}):`);
        p.charges.forEach((c, cIdx) => {
          console.log(`    ${cIdx + 1}. Status: ${c.status}`);
          console.log(`       Provider ID: ${c.providerId || 'N/A'}`);
          console.log(`       Criado em: ${c.createdAt.toISOString()}`);
          console.log(`       Atualizado em: ${c.updatedAt.toISOString()}`);
          console.log(`       QR Code URL: ${c.qrCodeUrl ? '✅ Sim' : '❌ Não'}`);
          
          // Verificar se passou muito tempo desde criação
          const agora = new Date();
          const tempoDesdeCriacao = agora - c.createdAt;
          const horasDesdeCriacao = tempoDesdeCriacao / (1000 * 60 * 60);
          
          if (horasDesdeCriacao > 1) {
            console.log(`       ⚠️  Charge criada há ${horasDesdeCriacao.toFixed(1)} horas (pode ter expirado)`);
          }
        });
      } else {
        console.log(`  ⚠️  PROBLEMA: Nenhuma charge associada a este pedido!`);
        console.log(`     Isso significa que o QR Code nunca foi gerado ou não foi salvo.`);
      }

      // Verificar se há webhook logs
      console.log('');
    });

    // Resumo
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 ANÁLISE:');
    console.log('');
    
    const comCharges = pedidosPendentes.filter(p => p.charges && p.charges.length > 0);
    const semCharges = pedidosPendentes.filter(p => !p.charges || p.charges.length === 0);
    
    console.log(`Total de pedidos pendentes: ${pedidosPendentes.length}`);
    console.log(`  ✅ Com charges (QR Code gerado): ${comCharges.length}`);
    console.log(`  ❌ Sem charges (QR Code não gerado): ${semCharges.length}`);
    console.log('');

    // Verificar charges por status
    const todasCharges = pedidosPendentes.flatMap(p => p.charges || []);
    const chargesCriadas = todasCharges.filter(c => c.status === 'CREATED');
    const chargesPendentes = todasCharges.filter(c => c.status === 'AUTHORIZED' || c.status === 'PAID');
    
    console.log('📦 Status das Charges:');
    console.log(`  CREATED: ${chargesCriadas.length}`);
    console.log(`  AUTHORIZED/PAID: ${chargesPendentes.length}`);
    console.log('');

    // Possíveis causas
    console.log('💡 POSSÍVEIS CAUSAS:');
    console.log('');
    
    if (semCharges.length > 0) {
      console.log('⚠️  1. QR Code não foi gerado (sem charges):');
      console.log('     - Problema ao criar charge na Pagar.me');
      console.log('     - Cliente pode ter fechado a página antes de gerar QR Code');
      console.log('');
    }
    
    if (comCharges.length > 0) {
      console.log('⚠️  2. QR Code gerado mas pagamento não confirmado:');
      console.log('     - Cliente não pagou o QR Code');
      console.log('     - Webhook da Pagar.me não chegou (verificar logs)');
      console.log('     - QR Code expirou (PIX expira em 30min)');
      console.log('');
    }
    
    console.log('⚠️  3. Cliente criando múltiplos pedidos:');
    console.log('     - Cliente pode estar tentando várias vezes sem pagar');
    console.log('     - Sistema não está detectando pedidos duplicados');
    console.log('     - Cliente não está vendo a página de pagamento corretamente');
    console.log('');

    // Recomendações
    console.log('🔧 RECOMENDAÇÕES:');
    console.log('');
    console.log('1. Verificar logs do webhook da Pagar.me:');
    console.log('   pm2 logs 4 --lines 200 --nostream | grep -E "(webhook|charge|order)" | tail -50');
    console.log('');
    console.log('2. Verificar se há webhooks chegando mas não processando:');
    console.log('   Verificar logs de webhook no banco (tabela WebhookLog)');
    console.log('');
    console.log('3. Considerar expirar pedidos pendentes após X horas');
    console.log('');
    console.log('4. Verificar se o cliente está vendo a página de pagamento corretamente');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao investigar:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigar();

