#!/usr/bin/env node
// Script para verificar se cliente está liberado no Mikrotik
// Uso: node verificar-cliente-mikrotik.js <IP> [MAC]

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
    const IP = process.argv[2];
    const MAC = process.argv[3];
    
    if (!IP) {
      console.log('📋 Uso: node verificar-cliente-mikrotik.js <IP> [MAC]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node verificar-cliente-mikrotik.js 192.168.88.249 B2:40:6C:DF:8F:FB');
      process.exit(1);
    }

    console.log('🔍 Verificando cliente no Mikrotik...');
    console.log(`   IP: ${IP}`);
    if (MAC) {
      console.log(`   MAC: ${MAC}`);
    }
    console.log('');

    // Buscar sessão ativa
    const sessao = await prisma.sessaoAtiva.findFirst({
      where: {
        ipCliente: IP,
        ...(MAC ? { macCliente: MAC } : {}),
      },
      include: {
        roteador: {
          select: {
            nome: true,
            ipLan: true,
            usuario: true,
          },
        },
        pedido: {
          select: {
            code: true,
            status: true,
            customerName: true,
          },
        },
      },
    });

    if (!sessao) {
      console.log('❌ Nenhuma sessão ativa encontrada no banco para este IP/MAC');
      return;
    }

    if (!sessao.roteador) {
      console.log('❌ Sessão não tem roteador associado');
      return;
    }

    const host = sessao.roteador.ipLan;
    const user = sessao.roteador.usuario || 'relay';
    const pass = env.MIKROTIK_PASS || '';

    if (!pass) {
      console.error('❌ MIKROTIK_PASS não configurado no .env');
      return;
    }

    console.log(`✅ Sessão encontrada no banco:`);
    console.log(`   Roteador: ${sessao.roteador.nome} (${host})`);
    console.log(`   Pedido: ${sessao.pedido?.code || 'N/A'}`);
    console.log(`   Cliente: ${sessao.pedido?.customerName || 'N/A'}`);
    console.log(`   Status: ${sessao.ativo ? '✅ ATIVA' : '❌ INATIVA'}`);
    console.log('');

    // Verificar no Mikrotik
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Verificando no Mikrotik...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Verificar se está na lista paid_clients
    console.log('1️⃣ Lista paid_clients:');
    const paidList = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    if (paidList.ok && Array.isArray(paidList.data)) {
      const clientePaid = paidList.data.find(item => 
        item.list === 'paid_clients' && item.address === IP
      );
      if (clientePaid) {
        console.log(`   ✅ IP ${IP} está na lista paid_clients`);
        console.log(`      Comentário: ${clientePaid.comment || 'N/A'}`);
      } else {
        console.log(`   ❌ IP ${IP} NÃO está na lista paid_clients!`);
        console.log(`      ⚠️  PROBLEMA: Cliente pagou mas não foi adicionado ao firewall`);
      }
    } else {
      console.log(`   ❌ Erro ao buscar paid_clients: ${paidList.error || 'Desconhecido'}`);
    }
    console.log('');

    // 2. Verificar IP binding
    console.log('2️⃣ IP Binding (bypassed):');
    const bindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    if (bindings.ok && Array.isArray(bindings.data)) {
      const binding = bindings.data.find(b => 
        b.type === 'bypassed' && 
        (b.address === IP || (MAC && b['mac-address'] === MAC))
      );
      if (binding) {
        console.log(`   ✅ IP Binding encontrado:`);
        console.log(`      IP: ${binding.address || 'N/A'}`);
        console.log(`      MAC: ${binding['mac-address'] || 'N/A'}`);
        console.log(`      Tipo: ${binding.type || 'N/A'}`);
        console.log(`      Comentário: ${binding.comment || 'N/A'}`);
      } else {
        console.log(`   ❌ IP Binding NÃO encontrado para ${IP}${MAC ? ` / ${MAC}` : ''}!`);
        console.log(`      ⚠️  PROBLEMA: Cliente não tem bypass configurado no hotspot`);
      }
    } else {
      console.log(`   ❌ Erro ao buscar IP bindings: ${bindings.error || 'Desconhecido'}`);
    }
    console.log('');

    // 3. Verificar sessão ativa do hotspot
    console.log('3️⃣ Sessão ativa do hotspot:');
    const ativas = await execMikrotikCommand(host, user, pass, '/ip/hotspot/active/print detail');
    if (ativas.ok && Array.isArray(ativas.data)) {
      const sessaoAtiva = ativas.data.find(s => 
        s.address === IP || (MAC && s['mac-address'] === MAC)
      );
      if (sessaoAtiva) {
        console.log(`   ✅ Cliente está conectado no hotspot:`);
        console.log(`      IP: ${sessaoAtiva.address || 'N/A'}`);
        console.log(`      MAC: ${sessaoAtiva['mac-address'] || 'N/A'}`);
        console.log(`      Usuário: ${sessaoAtiva.user || 'N/A'}`);
        console.log(`      Uptime: ${sessaoAtiva.uptime || 'N/A'}`);
        console.log(`      Bytes: ${sessaoAtiva.bytes || 'N/A'}`);
      } else {
        console.log(`   ⚠️  Cliente não está na lista de sessões ativas do hotspot`);
        console.log(`      Isso é normal se o cliente não está conectado no momento`);
      }
    } else {
      console.log(`   ❌ Erro ao buscar sessões ativas: ${ativas.error || 'Desconhecido'}`);
    }
    console.log('');

    // Diagnóstico final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se a rede mostra exclamação (!) mas o cliente consegue acessar:');
    console.log('   1. O dispositivo está verificando conectividade com servidores externos');
    console.log('   2. Pode ser que o Mikrotik esteja bloqueando essas requisições');
    console.log('   3. Verifique as regras de firewall do Mikrotik');
    console.log('   4. Verifique se o DNS está configurado corretamente');
    console.log('');
    console.log('Se o cliente NÃO está na lista paid_clients ou IP binding:');
    console.log('   - Execute: ./liberar-cliente-cortesia.sh <IP> <MAC> <pedidoCode>');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

