#!/usr/bin/env node
// Script para criar/atualizar sessão ativa manualmente

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const IP = process.argv[2] || '192.168.88.80';
const MAC = process.argv[3] || '8A:22:3C:F4:F9:70';
const PEDIDO_ID = process.argv[4] || 'cmi84978v0001l31qt5nd2xkd';

async function criarSessao() {
  console.log('🔐 Criando/atualizando sessão ativa:');
  console.log(`   IP: ${IP}`);
  console.log(`   MAC: ${MAC}`);
  console.log(`   Pedido ID: ${PEDIDO_ID}`);
  console.log('');

  try {
    // Buscar pedido
    const pedido = await prisma.pedido.findUnique({
      where: { id: PEDIDO_ID },
      select: {
        id: true,
        code: true,
        description: true,
        deviceId: true,
        device: {
          select: {
            mikId: true,
            mikrotikHost: true,
          },
        },
      },
    });

    if (!pedido) {
      console.error('❌ Pedido não encontrado:', PEDIDO_ID);
      process.exit(1);
    }

    console.log('✅ Pedido encontrado:', pedido.code);
    console.log('');

    // Buscar roteador se disponível
    let roteadorId = null;
    if (pedido.device?.mikrotikHost) {
      const roteador = await prisma.roteador.findFirst({
        where: {
          ipLan: pedido.device.mikrotikHost,
        },
      });
      if (roteador) {
        roteadorId = roteador.id;
        console.log('✅ Roteador encontrado:', roteador.nome || roteador.ipLan);
      }
    }

    // Calcular expiração (120 minutos)
    const minutos = 120;
    const now = new Date();
    const expiraEm = new Date(now.getTime() + minutos * 60 * 1000);

    // Usar upsert para criar ou atualizar
    const sessao = await prisma.sessaoAtiva.upsert({
      where: {
        ipCliente: IP,
      },
      update: {
        macCliente: MAC || null,
        plano: pedido.description || 'Acesso',
        expiraEm,
        ativo: true,
        pedidoId: pedido.id,
        roteadorId: roteadorId || undefined,
      },
      create: {
        ipCliente: IP,
        macCliente: MAC || null,
        plano: pedido.description || 'Acesso',
        inicioEm: now,
        expiraEm,
        ativo: true,
        pedidoId: pedido.id,
        roteadorId,
      },
    });

    console.log('');
    console.log('✅ Sessão ativa criada/atualizada:');
    console.log(`   ID: ${sessao.id}`);
    console.log(`   IP: ${sessao.ipCliente}`);
    console.log(`   MAC: ${sessao.macCliente || 'N/A'}`);
    console.log(`   Expira em: ${sessao.expiraEm.toISOString()}`);
    console.log(`   Pedido: ${pedido.code}`);
    console.log(`   Roteador ID: ${sessao.roteadorId || 'N/A'}`);
    console.log('');
    console.log('💡 A sessão ativa foi criada/atualizada com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code === 'P2002') {
      console.error('   Erro de constraint única (já existe sessão com esse IP)');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

criarSessao();

