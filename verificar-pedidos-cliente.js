#!/usr/bin/env node
// Script para verificar todos os pedidos de um cliente específico

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const MAC = '8A:22:3C:F4:F9:70';
const IP = '192.168.88.80';

async function verificarPedidos() {
  console.log('🔍 Verificando todos os pedidos do cliente:');
  console.log(`   MAC: ${MAC}`);
  console.log(`   IP:  ${IP}`);
  console.log('');

  try {
    // Buscar todos os pedidos com esse MAC ou IP
    const pedidos = await prisma.pedido.findMany({
      where: {
        OR: [
          { deviceMac: { equals: MAC, mode: 'insensitive' } },
          { ip: IP },
        ],
      },
      include: {
        device: {
          select: {
            id: true,
            mikId: true,
          },
        },
        charges: {
          orderBy: { createdAt: 'desc' },
        },
        SessaoAtiva: {
          where: { ativo: true },
          orderBy: { inicioEm: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📋 Encontrados ${pedidos.length} pedido(s):\n`);

    pedidos.forEach((p, idx) => {
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`Pedido ${idx + 1}:`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Code: ${p.code}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  Valor: R$ ${(p.amount / 100).toFixed(2)}`);
      console.log(`  Método: ${p.method}`);
      console.log(`  Descrição: ${p.description || 'N/A'}`);
      console.log(`  Criado em: ${p.createdAt.toISOString()}`);
      console.log(`  Atualizado em: ${p.updatedAt.toISOString()}`);
      console.log(`  IP: ${p.ip || 'N/A'}`);
      console.log(`  MAC: ${p.deviceMac || 'N/A'}`);
      console.log(`  Device ID: ${p.deviceId || 'N/A'}`);
      console.log(`  Device MikId: ${p.device?.mikId || 'N/A'}`);

      // Charges
      if (p.charges && p.charges.length > 0) {
        console.log(`  📦 Charges (${p.charges.length}):`);
        p.charges.forEach((c, cIdx) => {
          console.log(`    ${cIdx + 1}. Status: ${c.status}`);
          console.log(`       Provider ID: ${c.providerId || 'N/A'}`);
          console.log(`       Criado em: ${c.createdAt.toISOString()}`);
          console.log(`       QR Code URL: ${c.qrCodeUrl ? 'Sim' : 'Não'}`);
        });
      } else {
        console.log(`  ⚠️  Nenhuma charge encontrada`);
      }

      // Sessões ativas
      if (p.SessaoAtiva && p.SessaoAtiva.length > 0) {
        console.log(`  🔐 Sessões Ativas (${p.SessaoAtiva.length}):`);
        p.SessaoAtiva.forEach((s, sIdx) => {
          const agora = new Date();
          const expirado = s.expiraEm < agora;
          console.log(`    ${sIdx + 1}. ID: ${s.id}`);
          console.log(`       IP: ${s.ipCliente}`);
          console.log(`       MAC: ${s.macCliente || 'N/A'}`);
          console.log(`       Expira em: ${s.expiraEm.toISOString()}`);
          console.log(`       Status: ${expirado ? '❌ EXPIRADO' : '✅ ATIVO'}`);
        });
      } else {
        console.log(`  ⚠️  Nenhuma sessão ativa`);
      }

      console.log('');
    });

    // Resumo
    const pagos = pedidos.filter(p => p.status === 'PAID');
    const pendentes = pedidos.filter(p => p.status === 'PENDING');
    const expirados = pedidos.filter(p => p.status === 'EXPIRED');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMO:');
    console.log(`  Total: ${pedidos.length}`);
    console.log(`  ✅ Pagos: ${pagos.length}`);
    console.log(`  ⏳ Pendentes: ${pendentes.length}`);
    console.log(`  ❌ Expirados: ${expirados.length}`);
    console.log('');

    // Verificar se há problemas
    if (pendentes.length > 0) {
      console.log('⚠️  PROBLEMA DETECTADO: Há pedidos pendentes!');
      console.log('');
      console.log('Possíveis causas:');
      console.log('  1. Cliente gerou QR Code mas não pagou');
      console.log('  2. Webhook da Pagar.me não chegou (status não atualizado)');
      console.log('  3. Pagamento está processando mas ainda não foi confirmado');
      console.log('');
      console.log('💡 Verificar:');
      console.log('  - Logs do webhook da Pagar.me');
      console.log('  - Status dos pagamentos na dashboard da Pagar.me');
      console.log('  - Se os QR Codes foram gerados corretamente');
    }

    // Verificar charges pendentes
    const chargesPendentes = pedidos
      .flatMap(p => p.charges || [])
      .filter(c => c.status === 'CREATED' || c.status === 'AUTHORIZED');

    if (chargesPendentes.length > 0) {
      console.log(`⚠️  Há ${chargesPendentes.length} charge(s) pendente(s) que podem precisar de verificação manual`);
    }

  } catch (error) {
    console.error('❌ Erro ao verificar pedidos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarPedidos();

