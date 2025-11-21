#!/usr/bin/env node
// Script para ver logs do Mikrotik via relay API
// Uso: node ver-logs-mikrotik.js [mikId ou IP]
// Exemplo: node ver-logs-mikrotik.js LOPESUL-HOTSPOT-06

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env manualmente
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

async function execMikrotikCommand(host, user, pass, command) {
  try {
    const url = `${RELAY_BASE}/relay/exec`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RELAY_TOKEN ? { 'X-Relay-Token': RELAY_TOKEN } : {}),
      },
      body: JSON.stringify({
        host,
        user,
        pass,
        command,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Erro ao executar comando via relay:', error.message);
    return { ok: false, error: error.message };
  }
}

async function main() {
  try {
    const mikIdOrIp = process.argv[2] || 'LOPESUL-HOTSPOT-06';
    
    console.log('🔍 Verificando logs do Mikrotik...');
    console.log(`   Identificador: ${mikIdOrIp}`);
    console.log('');

    // Buscar dispositivo/roteador
    let roteador = null;
    
    // Tentar buscar dispositivo por mikId
    const dispositivo = await prisma.dispositivo.findFirst({
      where: {
        mikId: { equals: mikIdOrIp, mode: 'insensitive' },
      },
      include: {
        frota: {
          include: {
            roteador: true,
          },
        },
      },
    });

    // Se encontrou dispositivo e a frota tem roteador, usar esse
    if (dispositivo?.frota?.roteador) {
      roteador = dispositivo.frota.roteador;
    } else if (dispositivo?.mikrotikHost) {
      // Se o dispositivo tem mikrotikHost, buscar roteador por IP
      roteador = await prisma.roteador.findFirst({
        where: {
          ipLan: dispositivo.mikrotikHost,
        },
      });
    }
    
    // Se ainda não encontrou, tentar buscar roteador diretamente por IP ou nome
    if (!roteador) {
      roteador = await prisma.roteador.findFirst({
        where: {
          OR: [
            { ipLan: mikIdOrIp },
            { nome: { contains: mikIdOrIp, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!roteador) {
      console.log('❌ Roteador não encontrado!');
      console.log('');
      console.log('💡 Roteadores disponíveis:');
      const todos = await prisma.roteador.findMany({
        select: { id: true, nome: true, ipLan: true },
      });
      todos.forEach(r => {
        console.log(`   - ${r.nome} (${r.ipLan})`);
      });
      return;
    }

    console.log(`✅ Roteador encontrado: ${roteador.nome}`);
    console.log(`   IP: ${roteador.ipLan}`);
    console.log(`   Usuário: ${roteador.usuario || 'relay'}`);
    console.log('');

    const host = roteador.ipLan;
    const user = roteador.usuario || 'relay';
    const pass = env.MIKROTIK_PASS || '';

    if (!pass) {
      console.error('❌ MIKROTIK_PASS não configurado no .env');
      return;
    }

    // 1. Sessões ativas
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 1️⃣ SESSÕES ATIVAS DO HOTSPOT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const ativas = await execMikrotikCommand(host, user, pass, '/ip/hotspot/active/print detail');
    if (ativas.ok && Array.isArray(ativas.data)) {
      if (ativas.data.length === 0) {
        console.log('   ⚠️  Nenhuma sessão ativa');
      } else {
        ativas.data.forEach((sessao, idx) => {
          console.log(`\n   Sessão ${idx + 1}:`);
          console.log(`   IP: ${sessao.address || 'N/A'}`);
          console.log(`   MAC: ${sessao['mac-address'] || 'N/A'}`);
          console.log(`   Usuário: ${sessao.user || 'N/A'}`);
          console.log(`   Uptime: ${sessao.uptime || 'N/A'}`);
          console.log(`   Bytes: ${sessao.bytes || 'N/A'}`);
        });
      }
    } else {
      console.log('   ❌ Erro ao buscar sessões:', ativas.error || 'Desconhecido');
    }
    console.log('');

    // 2. Clientes pagos
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 2️⃣ CLIENTES PAGOS (paid_clients)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const paid = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print where list=paid_clients');
    if (paid.ok && Array.isArray(paid.data)) {
      if (paid.data.length === 0) {
        console.log('   ⚠️  Nenhum cliente na lista paid_clients');
      } else {
        paid.data.forEach((item, idx) => {
          console.log(`   ${idx + 1}. IP: ${item.address || 'N/A'} | Comentário: ${item.comment || 'N/A'}`);
        });
      }
    } else {
      console.log('   ❌ Erro ao buscar paid_clients:', paid.error || 'Desconhecido');
    }
    console.log('');

    // 3. IP Bindings
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 3️⃣ IP BINDINGS (BYPASSED)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const bindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print where type=bypassed');
    if (bindings.ok && Array.isArray(bindings.data)) {
      if (bindings.data.length === 0) {
        console.log('   ⚠️  Nenhum IP binding bypassed');
      } else {
        bindings.data.forEach((binding, idx) => {
          console.log(`   ${idx + 1}. IP: ${binding.address || 'N/A'} | MAC: ${binding['mac-address'] || 'N/A'} | Comentário: ${binding.comment || 'N/A'}`);
        });
      }
    } else {
      console.log('   ❌ Erro ao buscar IP bindings:', bindings.error || 'Desconhecido');
    }
    console.log('');

    // 4. Logs recentes
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 4️⃣ LOGS RECENTES DO HOTSPOT (últimas 20)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const logs = await execMikrotikCommand(host, user, pass, '/log/print where topics~"hotspot" follow=no');
    if (logs.ok && Array.isArray(logs.data)) {
      if (logs.data.length === 0) {
        console.log('   ⚠️  Nenhum log encontrado');
      } else {
        const recentes = logs.data.slice(-20).reverse(); // Últimas 20, mais recentes primeiro
        recentes.forEach((log, idx) => {
          const time = log.time || 'N/A';
          const topic = log.topics || 'N/A';
          const message = log.message || 'N/A';
          console.log(`   [${time}] [${topic}] ${message}`);
        });
      }
    } else {
      console.log('   ❌ Erro ao buscar logs:', logs.error || 'Desconhecido');
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Verificação completa!');
    console.log('');
    console.log('💡 Dica: Para monitorar em tempo real, use:');
    console.log('   ./monitorar-mikrotik-tempo-real.sh');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

