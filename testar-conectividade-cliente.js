#!/usr/bin/env node
// Script para testar conectividade do cliente no Mikrotik
// Uso: node testar-conectividade-cliente.js [mikId] [IP do cliente]

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

async function execMikrotikCommand(host, user, pass, command) {
  try {
    if (!RELAY_TOKEN || RELAY_TOKEN.length < 10) {
      return { ok: false, error: 'RELAY_TOKEN ausente ou inválido no .env' };
    }

    const url = `${RELAY_BASE}/relay/exec`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RELAY_TOKEN}`,
      },
      body: JSON.stringify({
        host,
        user,
        pass,
        command,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text}` };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function main() {
  try {
    const mikIdOrIp = process.argv[2] || 'LOPESUL-HOTSPOT-06';
    const clienteIp = process.argv[3];
    
    if (!clienteIp) {
      console.log('📋 Uso: node testar-conectividade-cliente.js [mikId] <IP do cliente>');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node testar-conectividade-cliente.js LOPESUL-HOTSPOT-06 192.168.88.199');
      process.exit(1);
    }

    console.log('🔍 Testando conectividade do cliente...');
    console.log(`   Roteador: ${mikIdOrIp}`);
    console.log(`   Cliente IP: ${clienteIp}`);
    console.log('');

    // Buscar roteador
    let roteador = null;
    
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

    if (dispositivo?.frota?.roteador) {
      roteador = dispositivo.frota.roteador;
    } else {
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
      return;
    }

    const host = roteador.ipLan;
    const user = roteador.usuario || 'relay';
    const pass = env.MIKROTIK_PASS || '';

    if (!pass) {
      console.error('❌ MIKROTIK_PASS não configurado no .env');
      return;
    }

    console.log(`✅ Roteador: ${roteador.nome} (${host})`);
    console.log('');

    // Testar ping do Mikrotik para o cliente
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ Testando conectividade do Mikrotik para o cliente');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ping = await execMikrotikCommand(host, user, pass, `/ping count=3 address=${clienteIp}`);
    if (ping.ok) {
      console.log('   ✅ Cliente está respondendo ao ping');
    } else {
      console.log(`   ⚠️  Cliente não respondeu ao ping: ${ping.error || 'Desconhecido'}`);
      console.log('   (Isso pode ser normal se o cliente bloqueia ping)');
    }
    console.log('');

    // Verificar conexões ativas do cliente
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ Conexões ativas do cliente');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const connections = await execMikrotikCommand(host, user, pass, '/ip/firewall/connection/print');
    if (connections.ok && Array.isArray(connections.data)) {
      const clienteConnections = connections.data.filter(c => 
        c['src-address'] === clienteIp || c['dst-address'] === clienteIp
      );
      
      if (clienteConnections.length > 0) {
        console.log(`   ✅ ${clienteConnections.length} conexão(ões) ativa(s) do cliente:`);
        clienteConnections.slice(0, 5).forEach((c, idx) => {
          console.log(`   ${idx + 1}. ${c['src-address']}:${c['src-port'] || 'N/A'} -> ${c['dst-address']}:${c['dst-port'] || 'N/A'}`);
          console.log(`      Protocol: ${c.protocol || 'N/A'} | State: ${c.tcp_state || c.state || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   ⚠️  Nenhuma conexão ativa do cliente');
        console.log('   Isso pode indicar que o tráfego está sendo bloqueado');
      }
    }
    console.log('');

    // Verificar regras que podem estar bloqueando
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ Verificando regras que podem estar bloqueando');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      // Encontrar regras que bloqueiam 192.168.88.0/24 mas não excluem paid_clients
      const regrasBloqueio = filterRules.data.filter(r => 
        (r.action === 'drop' || r.action === 'reject') &&
        (r['src-address'] === '192.168.88.0/24' || r['src-address'] === clienteIp) &&
        (!r['src-address-list'] || !r['src-address-list'].includes('!paid_clients'))
      );
      
      if (regrasBloqueio.length > 0) {
        console.log(`   ⚠️  ${regrasBloqueio.length} regra(s) pode(m) estar bloqueando:`);
        regrasBloqueio.forEach((r, idx) => {
          console.log(`   ${idx + 1}. ID: ${r['.id']} | Action: ${r.action}`);
          console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
          console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   ✅ Nenhuma regra problemática encontrada');
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMENDAÇÕES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se o cliente não consegue acessar:');
    console.log('   1. Verifique se há rota padrão configurada');
    console.log('   2. Verifique se o NAT masquerade está na interface correta');
    console.log('   3. Teste ping do cliente para 8.8.8.8');
    console.log('   4. Verifique logs do firewall: /log print where topics~firewall');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

