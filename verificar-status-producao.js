#!/usr/bin/env node
// Script para verificar o status geral do sistema em produção
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("📊 Status do Sistema - Produção\n");
  console.log("=" .repeat(50));
  console.log("");

  try {
    // 1. Pedidos recentes (últimas 24 horas)
    const agora = new Date();
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    const pedidos24h = await prisma.pedido.findMany({
      where: {
        createdAt: { gte: ontem },
      },
    });

    const pedidosPagos = pedidos24h.filter(p => p.status === 'PAID');
    const pedidosPendentes = pedidos24h.filter(p => p.status === 'PENDING');
    const totalArrecadado = pedidosPagos.reduce((sum, p) => sum + p.amount, 0);

    console.log("💰 PEDIDOS (Últimas 24 horas):");
    console.log(`   Total: ${pedidos24h.length}`);
    console.log(`   ✅ Pagos: ${pedidosPagos.length}`);
    console.log(`   ⏳ Pendentes: ${pedidosPendentes.length}`);
    console.log(`   💵 Total arrecadado: R$ ${(totalArrecadado / 100).toFixed(2)}`);
    console.log("");

    // 2. Sessões ativas
    const sessoesAtivas = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        expiraEm: { gte: agora },
      },
    });

    console.log("👥 SESSÕES ATIVAS:");
    console.log(`   Total: ${sessoesAtivas.length}`);
    console.log("");

    // 3. Dispositivos
    const dispositivos = await prisma.dispositivo.findMany({
      select: {
        id: true,
        mikId: true,
        ip: true,
      },
    });

    console.log("📡 DISPOSITIVOS:");
    console.log(`   Total: ${dispositivos.length}`);
    dispositivos.forEach(d => {
      console.log(`   - ${d.ip} (${d.mikId || 'sem mikId'})`);
    });
    console.log("");

    // 4. Pedidos pendentes há mais de 1 hora
    const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);
    const pedidosPendentesAntigos = await prisma.pedido.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: umaHoraAtras },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    if (pedidosPendentesAntigos.length > 0) {
      console.log("⚠️  PEDIDOS PENDENTES HÁ MAIS DE 1 HORA:");
      pedidosPendentesAntigos.forEach(p => {
        const horasAtras = Math.floor((agora - p.createdAt) / (60 * 60 * 1000));
        console.log(`   - ${p.code} (${horasAtras}h atrás) - R$ ${(p.amount / 100).toFixed(2)}`);
      });
      console.log("");
    }

    // 5. Sessões expiradas que ainda estão ativas
    const sessoesExpiradas = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        expiraEm: { lt: agora },
      },
    });

    if (sessoesExpiradas.length > 0) {
      console.log("⚠️  SESSÕES EXPIRADAS AINDA ATIVAS:");
      console.log(`   Total: ${sessoesExpiradas.length}`);
      console.log("   💡 Considere limpar essas sessões");
      console.log("");
    }

    // 6. Resumo de status
    console.log("=" .repeat(50));
    console.log("📋 RESUMO:");
    
    const statusGeral = {
      pedidos24h: pedidos24h.length,
      pedidosPagos: pedidosPagos.length,
      taxaConversao: pedidos24h.length > 0 
        ? ((pedidosPagos.length / pedidos24h.length) * 100).toFixed(1) 
        : '0.0',
      totalArrecadado: (totalArrecadado / 100).toFixed(2),
      sessoesAtivas: sessoesAtivas.length,
      dispositivos: dispositivos.length,
      pedidosPendentesAntigos: pedidosPendentesAntigos.length,
      sessoesExpiradas: sessoesExpiradas.length,
    };

    console.log(JSON.stringify(statusGeral, null, 2));

    // 7. Alertas
    console.log("");
    console.log("🚨 ALERTAS:");
    
    if (pedidosPendentesAntigos.length > 5) {
      console.log("   ⚠️  Muitos pedidos pendentes há mais de 1 hora!");
    }
    
    if (sessoesExpiradas.length > 0) {
      console.log("   ⚠️  Há sessões expiradas que precisam ser limpas!");
    }
    
    if (pedidos24h.length === 0) {
      console.log("   ⚠️  Nenhum pedido nas últimas 24 horas!");
    }
    
    if (pedidos24h.length > 0 && pedidosPagos.length === 0) {
      console.log("   ⚠️  Nenhum pedido foi pago nas últimas 24 horas!");
    }

    if (Object.keys(statusGeral).filter(k => k.includes('Antigos') || k.includes('Expiradas')).every(k => statusGeral[k] === 0) && 
        pedidos24h.length > 0 && 
        pedidosPagos.length > 0) {
      console.log("   ✅ Sistema funcionando normalmente!");
    }

  } catch (error) {
    console.error("❌ Erro ao verificar status:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

