#!/usr/bin/env node
// Script para liberar acesso manualmente para um cliente
// Uso: node liberar-cliente-manual.js <IP> <MAC> [pedidoCode]
import { PrismaClient } from '@prisma/client';
import { liberarAcesso } from './src/lib/mikrotik.js';
import { requireDeviceRouter } from './src/lib/device-router.js';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('❌ Uso: node liberar-cliente-manual.js <IP> <MAC> [pedidoCode]');
    console.log('');
    console.log('Exemplo:');
    console.log('  node liberar-cliente-manual.js 192.168.88.68 24:29:34:91:1A:18');
    console.log('  node liberar-cliente-manual.js 192.168.88.68 24:29:34:91:1A:18 KPN2TGTO8Z');
    process.exit(1);
  }

  const ip = args[0];
  const mac = args[1];
  const pedidoCode = args[2] || null;

  console.log('🔓 Liberando acesso manualmente...');
  console.log(`   IP: ${ip}`);
  console.log(`   MAC: ${mac}`);
  if (pedidoCode) {
    console.log(`   Pedido: ${pedidoCode}`);
  }
  console.log('');

  try {
    // Buscar pedido se código foi fornecido
    let pedido = null;
    if (pedidoCode) {
      pedido = await prisma.pedido.findFirst({
        where: {
          OR: [
            { code: pedidoCode },
            { id: pedidoCode },
          ],
        },
        include: {
          device: true,
        },
      });

      if (pedido) {
        console.log('✅ Pedido encontrado:', {
          id: pedido.id,
          code: pedido.code,
          status: pedido.status,
          deviceId: pedido.deviceId,
        });
      } else {
        console.log('⚠️  Pedido não encontrado, continuando sem pedido...');
      }
    }

    // Buscar dispositivo/router
    let routerInfo = null;
    if (pedido?.deviceId || pedido?.device?.mikId) {
      try {
        routerInfo = await requireDeviceRouter({
          deviceId: pedido.deviceId,
          mikId: pedido.device?.mikId,
        });
        console.log('✅ Router encontrado:', routerInfo.router?.host);
      } catch (err) {
        console.log('⚠️  Erro ao buscar router, tentando detectar automaticamente...');
      }
    }

    // Se não encontrou router pelo pedido, tentar detectar pelo IP
    if (!routerInfo && ip) {
      try {
        // Buscar dispositivo pelo IP
        const dispositivo = await prisma.dispositivo.findFirst({
          where: {
            ip: {
              startsWith: ip.split('.').slice(0, 3).join('.') + '.',
            },
          },
        });

        if (dispositivo) {
          routerInfo = await requireDeviceRouter({
            deviceId: dispositivo.id,
            mikId: dispositivo.mikId,
          });
          console.log('✅ Router detectado pelo IP:', routerInfo.router?.host);
        }
      } catch (err) {
        console.log('⚠️  Não foi possível detectar router automaticamente');
      }
    }

    // Se ainda não tem router, usar LOPESUL-HOTSPOT-06 como padrão (do log)
    if (!routerInfo) {
      try {
        routerInfo = await requireDeviceRouter({
          mikId: 'LOPESUL-HOTSPOT-06',
        });
        console.log('✅ Router padrão encontrado:', routerInfo.router?.host);
      } catch (err) {
        console.error('❌ Erro: Não foi possível encontrar router!');
        console.error('   Erro:', err.message);
        process.exit(1);
      }
    }

    // Liberar acesso
    console.log('');
    console.log('🔓 Liberando acesso no Mikrotik...');
    
    const resultado = await liberarAcesso({
      ip,
      mac,
      orderId: pedidoCode || pedido?.code || 'manual',
      pedidoId: pedido?.id,
      deviceId: pedido?.deviceId || routerInfo.device?.id,
      mikId: routerInfo.device?.mikId,
      comment: `Manual: ${pedidoCode || 'sem-pedido'}`,
      router: routerInfo.router,
    });

    if (resultado.ok) {
      console.log('✅ Acesso liberado com sucesso!');
      console.log(`   Via: ${resultado.via || 'desconhecido'}`);
      
      // Criar sessão ativa se pedido existe
      if (pedido) {
        try {
          const minutos = 120;
          const now = new Date();
          const expiraEm = new Date(now.getTime() + minutos * 60 * 1000);

          // Verificar se já existe sessão ativa
          const sessaoExistente = await prisma.sessaoAtiva.findFirst({
            where: {
              ipCliente: ip,
              ativo: true,
            },
          });

          if (sessaoExistente) {
            console.log('⚠️  Já existe sessão ativa para este IP, atualizando...');
            await prisma.sessaoAtiva.update({
              where: { id: sessaoExistente.id },
              data: {
                macCliente: mac,
                expiraEm,
                ativo: true,
                pedidoId: pedido.id,
              },
            });
            console.log('✅ Sessão atualizada');
          } else {
            const sessao = await prisma.sessaoAtiva.create({
              data: {
                ipCliente: ip,
                macCliente: mac,
                plano: pedido.description || 'Acesso',
                inicioEm: now,
                expiraEm,
                ativo: true,
                pedidoId: pedido.id,
              },
            });
            console.log('✅ Sessão ativa criada:', sessao.id);
          }
        } catch (sessaoErr) {
          console.error('⚠️  Erro ao criar sessão ativa (não crítico):', sessaoErr.message);
        }
      }

      console.log('');
      console.log('✅ Cliente liberado com sucesso!');
      console.log(`   IP: ${ip}`);
      console.log(`   MAC: ${mac}`);
      if (pedido) {
        console.log(`   Pedido: ${pedido.code} (${pedido.status})`);
      }
    } else {
      console.error('❌ Erro ao liberar acesso:', resultado.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

