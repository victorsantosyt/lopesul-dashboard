#!/usr/bin/env node
// Script para verificar sessões ativas no hotspot
// Uso: node verificar-sessoes-hotspot.js [mikId]

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

function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

async function main() {
  try {
    const mikIdOrIp = process.argv[2] || 'LOPESUL-HOTSPOT-06';
    
    console.log('🔍 Verificando sessões ativas no hotspot...');
    console.log(`   Roteador: ${mikIdOrIp}`);
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

    // 1. Sessões ativas do hotspot
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ SESSÕES ATIVAS DO HOTSPOT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const activeSessions = await execMikrotikCommand(host, user, pass, '/ip/hotspot/active/print');
    if (activeSessions.ok && Array.isArray(activeSessions.data) && activeSessions.data.length > 0) {
      console.log(`   ✅ ${activeSessions.data.length} sessão(ões) ativa(s):`);
      console.log('');
      
      activeSessions.data.forEach((s, i) => {
        const uptime = s.uptime ? parseInt(s.uptime) : 0;
        const bytesUp = s['bytes-up'] ? parseInt(s['bytes-up']) : 0;
        const bytesDown = s['bytes-down'] ? parseInt(s['bytes-down']) : 0;
        const totalBytes = bytesUp + bytesDown;
        
        console.log(`   ${i + 1}. IP: ${s.address || 'N/A'}`);
        console.log(`      MAC: ${s['mac-address'] || 'N/A'}`);
        console.log(`      Usuário: ${s.user || 'N/A'}`);
        console.log(`      Servidor: ${s.server || 'N/A'}`);
        console.log(`      Uptime: ${formatUptime(uptime)}`);
        console.log(`      Bytes Up: ${(bytesUp / 1024 / 1024).toFixed(2)} MB`);
        console.log(`      Bytes Down: ${(bytesDown / 1024 / 1024).toFixed(2)} MB`);
        console.log(`      Total: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
        console.log(`      ID: ${s['.id'] || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  Nenhuma sessão ativa no hotspot');
      if (activeSessions.error) {
        console.error(`   ❌ Erro: ${activeSessions.error}`);
      }
    }
    console.log('');

    // 2. IP Bindings (bypassed)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ IP BINDINGS (BYPASSED)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    if (ipBindings.ok && Array.isArray(ipBindings.data) && ipBindings.data.length > 0) {
      const bypassed = ipBindings.data.filter(b => b.type === 'bypassed');
      
      if (bypassed.length > 0) {
        console.log(`   ✅ ${bypassed.length} IP binding(s) do tipo bypassed:`);
        console.log('');
        
        bypassed.forEach((b, i) => {
          console.log(`   ${i + 1}. IP: ${b.address || 'N/A'}`);
          console.log(`      MAC: ${b['mac-address'] || 'N/A'}`);
          console.log(`      Tipo: ${b.type || 'N/A'}`);
          console.log(`      Comentário: ${b.comment || 'N/A'}`);
          console.log(`      ID: ${b['.id'] || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   ⚠️  Nenhum IP binding do tipo bypassed');
      }
    } else {
      console.log('   ⚠️  Nenhum IP binding encontrado');
      if (ipBindings.error) {
        console.error(`   ❌ Erro: ${ipBindings.error}`);
      }
    }
    console.log('');

    // 3. Comparar com paid_clients
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ COMPARAÇÃO COM PAID_CLIENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const paidList = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    if (paidList.ok && Array.isArray(paidList.data)) {
      const paidClients = paidList.data.filter(item => item.list === 'paid_clients');
      
      if (paidClients.length > 0) {
        console.log(`   ✅ ${paidClients.length} cliente(s) na lista paid_clients:`);
        console.log('');
        
        paidClients.forEach((c, i) => {
          const temSessao = activeSessions.ok && activeSessions.data.some(s => s.address === c.address);
          const temBinding = ipBindings.ok && ipBindings.data.some(b => 
            b.type === 'bypassed' && b.address === c.address
          );
          
          console.log(`   ${i + 1}. IP: ${c.address}`);
          console.log(`      Comentário: ${c.comment || 'N/A'}`);
          console.log(`      Sessão ativa: ${temSessao ? '✅ Sim' : '❌ Não'}`);
          console.log(`      IP Binding: ${temBinding ? '✅ Sim' : '❌ Não'}`);
          console.log('');
        });
      } else {
        console.log('   ⚠️  Nenhum cliente na lista paid_clients');
      }
    }
    console.log('');

    // 4. Resumo
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalSessoes = activeSessions.ok && Array.isArray(activeSessions.data) ? activeSessions.data.length : 0;
    const totalPaid = paidList.ok && Array.isArray(paidList.data) 
      ? paidList.data.filter(item => item.list === 'paid_clients').length 
      : 0;
    const totalBindings = ipBindings.ok && Array.isArray(ipBindings.data)
      ? ipBindings.data.filter(b => b.type === 'bypassed').length
      : 0;
    
    console.log(`   Sessões ativas no hotspot: ${totalSessoes}`);
    console.log(`   Clientes na lista paid_clients: ${totalPaid}`);
    console.log(`   IP Bindings (bypassed): ${totalBindings}`);
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

