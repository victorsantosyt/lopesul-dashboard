#!/usr/bin/env node
/**
 * Script para verificar se uma sessão foi criada para um pedido de cortesia
 * 
 * Uso:
 *   node verificar-sessao-cortesia.js <pedidoCode>
 * 
 * Exemplo:
 *   node verificar-sessao-cortesia.js CORTESIA-1763685079378
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PEDIDO_CODE = process.argv[2] || 'CORTESIA-1763685079378';

async function main() {
  try {
    console.log('🔍 Verificando sessão para pedido de cortesia...');
    console.log(`📋 Pedido Code: ${PEDIDO_CODE}`);
    console.log('');

    // 1. Buscar pedido
    const pedido = await prisma.pedido.findUnique({
      where: { code: PEDIDO_CODE },
      include: {
        SessaoAtiva: {
          orderBy: { inicioEm: 'desc' },
        },
      },
    });

    if (!pedido) {
      console.log('❌ Pedido não encontrado!');
      return;
    }

    console.log('✅ Pedido encontrado:');
    console.log(`   ID: ${pedido.id}`);
    console.log(`   Status: ${pedido.status}`);
    console.log(`   IP: ${pedido.ip || 'N/A'}`);
    console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
    console.log('');

    // 2. Verificar sessões do pedido
    const sessoesDoPedido = pedido.SessaoAtiva.filter(s => s.pedidoId === pedido.id);
    
    if (sessoesDoPedido.length > 0) {
      console.log(`✅ ${sessoesDoPedido.length} sessão(ões) encontrada(s) para este pedido:`);
      sessoesDoPedido.forEach((sessao, idx) => {
        const agora = new Date();
        const expirada = sessao.expiraEm < agora;
        const ativa = sessao.ativo && !expirada;
        
        console.log(`\n   Sessão ${idx + 1}:`);
        console.log(`   ID: ${sessao.id}`);
        console.log(`   IP: ${sessao.ipCliente}`);
        console.log(`   MAC: ${sessao.macCliente || 'N/A'}`);
        console.log(`   Plano: ${sessao.plano || 'N/A'}`);
        console.log(`   Início: ${sessao.inicioEm.toISOString()}`);
        console.log(`   Expira: ${sessao.expiraEm.toISOString()}`);
        console.log(`   Ativo: ${sessao.ativo ? 'Sim' : 'Não'}`);
        console.log(`   Status: ${ativa ? '✅ ATIVA' : expirada ? '⏰ EXPIRADA' : '❌ INATIVA'}`);
      });
    } else {
      console.log('❌ Nenhuma sessão encontrada para este pedido!');
      console.log('');
      console.log('💡 Criando sessão manualmente...');
      
      // Verificar se já existe sessão com este IP (pode ser de outro pedido)
      const ipClienteFinal = pedido.ip || `sem-ip-${pedido.id}`.slice(0, 255);
      const sessaoExistente = await prisma.sessaoAtiva.findFirst({
        where: {
          ipCliente: ipClienteFinal,
        },
      });
      
      if (sessaoExistente) {
        console.log(`⚠️  Já existe uma sessão para o IP ${ipClienteFinal}:`);
        console.log(`   Sessão ID: ${sessaoExistente.id}`);
        console.log(`   Pedido ID: ${sessaoExistente.pedidoId}`);
        console.log(`   MAC: ${sessaoExistente.macCliente || 'N/A'}`);
        console.log('');
        console.log('🔄 Atualizando sessão existente para este pedido...');
      }
      
      // Criar/atualizar sessão manualmente
      const minutos = 120; // 2 horas
      const now = new Date();
      const expiraEm = new Date(now.getTime() + minutos * 60 * 1000);

      try {
        const sessao = await prisma.sessaoAtiva.upsert({
          where: {
            ipCliente: ipClienteFinal,
          },
          update: {
            macCliente: pedido.deviceMac || null,
            plano: pedido.description || 'Acesso de Cortesia',
            expiraEm,
            ativo: true,
            pedidoId: pedido.id, // Atualizar para este pedido
          },
          create: {
            ipCliente: ipClienteFinal,
            macCliente: pedido.deviceMac || null,
            plano: pedido.description || 'Acesso de Cortesia',
            inicioEm: now,
            expiraEm,
            ativo: true,
            pedidoId: pedido.id,
          },
        });

        console.log('✅ Sessão criada/atualizada com sucesso!');
        console.log(`   Sessão ID: ${sessao.id}`);
        console.log(`   IP: ${sessao.ipCliente}`);
        console.log(`   MAC: ${sessao.macCliente || 'N/A'}`);
        console.log(`   Expira: ${sessao.expiraEm.toISOString()}`);
      } catch (err) {
        console.error('❌ Erro ao criar sessão:', err.message);
        console.error(err);
      }
    }

    // 3. Verificar se aparece na API
    console.log('');
    console.log('🔍 Verificando se aparece na API /api/sessoes...');
    
    const sessoesAPI = await prisma.sessaoAtiva.findMany({
      where: {
        pedidoId: pedido.id,
      },
      orderBy: { inicioEm: 'desc' },
      take: 5,
    });

    if (sessoesAPI.length > 0) {
      console.log(`✅ ${sessoesAPI.length} sessão(ões) encontrada(s) na API`);
      sessoesAPI.forEach(s => {
        const agora = new Date();
        const ativa = s.ativo && s.expiraEm > agora;
        console.log(`   - ${s.ipCliente} (${s.macCliente || 'sem MAC'}) - ${ativa ? 'ATIVA' : 'INATIVA'}`);
      });
    } else {
      console.log('❌ Nenhuma sessão encontrada na API');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

