#!/usr/bin/env node
/**
 * Script para verificar e reativar sessão expirada
 * 
 * Uso:
 *   node verificar-e-reativar-sessao.js <IP> [MAC]
 * 
 * Exemplo:
 *   node verificar-e-reativar-sessao.js 192.168.88.94 3E:3B:2E:CF:EF:F6
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const IP = process.argv[2];
const MAC = process.argv[3] || null;

if (!IP) {
  console.log('❌ Erro: Informe o IP do cliente');
  console.log('');
  console.log('Uso:');
  console.log('   node verificar-e-reativar-sessao.js <IP> [MAC]');
  console.log('');
  console.log('Exemplo:');
  console.log('   node verificar-e-reativar-sessao.js 192.168.88.94 3E:3B:2E:CF:EF:F6');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔍 Verificando sessão...');
    console.log(`   IP: ${IP}`);
    if (MAC) console.log(`   MAC: ${MAC}`);
    console.log('');

    // Buscar sessão por IP (MAC é opcional)
    let sessao = null;
    
    if (MAC && MAC.length >= 17) {
      // Buscar por IP e MAC se MAC completo
      sessao = await prisma.sessaoAtiva.findFirst({
        where: {
          ipCliente: IP,
          macCliente: MAC,
        },
        include: {
          pedido: {
            select: {
              id: true,
              code: true,
              status: true,
              description: true,
              amount: true,
            },
          },
        },
        orderBy: { inicioEm: 'desc' },
      });
    }
    
    // Se não encontrou ou MAC incompleto, buscar apenas por IP
    if (!sessao) {
      sessao = await prisma.sessaoAtiva.findFirst({
        where: {
          ipCliente: IP,
        },
        include: {
          pedido: {
            select: {
              id: true,
              code: true,
              status: true,
              description: true,
              amount: true,
            },
          },
        },
        orderBy: { inicioEm: 'desc' },
      });
    }

    if (!sessao) {
      console.log('❌ Sessão não encontrada!');
      console.log('');
      console.log('🔍 Buscando pedidos relacionados a este IP...');
      
      // Buscar pedidos com este IP
      const pedidos = await prisma.pedido.findMany({
        where: {
          ip: IP,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          code: true,
          status: true,
          description: true,
          amount: true,
          ip: true,
          deviceMac: true,
          createdAt: true,
        },
      });
      
      if (pedidos.length > 0) {
        console.log(`✅ ${pedidos.length} pedido(s) encontrado(s) com este IP:`);
        pedidos.forEach((p, idx) => {
          console.log(`\n   Pedido ${idx + 1}:`);
          console.log(`   ID: ${p.id}`);
          console.log(`   Code: ${p.code}`);
          console.log(`   Status: ${p.status}`);
          console.log(`   IP: ${p.ip}`);
          console.log(`   MAC: ${p.deviceMac || 'N/A'}`);
          console.log(`   Criado: ${p.createdAt.toISOString()}`);
        });
        console.log('');
        console.log('💡 Nenhuma sessão ativa encontrada. Você pode criar uma sessão usando:');
        console.log(`   node verificar-sessao-cortesia.js ${pedidos[0].code}`);
      } else {
        console.log('❌ Nenhum pedido encontrado com este IP.');
      }
      return;
    }

    const agora = new Date();
    const expirada = sessao.expiraEm < agora;
    const ativa = sessao.ativo && !expirada;
    const minutosRestantes = expirada ? 0 : Math.floor((sessao.expiraEm - agora) / 60000);

    console.log('📋 Status da sessão:');
    console.log(`   ID: ${sessao.id}`);
    console.log(`   IP: ${sessao.ipCliente}`);
    console.log(`   MAC: ${sessao.macCliente || 'N/A'}`);
    console.log(`   Plano: ${sessao.plano || 'N/A'}`);
    console.log(`   Início: ${sessao.inicioEm.toISOString()}`);
    console.log(`   Expira: ${sessao.expiraEm.toISOString()}`);
    console.log(`   Agora: ${agora.toISOString()}`);
    console.log(`   Ativo (banco): ${sessao.ativo ? 'Sim' : 'Não'}`);
    console.log(`   Expirado: ${expirada ? 'Sim' : 'Não'}`);
    if (!expirada) {
      console.log(`   Minutos restantes: ${minutosRestantes} min`);
    } else {
      const minutosExpirados = Math.floor((agora - sessao.expiraEm) / 60000);
      console.log(`   Expirado há: ${minutosExpirados} minutos`);
    }
    console.log(`   Status atual: ${ativa ? '✅ ATIVA' : expirada ? '⏰ EXPIRADA' : '❌ INATIVA'}`);
    console.log('');

    if (sessao.pedido) {
      console.log('📦 Pedido associado:');
      console.log(`   ID: ${sessao.pedido.id}`);
      console.log(`   Code: ${sessao.pedido.code}`);
      console.log(`   Status: ${sessao.pedido.status}`);
      console.log(`   Descrição: ${sessao.pedido.description || 'N/A'}`);
      console.log(`   Valor: R$ ${((sessao.pedido.amount || 0) / 100).toFixed(2)}`);
      console.log('');
    }

    // Sempre reativar se expirou ou está prestes a expirar (menos de 30 minutos)
    // Isso garante que a sessão tenha tempo suficiente e evita problemas de timezone
    const minutosRestantesAteExpirar = expirada ? 0 : minutosRestantes;
    const precisaReativar = !ativa || expirada || (minutosRestantesAteExpirar < 30 && minutosRestantesAteExpirar >= 0);
    
    if (precisaReativar) {
      if (expirada) {
        console.log('⏰ Sessão expirou. Reativando com novo tempo...');
      } else if (minutosRestantesAteExpirar < 5) {
        console.log(`⏰ Sessão está prestes a expirar (${minutosRestantesAteExpirar} min). Reativando...`);
      } else {
        console.log('💡 Sessão não está ativa no banco. Reativando...');
      }
      
      // Calcular novo tempo de expiração (2 horas a partir de agora)
      const minutos = 120;
      const novoExpiraEm = new Date(agora.getTime() + minutos * 60 * 1000);

      try {
        const sessaoAtualizada = await prisma.sessaoAtiva.update({
          where: { id: sessao.id },
          data: {
            ativo: true,
            expiraEm: novoExpiraEm,
          },
        });

        console.log('✅ Sessão reativada com sucesso!');
        console.log(`   Nova expiração: ${sessaoAtualizada.expiraEm.toISOString()}`);
        console.log(`   Expira em: ${minutos} minutos (${Math.floor(minutos / 60)}h ${minutos % 60}min)`);
        console.log(`   Status: ✅ ATIVA`);
        console.log('');
        console.log('💡 A sessão deve aparecer como "Ativa" na página de acessos agora.');
        console.log('   Aguarde alguns segundos e recarregue a página.');
      } catch (err) {
        console.error('❌ Erro ao reativar sessão:', err.message);
        console.error(err);
      }
    } else {
      console.log('✅ Sessão já está ativa!');
      console.log(`   Expira em: ${minutosRestantes} minutos`);
      console.log('');
      if (minutosRestantes < 10) {
        console.log('⚠️  Sessão está prestes a expirar. Deseja reativar mesmo assim?');
        console.log('   Execute novamente o script para reativar.');
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

