#!/usr/bin/env node
// Script para diagnosticar cliente que está saindo e entrando da rede constantemente
// Uso: node diagnosticar-cliente-desconectando.js <IP> [MAC] [mikId]

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
  if (!RELAY_TOKEN) {
    return { ok: false, error: 'RELAY_TOKEN ausente' };
  }
  try {
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

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${data.error || response.statusText}` };
    }
    return data;
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function main() {
  try {
    const IP = process.argv[2];
    const MAC = process.argv[3] || null;
    const MIK_ID = process.argv[4] || null;
    
    if (!IP) {
      console.log('📋 Uso: node diagnosticar-cliente-desconectando.js <IP> [MAC] [mikId]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node diagnosticar-cliente-desconectando.js 192.168.88.82');
      console.log('   node diagnosticar-cliente-desconectando.js 192.168.88.82 4A:CE:1D:DC:36:E3');
      console.log('   node diagnosticar-cliente-desconectando.js 192.168.88.82 4A:CE:1D:DC:36:E3 LOPESUL-HOTSPOT-06');
      process.exit(1);
    }

    console.log('🔍 Diagnosticando cliente que está saindo e entrando da rede...');
    console.log(`   IP: ${IP}`);
    if (MAC) console.log(`   MAC: ${MAC}`);
    if (MIK_ID) console.log(`   MikId: ${MIK_ID}`);
    console.log('');

    // Buscar roteador
    let roteador = null;
    
    if (MIK_ID) {
      const dispositivo = await prisma.dispositivo.findUnique({
        where: { mikId: MIK_ID },
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
      }
    } else {
      const sessao = await prisma.sessaoAtiva.findFirst({
        where: { ipCliente: IP },
        include: { roteador: true },
        orderBy: { inicioEm: 'desc' },
      });
      
      if (sessao?.roteador) {
        roteador = sessao.roteador;
      }
    }

    if (!roteador) {
      console.log('❌ Roteador não encontrado!');
      return;
    }

    const host = roteador.ipLan;
    const user = roteador.usuario;
    const pass = roteador.senhaHash;

    console.log(`✅ Roteador: ${roteador.nome} (${host})`);
    console.log('');

    // 1. Verificar status atual
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ STATUS ATUAL DO CLIENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1.1. Sessão ativa do hotspot
    const activeSessions = await execMikrotikCommand(host, user, pass, '/ip/hotspot/active/print');
    if (activeSessions.ok && Array.isArray(activeSessions.data)) {
      const sessaoAtiva = activeSessions.data.find(s => 
        s.address === IP || (MAC && s['mac-address'] === MAC)
      );
      if (sessaoAtiva) {
        console.log('✅ Cliente está conectado no hotspot:');
        console.log(`   IP: ${sessaoAtiva.address}`);
        console.log(`   MAC: ${sessaoAtiva['mac-address'] || 'N/A'}`);
        console.log(`   Usuário: ${sessaoAtiva.user || 'N/A'}`);
        console.log(`   Uptime: ${sessaoAtiva.uptime || 'N/A'}`);
        console.log(`   Bytes: ${sessaoAtiva.bytes || 'N/A'}`);
      } else {
        console.log('❌ Cliente NÃO está conectado no hotspot no momento');
      }
    }
    console.log('');

    // 1.2. DHCP lease
    console.log('📋 Verificando DHCP lease...');
    const dhcpLeases = await execMikrotikCommand(host, user, pass, '/ip/dhcp-server/lease/print');
    if (dhcpLeases.ok && Array.isArray(dhcpLeases.data)) {
      const lease = dhcpLeases.data.find(l => 
        l.address === IP || (MAC && l['mac-address'] === MAC)
      );
      if (lease) {
        console.log('✅ DHCP lease encontrado:');
        console.log(`   IP: ${lease.address}`);
        console.log(`   MAC: ${lease['mac-address'] || 'N/A'}`);
        console.log(`   Status: ${lease.status || 'N/A'}`);
        console.log(`   Expires: ${lease['expires-after'] || 'N/A'}`);
        console.log(`   Hostname: ${lease.host-name || 'N/A'}`);
      } else {
        console.log('⚠️  DHCP lease não encontrado (pode ser estático ou expirado)');
      }
    }
    console.log('');

    // 2. Verificar logs do hotspot (últimas conexões/desconexões)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ LOGS DO HOTSPOT (ÚLTIMAS 30 ENTRADAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const logs = await execMikrotikCommand(host, user, pass, '/log/print');
    if (logs.ok && Array.isArray(logs.data)) {
      const hotspotLogs = logs.data
        .filter(l => 
          l.topics && 
          (l.topics.includes('hotspot') || l.topics.includes('dhcp')) &&
          (l.message && (l.message.includes(IP) || (MAC && l.message.includes(MAC))))
        )
        .slice(-30)
        .reverse();

      if (hotspotLogs.length > 0) {
        console.log(`📋 ${hotspotLogs.length} log(s) encontrado(s) relacionado(s) ao cliente:`);
        hotspotLogs.forEach((log, idx) => {
          const time = log.time || 'N/A';
          const topics = log.topics || 'N/A';
          const message = log.message || 'N/A';
          console.log(`   ${idx + 1}. [${time}] ${topics}: ${message}`);
        });
      } else {
        console.log('⚠️  Nenhum log encontrado relacionado ao cliente');
      }
    }
    console.log('');

    // 3. Verificar IP bindings e hosts
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ IP BINDINGS E HOSTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // IP bindings
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    if (ipBindings.ok && Array.isArray(ipBindings.data)) {
      const bindings = ipBindings.data.filter(b => 
        b.address === IP || (MAC && b['mac-address'] === MAC)
      );
      if (bindings.length > 0) {
        console.log(`📋 ${bindings.length} IP binding(s) encontrado(s):`);
        bindings.forEach((b, idx) => {
          console.log(`   ${idx + 1}. IP: ${b.address}, MAC: ${b['mac-address'] || 'N/A'}, Tipo: ${b.type || 'N/A'}`);
        });
      } else {
        console.log('⚠️  Nenhum IP binding encontrado');
      }
    }
    console.log('');

    // Hosts
    const hosts = await execMikrotikCommand(host, user, pass, '/ip/hotspot/host/print');
    if (hosts.ok && Array.isArray(hosts.data)) {
      const clientHosts = hosts.data.filter(h => 
        h.address === IP || (MAC && h['mac-address'] === MAC)
      );
      if (clientHosts.length > 0) {
        console.log(`📋 ${clientHosts.length} host(s) encontrado(s):`);
        clientHosts.forEach((h, idx) => {
          console.log(`   ${idx + 1}. IP: ${h.address}, MAC: ${h['mac-address'] || 'N/A'}, Status: ${h.status || 'N/A'}`);
        });
      }
    }
    console.log('');

    // 4. Verificar configurações do hotspot que podem causar desconexão
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ CONFIGURAÇÕES DO HOTSPOT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const hotspotServers = await execMikrotikCommand(host, user, pass, '/ip/hotspot/print');
    if (hotspotServers.ok && Array.isArray(hotspotServers.data)) {
      hotspotServers.forEach((server, idx) => {
        console.log(`📋 Servidor ${idx + 1}: ${server.name || 'N/A'}`);
        console.log(`   Interface: ${server['interface'] || 'N/A'}`);
        console.log(`   Idle Timeout: ${server['idle-timeout'] || 'N/A'}`);
        console.log(`   Keepalive Timeout: ${server['keepalive-timeout'] || 'N/A'}`);
        console.log(`   Session Timeout: ${server['session-timeout'] || 'N/A'}`);
        if (server['idle-timeout'] && server['idle-timeout'] !== 'none') {
          console.log(`   ⚠️  Idle Timeout configurado: ${server['idle-timeout']} - pode estar desconectando clientes inativos`);
        }
        console.log('');
      });
    }
    console.log('');

    // 5. Verificar firewall connections
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5️⃣ CONEXÕES ATIVAS DO FIREWALL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const connections = await execMikrotikCommand(host, user, pass, '/ip/firewall/connection/print');
    if (connections.ok && Array.isArray(connections.data)) {
      const clientConnections = connections.data.filter(c => 
        c['src-address'] === IP || c['dst-address'] === IP
      );
      if (clientConnections.length > 0) {
        console.log(`📋 ${clientConnections.length} conexão(ões) ativa(s) encontrada(s):`);
        clientConnections.slice(0, 10).forEach((c, idx) => {
          console.log(`   ${idx + 1}. ${c['src-address']} -> ${c['dst-address']} (${c.protocol || 'N/A'})`);
        });
      } else {
        console.log('⚠️  Nenhuma conexão ativa encontrada (cliente pode estar inativo)');
      }
    }
    console.log('');

    // 6. Diagnóstico e recomendações
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO E RECOMENDAÇÕES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Possíveis causas de desconexão constante:');
    console.log('');
    console.log('1. ⚠️  Idle Timeout configurado no hotspot');
    console.log('   - Se o cliente ficar inativo por X tempo, é desconectado');
    console.log('   - Solução: Desabilitar ou aumentar o idle-timeout');
    console.log('');
    console.log('2. ⚠️  Problema de sinal Wi-Fi');
    console.log('   - Sinal fraco ou interferência pode causar desconexões');
    console.log('   - Solução: Verificar posição do cliente, antenas, canais');
    console.log('');
    console.log('3. ⚠️  Problema de DHCP');
    console.log('   - Lease expirando muito rápido ou conflitos de IP');
    console.log('   - Solução: Aumentar lease-time do DHCP');
    console.log('');
    console.log('4. ⚠️  Problema no dispositivo do cliente');
    console.log('   - Configuração de Wi-Fi pode estar causando desconexões');
    console.log('   - Solução: Verificar configurações de Wi-Fi no dispositivo');
    console.log('');
    console.log('5. ⚠️  Regras de firewall bloqueando');
    console.log('   - Regras podem estar bloqueando e permitindo alternadamente');
    console.log('   - Solução: Verificar ordem das regras de firewall');
    console.log('');
    console.log('💡 Para monitorar em tempo real:');
    console.log('   - Use: pm2 logs 4 | grep -E "(hotspot|dhcp|192.168.88.82)"');
    console.log('   - Ou monitore os logs do Mikrotik diretamente');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

