#!/usr/bin/env node
// Script para forçar criação de sessões ativas no hotspot para clientes pagos
// Uso: node forcar-sessoes-hotspot.js [mikId] [IP do cliente (opcional)]

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

async function criarSessaoHotspot(host, user, pass, ip, mac, username) {
  // Primeiro, criar um usuário temporário se não existir
  const userCmd = `/ip/hotspot/user/add name=${username} password=temp123 profile=default`;
  const userResult = await execMikrotikCommand(host, user, pass, userCmd);
  
  // Ignorar erro se usuário já existir
  if (!userResult.ok && !userResult.error?.includes('already')) {
    console.log(`      ⚠️  Aviso ao criar usuário: ${userResult.error}`);
  }

  // Criar sessão ativa
  const sessionCmd = `/ip/hotspot/active/add user=${username} address=${ip} mac-address=${mac} server=hotspot1`;
  const sessionResult = await execMikrotikCommand(host, user, pass, sessionCmd);
  
  return sessionResult;
}

async function main() {
  try {
    const mikIdOrIp = process.argv[2] || 'LOPESUL-HOTSPOT-06';
    const clienteIpEspecifico = process.argv[3];
    
    console.log('🔧 Forçando criação de sessões ativas no hotspot...');
    console.log(`   Roteador: ${mikIdOrIp}`);
    if (clienteIpEspecifico) {
      console.log(`   Cliente específico: ${clienteIpEspecifico}`);
    }
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

    // 1. Buscar sessões ativas
    const activeSessions = await execMikrotikCommand(host, user, pass, '/ip/hotspot/active/print');
    const sessoesAtivas = activeSessions.ok && Array.isArray(activeSessions.data) ? activeSessions.data : [];
    const ipsComSessao = new Set(sessoesAtivas.map(s => s.address));

    // 2. Buscar paid_clients
    const paidList = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    const paidClients = paidList.ok && Array.isArray(paidList.data)
      ? paidList.data.filter(item => item.list === 'paid_clients')
      : [];

    // 3. Buscar IP bindings para obter MACs
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    const bindings = ipBindings.ok && Array.isArray(ipBindings.data)
      ? ipBindings.data.filter(b => b.type === 'bypassed')
      : [];
    
    const macPorIp = new Map();
    bindings.forEach(b => {
      if (b.address && b['mac-address']) {
        macPorIp.set(b.address, b['mac-address']);
      }
    });

    // 4. Filtrar clientes que precisam de sessão
    const clientesSemSessao = paidClients.filter(c => {
      if (clienteIpEspecifico && c.address !== clienteIpEspecifico) {
        return false;
      }
      return !ipsComSessao.has(c.address);
    });

    if (clientesSemSessao.length === 0) {
      console.log('✅ Todos os clientes pagos já têm sessão ativa!');
      return;
    }

    console.log(`📋 ${clientesSemSessao.length} cliente(s) sem sessão ativa:`);
    console.log('');

    let sucesso = 0;
    let falhas = 0;

    for (const cliente of clientesSemSessao) {
      const ip = cliente.address;
      const mac = macPorIp.get(ip) || '00:00:00:00:00:00';
      const username = `paid-${ip.replace(/\./g, '-')}`;

      console.log(`   🔧 Criando sessão para ${ip}...`);
      console.log(`      MAC: ${mac}`);
      console.log(`      Usuário: ${username}`);

      const resultado = await criarSessaoHotspot(host, user, pass, ip, mac, username);
      
      if (resultado.ok) {
        console.log(`      ✅ Sessão criada com sucesso!`);
        sucesso++;
      } else {
        console.log(`      ❌ Erro: ${resultado.error}`);
        falhas++;
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ✅ Sessões criadas: ${sucesso}`);
    console.log(`   ❌ Falhas: ${falhas}`);
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

