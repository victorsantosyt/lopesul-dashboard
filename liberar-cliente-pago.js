#!/usr/bin/env node
/**
 * Script para liberar acesso de cliente que já pagou mas não tem sessão ativa
 * 
 * Uso:
 *   node liberar-cliente-pago.js <pedidoCode>
 * 
 * Exemplo:
 *   node liberar-cliente-pago.js J0K9SDS80O
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const PEDIDO_CODE = process.argv[2];

if (!PEDIDO_CODE) {
  console.log('❌ Erro: Informe o código do pedido');
  console.log('');
  console.log('Uso:');
  console.log('   node liberar-cliente-pago.js <pedidoCode>');
  console.log('');
  console.log('Exemplo:');
  console.log('   node liberar-cliente-pago.js J0K9SDS80O');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔓 Liberando acesso para cliente que já pagou...');
    console.log(`   Pedido Code: ${PEDIDO_CODE}`);
    console.log('');

    // Buscar pedido
    const pedido = await prisma.pedido.findUnique({
      where: { code: PEDIDO_CODE },
      include: {
        device: {
          select: {
            id: true,
            mikId: true,
          },
        },
      },
    });

    if (!pedido) {
      console.log('❌ Pedido não encontrado!');
      return;
    }

    if (pedido.status !== 'PAID') {
      console.log(`⚠️ Pedido não está pago! Status: ${pedido.status}`);
      console.log('   Use o script de cortesia se quiser liberar mesmo assim.');
      return;
    }

    console.log('✅ Pedido encontrado:');
    console.log(`   ID: ${pedido.id}`);
    console.log(`   Status: ${pedido.status}`);
    console.log(`   Valor: R$ ${(pedido.amount / 100).toFixed(2)}`);
    console.log(`   IP: ${pedido.ip || 'N/A'}`);
    console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
    console.log(`   DeviceId: ${pedido.deviceId || 'N/A'}`);
    console.log('');

    if (!pedido.ip && !pedido.deviceMac) {
      console.log('❌ Pedido não tem IP nem MAC! Não é possível liberar acesso.');
      return;
    }

    // Verificar se já existe sessão ativa
    const sessaoExistente = await prisma.sessaoAtiva.findFirst({
      where: {
        OR: [
          pedido.ip ? { ipCliente: pedido.ip } : {},
          pedido.deviceMac ? { macCliente: pedido.deviceMac } : {},
        ].filter(c => Object.keys(c).length > 0),
        ativo: true,
        expiraEm: { gte: new Date() },
      },
    });

    if (sessaoExistente) {
      console.log('⚠️ Já existe uma sessão ativa para este IP/MAC:');
      console.log(`   Sessão ID: ${sessaoExistente.id}`);
      console.log(`   IP: ${sessaoExistente.ipCliente}`);
      console.log(`   MAC: ${sessaoExistente.macCliente || 'N/A'}`);
      console.log(`   Expira: ${sessaoExistente.expiraEm.toISOString()}`);
      console.log('');
      console.log('✅ Cliente já está com acesso ativo!');
      return;
    }

    // Chamar API de liberação
    console.log('📡 Chamando API de liberação...');
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
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

    const result = await response.json().catch(() => ({}));

    if (response.ok && result.ok) {
      console.log('✅ Acesso liberado com sucesso!');
      console.log('');
      console.log('📊 Detalhes:');
      if (result.pedidoId) console.log(`   Pedido ID: ${result.pedidoId}`);
      if (result.sessaoId) console.log(`   Sessão ID: ${result.sessaoId}`);
      if (result.mikrotik) {
        console.log(`   Mikrotik: ${JSON.stringify(result.mikrotik)}`);
      }
    } else {
      console.log('❌ Erro ao liberar acesso:');
      console.log(`   ${result.error || 'Erro desconhecido'}`);
      console.log('');
      console.log('💡 Tentando criar sessão manualmente...');
      
      // Tentar criar sessão manualmente
      try {
        const minutos = 120; // 2 horas padrão
        const now = new Date();
        const expiraEm = new Date(now.getTime() + minutos * 60 * 1000);

        const sessao = await prisma.sessaoAtiva.upsert({
          where: {
            ipCliente: pedido.ip || `sem-ip-${pedido.id}`.slice(0, 255),
          },
          update: {
            macCliente: pedido.deviceMac || null,
            plano: pedido.description || 'Acesso',
            expiraEm,
            ativo: true,
            pedidoId: pedido.id,
          },
          create: {
            ipCliente: pedido.ip || `sem-ip-${pedido.id}`.slice(0, 255),
            macCliente: pedido.deviceMac || null,
            plano: pedido.description || 'Acesso',
            inicioEm: now,
            expiraEm,
            ativo: true,
            pedidoId: pedido.id,
          },
        });

        console.log('✅ Sessão criada manualmente no banco!');
        console.log(`   Sessão ID: ${sessao.id}`);
        console.log(`   IP: ${sessao.ipCliente}`);
        console.log(`   Expira: ${sessao.expiraEm.toISOString()}`);
        console.log('');
        console.log('⚠️ ATENÇÃO: A sessão foi criada no banco, mas o acesso no Mikrotik pode não estar liberado.');
        console.log('   Verifique os logs do Mikrotik ou libere manualmente no roteador.');
      } catch (sessaoErr) {
        console.error('❌ Erro ao criar sessão manualmente:', sessaoErr.message);
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

