#!/usr/bin/env node
// Script para verificar status completo de um cliente específico

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const MAC = '8A:22:3C:F4:F9:70';
const IP = '192.168.88.80';

async function verificarCliente() {
  console.log('🔍 Verificando cliente:');
  console.log(`   MAC: ${MAC}`);
  console.log(`   IP:  ${IP}`);
  console.log('');

  try {
    // 1. Buscar pedidos com esse MAC ou IP
    console.log('📋 1. Buscando pedidos...');
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
            ip: true,
            mikrotikHost: true,
          },
        },
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        SessaoAtiva: {
          where: { ativo: true },
          take: 1,
          include: {
            roteador: {
              select: {
                nome: true,
                ipLan: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (pedidos.length === 0) {
      console.log('   ❌ Nenhum pedido encontrado para esse MAC/IP');
    } else {
      console.log(`   ✅ Encontrados ${pedidos.length} pedido(s)`);
      pedidos.forEach((p, idx) => {
        console.log(`\n   Pedido ${idx + 1}:`);
        console.log(`   - ID: ${p.id}`);
        console.log(`   - Code: ${p.code}`);
        console.log(`   - Status: ${p.status}`);
        console.log(`   - Valor: R$ ${(p.amount / 100).toFixed(2)}`);
        console.log(`   - Data: ${p.createdAt.toISOString()}`);
        console.log(`   - IP no pedido: ${p.ip || 'não informado'}`);
        console.log(`   - MAC no pedido: ${p.deviceMac || 'não informado'}`);
        console.log(`   - Device ID: ${p.deviceId || 'não informado'}`);
        console.log(`   - Device MikId: ${p.device?.mikId || 'não informado'}`);
        console.log(`   - Device Host: ${p.device?.mikrotikHost || 'não informado'}`);
        
        if (p.SessaoAtiva && p.SessaoAtiva.length > 0) {
          const sessao = p.SessaoAtiva[0];
          console.log(`   - ✅ Sessão Ativa:`);
          console.log(`     * IP: ${sessao.ipCliente}`);
          console.log(`     * MAC: ${sessao.macCliente || 'não informado'}`);
          console.log(`     * Expira em: ${sessao.expiraEm.toISOString()}`);
          console.log(`     * Roteador: ${sessao.roteador?.nome || sessao.roteador?.ipLan || 'não informado'}`);
          const agora = new Date();
          const expirado = sessao.expiraEm < agora;
          console.log(`     * Status: ${expirado ? '❌ EXPIRADO' : '✅ ATIVO'}`);
        } else {
          console.log(`   - ⚠️  Nenhuma sessão ativa encontrada`);
        }

        if (p.charges && p.charges.length > 0) {
          const charge = p.charges[0];
          console.log(`   - Charge: ${charge.status} (${charge.createdAt.toISOString()})`);
        }
      });
    }

    console.log('\n');

    // 2. Buscar sessões ativas com esse MAC ou IP
    console.log('🔐 2. Buscando sessões ativas...');
    const sessoes = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        OR: [
          { macCliente: { equals: MAC, mode: 'insensitive' } },
          { ipCliente: IP },
        ],
      },
      include: {
        pedido: {
          select: {
            id: true,
            code: true,
            status: true,
            amount: true,
          },
        },
        roteador: {
          select: {
            nome: true,
            ipLan: true,
          },
        },
      },
      orderBy: { inicioEm: 'desc' },
    });

    if (sessoes.length === 0) {
      console.log('   ❌ Nenhuma sessão ativa encontrada');
    } else {
      console.log(`   ✅ Encontradas ${sessoes.length} sessão(ões) ativa(s)`);
      sessoes.forEach((s, idx) => {
        console.log(`\n   Sessão ${idx + 1}:`);
        console.log(`   - ID: ${s.id}`);
        console.log(`   - IP: ${s.ipCliente}`);
        console.log(`   - MAC: ${s.macCliente || 'não informado'}`);
        console.log(`   - Início: ${s.inicioEm.toISOString()}`);
        console.log(`   - Expira: ${s.expiraEm.toISOString()}`);
        const agora = new Date();
        const expirado = s.expiraEm < agora;
        console.log(`   - Status: ${expirado ? '❌ EXPIRADO' : '✅ ATIVO'}`);
        console.log(`   - Pedido: ${s.pedido?.code || s.pedidoId || 'não informado'}`);
        console.log(`   - Roteador: ${s.roteador?.nome || s.roteador?.ipLan || 'não informado'}`);
      });
    }

    console.log('\n');

    // 3. Buscar pedidos recentes pagos (últimas 6 horas) para ver se tem algum relacionado
    console.log('💳 3. Buscando pedidos pagos recentes (últimas 6h)...');
    const agora = new Date();
    const seisHorasAtras = new Date(agora.getTime() - 6 * 60 * 60 * 1000);
    
    const pedidosRecentes = await prisma.pedido.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: seisHorasAtras },
        OR: [
          { ip: { contains: '192.168.88' } },
          { deviceMac: { contains: MAC.substring(0, 8) } },
        ],
      },
      select: {
        id: true,
        code: true,
        ip: true,
        deviceMac: true,
        status: true,
        createdAt: true,
        device: {
          select: {
            mikId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (pedidosRecentes.length > 0) {
      console.log(`   ℹ️  Encontrados ${pedidosRecentes.length} pedido(s) pagos recentes na mesma rede:`);
      pedidosRecentes.forEach((p) => {
        console.log(`   - ${p.code}: IP=${p.ip || 'não informado'}, MAC=${p.deviceMac || 'não informado'}, MikId=${p.device?.mikId || 'não informado'}`);
      });
    } else {
      console.log('   ⚠️  Nenhum pedido pago recente encontrado na mesma rede');
    }

    console.log('\n');

    // 4. Verificar se IP está no mesmo subnet que algum dispositivo cadastrado
    console.log('📡 4. Verificando dispositivos na mesma rede...');
    const dispositivos = await prisma.dispositivo.findMany({
      where: {
        ip: { startsWith: '192.168.88' },
      },
      select: {
        id: true,
        mikId: true,
        ip: true,
        mikrotikHost: true,
      },
    });

    if (dispositivos.length > 0) {
      console.log(`   ✅ Encontrados ${dispositivos.length} dispositivo(s) na mesma rede:`);
      dispositivos.forEach((d) => {
        console.log(`   - ${d.mikId}: IP=${d.ip}, Host=${d.mikrotikHost || 'não informado'}`);
      });
    } else {
      console.log('   ⚠️  Nenhum dispositivo encontrado na mesma rede');
    }

    console.log('\n');
    console.log('✅ Verificação concluída!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Se há pedido pago mas sem sessão ativa, liberar manualmente');
    console.log('   2. Se a sessão expirou, verificar se precisa renovar');
    console.log('   3. Se não há pedido, o cliente precisa pagar');

  } catch (error) {
    console.error('❌ Erro ao verificar cliente:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarCliente();

