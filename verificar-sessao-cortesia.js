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

    // 2. Verificar sessões do pedido (buscar diretamente por pedidoId)
    const sessoesDoPedido = await prisma.sessaoAtiva.findMany({
      where: {
        pedidoId: pedido.id,
      },
      orderBy: { inicioEm: 'desc' },
    });
    
    // Verificar também se há sessão com o IP/MAC do pedido
    const ipClienteFinal = pedido.ip || `sem-ip-${pedido.id}`.slice(0, 255);
    const sessaoPorIp = await prisma.sessaoAtiva.findFirst({
      where: {
        ipCliente: ipClienteFinal,
      },
    });
    
    // Verificar se a sessão encontrada realmente pertence a este pedido e tem IP/MAC corretos
    const sessaoCorreta = sessoesDoPedido.find(s => 
      s.ipCliente === ipClienteFinal && 
      (!pedido.deviceMac || s.macCliente === pedido.deviceMac)
    );
    
    if (sessaoCorreta) {
      const agora = new Date();
      const expirada = sessaoCorreta.expiraEm < agora;
      const ativa = sessaoCorreta.ativo && !expirada;
      
      console.log(`✅ Sessão encontrada para este pedido:`);
      console.log(`   ID: ${sessaoCorreta.id}`);
      console.log(`   IP: ${sessaoCorreta.ipCliente}`);
      console.log(`   MAC: ${sessaoCorreta.macCliente || 'N/A'}`);
      console.log(`   Plano: ${sessaoCorreta.plano || 'N/A'}`);
      console.log(`   Início: ${sessaoCorreta.inicioEm.toISOString()}`);
      console.log(`   Expira: ${sessaoCorreta.expiraEm.toISOString()}`);
      console.log(`   Ativo: ${sessaoCorreta.ativo ? 'Sim' : 'Não'}`);
      console.log(`   Status: ${ativa ? '✅ ATIVA' : expirada ? '⏰ EXPIRADA' : '❌ INATIVA'}`);
    } else if (sessoesDoPedido.length > 0) {
      console.log(`⚠️  ${sessoesDoPedido.length} sessão(ões) encontrada(s) para este pedido, mas com IP/MAC diferentes:`);
      sessoesDoPedido.forEach((sessao, idx) => {
        console.log(`\n   Sessão ${idx + 1}:`);
        console.log(`   ID: ${sessao.id}`);
        console.log(`   IP: ${sessao.ipCliente} (esperado: ${ipClienteFinal})`);
        console.log(`   MAC: ${sessao.macCliente || 'N/A'} (esperado: ${pedido.deviceMac || 'N/A'})`);
      });
      console.log('\n💡 Criando/atualizando sessão com IP/MAC corretos...');
      
      // Verificar se já existe sessão com este IP (pode ser de outro pedido)
      if (sessaoPorIp && sessaoPorIp.pedidoId !== pedido.id) {
        console.log(`⚠️  Já existe uma sessão para o IP ${ipClienteFinal} de outro pedido:`);
        console.log(`   Sessão ID: ${sessaoPorIp.id}`);
        console.log(`   Pedido ID: ${sessaoPorIp.pedidoId} (atual: ${pedido.id})`);
        console.log(`   MAC: ${sessaoPorIp.macCliente || 'N/A'}`);
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
    } else {
      console.log('❌ Nenhuma sessão encontrada para este pedido!');
      console.log('');
      console.log('💡 Criando sessão manualmente...');
      
      // Verificar se já existe sessão com este IP (pode ser de outro pedido)
      if (sessaoPorIp && sessaoPorIp.pedidoId !== pedido.id) {
        console.log(`⚠️  Já existe uma sessão para o IP ${ipClienteFinal} de outro pedido:`);
        console.log(`   Sessão ID: ${sessaoPorIp.id}`);
        console.log(`   Pedido ID: ${sessaoPorIp.pedidoId} (atual: ${pedido.id})`);
        console.log(`   MAC: ${sessaoPorIp.macCliente || 'N/A'}`);
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

