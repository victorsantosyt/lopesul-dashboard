#!/usr/bin/env node
// Script para verificar status completo do sistema
// Uso: node status-sistema-completo.js

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env
const envPath = join(__dirname, '.env');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch (e) {
  console.error('❌ Erro ao ler .env:', e.message);
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
});

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

const RELAY_BASE = env.RELAY_URL || env.RELAY_BASE || 'http://localhost:4000';
const RELAY_TOKEN = env.RELAY_TOKEN || '';

function formatarData(data) {
  if (!data) return 'N/A';
  const d = new Date(data);
  const agora = new Date();
  const diffMs = agora - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffHr < 24) return `${diffHr}h atrás`;
  return `${Math.floor(diffHr / 24)} dias atrás`;
}

function formatarValor(centavos) {
  return `R$ ${((centavos || 0) / 100).toFixed(2)}`;
}

async function verificarRelay() {
  try {
    if (!RELAY_TOKEN || RELAY_TOKEN.length < 10) {
      return { ok: false, error: 'RELAY_TOKEN não configurado' };
    }
    
    const url = `${RELAY_BASE}/health`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RELAY_TOKEN}`,
      },
    });
    
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function verificarBanco() {
  try {
    await prisma.$connect();
    // Teste simples
    await prisma.pedido.count();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function main() {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 STATUS COMPLETO DO SISTEMA                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Verificar banco primeiro
    console.log('🔌 Verificando conexão com banco de dados...');
    const bancoStatus = await verificarBanco();
    if (!bancoStatus.ok) {
      console.log('');
      console.log('❌ ERRO: Não foi possível conectar ao banco de dados!');
      console.log(`   Erro: ${bancoStatus.error}`);
      console.log('');
      console.log('💡 Possíveis causas:');
      console.log('   1. Banco de dados Railway está offline');
      console.log('   2. Problema de rede/conectividade');
      console.log('   3. DATABASE_URL incorreta no .env');
      console.log('');
      console.log('🔧 Verifique:');
      console.log('   - Status do Railway: https://railway.app');
      console.log('   - DATABASE_URL no .env está correta?');
      console.log('   - Firewall/VPN bloqueando conexão?');
      console.log('');
      process.exit(1);
    }
    console.log('✅ Banco de dados conectado!');
    console.log('');

    const agora = new Date();
    const ultimaHora = new Date(agora.getTime() - 60 * 60 * 1000);
    const ultimas24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    // 1. STATUS DO RELAY
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔌 1️⃣ STATUS DO RELAY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const relayStatus = await verificarRelay();
    if (relayStatus.ok) {
      console.log('   ✅ Relay ONLINE');
      console.log(`   URL: ${RELAY_BASE}`);
    } else {
      console.log('   ❌ Relay OFFLINE ou com problemas');
      console.log(`   Erro: ${relayStatus.error}`);
    }
    console.log('');

    // 2. SESSÕES ATIVAS AGORA
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 2️⃣ SESSÕES ATIVAS (CONECTADOS AGORA)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const sessoesAtivas = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        expiraEm: { gte: agora },
      },
      include: {
        pedido: {
          select: {
            code: true,
            customerName: true,
            description: true,
            amount: true,
          },
        },
      },
      orderBy: { inicioEm: 'desc' },
      take: 10,
    });

    if (sessoesAtivas.length === 0) {
      console.log('   ⚠️  Nenhum cliente conectado no momento');
    } else {
      console.log(`   ✅ ${sessoesAtivas.length} cliente(s) conectado(s):`);
      sessoesAtivas.forEach((s, idx) => {
        const minutosRestantes = Math.floor((s.expiraEm - agora) / 60000);
        const nome = s.pedido?.customerName || s.macCliente || 'N/A';
        console.log(`   ${idx + 1}. ${nome}`);
        console.log(`      IP: ${s.ipCliente} | MAC: ${s.macCliente || 'N/A'}`);
        console.log(`      Plano: ${s.plano || 'N/A'} | Expira em: ${minutosRestantes} min`);
        console.log(`      Pedido: ${s.pedido?.code || 'N/A'} | Valor: ${s.pedido?.amount ? formatarValor(s.pedido.amount) : 'N/A'}`);
        console.log('');
      });
    }
    console.log('');

    // 3. ÚLTIMOS PAGAMENTOS (última hora)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 3️⃣ ÚLTIMOS PAGAMENTOS (última hora)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const pagamentosRecentes = await prisma.pedido.findMany({
      where: {
        createdAt: { gte: ultimaHora },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (pagamentosRecentes.length === 0) {
      console.log('   ⚠️  Nenhum pagamento na última hora');
    } else {
      console.log(`   ✅ ${pagamentosRecentes.length} pagamento(s) na última hora:`);
      pagamentosRecentes.forEach((p, idx) => {
        const statusEmoji = p.status === 'PAID' ? '✅' : p.status === 'PENDING' ? '⏳' : '❌';
        console.log(`   ${idx + 1}. ${statusEmoji} ${p.code}`);
        console.log(`      Status: ${p.status} | Valor: ${formatarValor(p.amount)}`);
        console.log(`      Cliente: ${p.customerName || 'N/A'} | IP: ${p.ip || 'N/A'}`);
        console.log(`      ${formatarData(p.createdAt)}`);
        console.log('');
      });
    }
    console.log('');

    // 4. PAGAMENTOS HOJE
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📅 4️⃣ PAGAMENTOS HOJE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const hojeInicio = new Date(agora);
    hojeInicio.setHours(0, 0, 0, 0);
    
    const pagamentosHoje = await prisma.pedido.findMany({
      where: {
        createdAt: { gte: hojeInicio },
      },
    });

    const pagosHoje = pagamentosHoje.filter(p => p.status === 'PAID');
    const totalHoje = pagosHoje.reduce((sum, p) => sum + (p.amount || 0), 0);

    console.log(`   Total de pedidos hoje: ${pagamentosHoje.length}`);
    console.log(`   ✅ Pagos: ${pagosHoje.length}`);
    console.log(`   💰 Receita hoje: ${formatarValor(totalHoje)}`);
    console.log('');

    // 5. ÚLTIMAS SESSÕES (últimas 24h)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 5️⃣ ÚLTIMAS SESSÕES (últimas 24h)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const sessoesRecentes = await prisma.sessaoAtiva.findMany({
      where: {
        inicioEm: { gte: ultimas24h },
      },
      include: {
        pedido: {
          select: {
            code: true,
            customerName: true,
            amount: true,
          },
        },
      },
      orderBy: { inicioEm: 'desc' },
      take: 10,
    });

    if (sessoesRecentes.length === 0) {
      console.log('   ⚠️  Nenhuma sessão nas últimas 24h');
    } else {
      console.log(`   ✅ ${sessoesRecentes.length} sessão(ões) nas últimas 24h:`);
      sessoesRecentes.forEach((s, idx) => {
        const ativa = s.ativo && s.expiraEm >= agora;
        const status = ativa ? '✅ ATIVA' : '❌ INATIVA';
        console.log(`   ${idx + 1}. ${status} - ${s.pedido?.customerName || s.macCliente || 'N/A'}`);
        console.log(`      IP: ${s.ipCliente} | ${formatarData(s.inicioEm)}`);
        console.log(`      Pedido: ${s.pedido?.code || 'N/A'}`);
        console.log('');
      });
    }
    console.log('');

    // 6. DISPOSITIVOS/ROTEADORES
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚌 6️⃣ DISPOSITIVOS/ROTEADORES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const dispositivos = await prisma.dispositivo.findMany({
      select: {
        id: true,
        mikId: true,
        ip: true,
        mikrotikHost: true,
      },
      take: 10,
    });

    const roteadores = await prisma.roteador.findMany({
      select: {
        id: true,
        nome: true,
        ipLan: true,
        statusMikrotik: true,
      },
      take: 10,
    });

    console.log(`   Dispositivos cadastrados: ${dispositivos.length}`);
    dispositivos.forEach((d, idx) => {
      console.log(`   ${idx + 1}. ${d.mikId || 'N/A'} (${d.ip || d.mikrotikHost || 'N/A'})`);
    });
    console.log('');
    console.log(`   Roteadores cadastrados: ${roteadores.length}`);
    roteadores.forEach((r, idx) => {
      const status = r.statusMikrotik === 'ONLINE' ? '✅' : r.statusMikrotik === 'OFFLINE' ? '❌' : '⚠️';
      console.log(`   ${idx + 1}. ${status} ${r.nome} (${r.ipLan})`);
    });
    console.log('');

    // 7. ALERTAS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚨 7️⃣ ALERTAS E PROBLEMAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const alertas = [];

    if (!relayStatus.ok) {
      alertas.push('❌ Relay está offline ou com problemas');
    }

    const pedidosPendentes = await prisma.pedido.count({
      where: {
        status: 'PENDING',
        createdAt: { gte: ultimas24h },
      },
    });

    if (pedidosPendentes > 0) {
      alertas.push(`⚠️  ${pedidosPendentes} pedido(s) pendente(s) nas últimas 24h`);
    }

    const sessoesExpiradas = await prisma.sessaoAtiva.count({
      where: {
        ativo: true,
        expiraEm: { lt: agora },
      },
    });

    if (sessoesExpiradas > 0) {
      alertas.push(`⚠️  ${sessoesExpiradas} sessão(ões) marcada(s) como ativa mas já expirada(s)`);
    }

    if (alertas.length === 0) {
      console.log('   ✅ Nenhum alerta - Sistema funcionando normalmente!');
    } else {
      alertas.forEach((alerta, idx) => {
        console.log(`   ${idx + 1}. ${alerta}`);
      });
    }
    console.log('');

    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                          ✅ VERIFICAÇÃO COMPLETA                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('💡 Para monitorar em tempo real:');
    console.log('   watch -n 30 "node status-sistema-completo.js"');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

