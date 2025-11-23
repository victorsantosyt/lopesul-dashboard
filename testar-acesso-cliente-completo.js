#!/usr/bin/env node
// Script para testar acesso completo do cliente
// Uso: node testar-acesso-cliente-completo.js [mikId] [IP do cliente]

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
      console.log('📋 Uso: node testar-acesso-cliente-completo.js [mikId] <IP do cliente>');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node testar-acesso-cliente-completo.js LOPESUL-HOTSPOT-06 192.168.88.199');
      process.exit(1);
    }

    console.log('🔍 Testando acesso completo do cliente...');
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

    // 1. Verificar se cliente está na lista paid_clients
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ VERIFICANDO SE CLIENTE ESTÁ LIBERADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const paidList = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    if (paidList.ok && Array.isArray(paidList.data)) {
      const cliente = paidList.data.find(item => 
        item.list === 'paid_clients' && item.address === clienteIp
      );
      
      if (cliente) {
        console.log(`   ✅ Cliente ${clienteIp} está na lista paid_clients`);
      } else {
        console.log(`   ❌ Cliente ${clienteIp} NÃO está na lista paid_clients!`);
        console.log('   Isso é o problema principal!');
        return;
      }
    }
    console.log('');

    // 2. Verificar regras de firewall
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ VERIFICANDO REGRAS DE FIREWALL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      const regraPaid = filterRules.data.find(r => 
        r['src-address-list'] === 'paid_clients' && r.action === 'accept'
      );
      
      if (regraPaid) {
        console.log('   ✅ Regra para paid_clients existe e está ativa');
        
        // Verificar se há regras bloqueando HTTP/HTTPS
        const regrasBloqueioHTTP = filterRules.data.filter(r =>
          (r.action === 'drop' || r.action === 'reject') &&
          (r['dst-port'] === '80' || r['dst-port'] === '443' || 
           r['protocol'] === 'tcp' || !r['protocol'])
        );
        
        if (regrasBloqueioHTTP.length > 0) {
          console.log(`   ⚠️  ${regrasBloqueioHTTP.length} regra(s) pode(m) estar bloqueando HTTP/HTTPS`);
        }
      } else {
        console.log('   ❌ Regra para paid_clients não encontrada!');
      }
    }
    console.log('');

    // 3. Verificar NAT masquerade
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ VERIFICANDO NAT MASQUERADE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const natRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/nat/print where chain=srcnat');
    if (natRules.ok && Array.isArray(natRules.data)) {
      const masquerade = natRules.data.filter(r => 
        r.action === 'masquerade' && r.disabled !== 'true'
      );
      
      if (masquerade.length > 0) {
        console.log(`   ✅ ${masquerade.length} regra(s) de masquerade encontrada(s)`);
        masquerade.forEach((r, idx) => {
          console.log(`   ${idx + 1}. Out Interface: ${r['out-interface'] || 'N/A'}`);
          console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
          console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('   ❌ Nenhuma regra de masquerade encontrada!');
      }
    }
    console.log('');

    // 4. Testar ping do cliente para 8.8.8.8 (via Mikrotik)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ TESTANDO PING DO CLIENTE PARA INTERNET');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   💡 Para testar, execute no dispositivo do cliente:');
    console.log(`   ping 8.8.8.8`);
    console.log('');
    console.log('   Se o ping funcionar mas sites não abrirem, o problema é DNS.');
    console.log('');

    // 5. Verificar DNS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5️⃣ VERIFICANDO DNS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const dns = await execMikrotikCommand(host, user, pass, '/ip/dns/print');
    if (dns.ok && Array.isArray(dns.data) && dns.data.length > 0) {
      const dnsConfig = dns.data[0];
      console.log(`   Servidores DNS: ${dnsConfig.servers || 'N/A'}`);
      console.log(`   Permitir requisições remotas: ${dnsConfig['allow-remote-requests'] === 'true' ? 'Sim ✅' : 'Não ⚠️'}`);
      
      if (dnsConfig['allow-remote-requests'] !== 'true') {
        console.log('   ⚠️  DNS não permite requisições remotas!');
        console.log('   Isso pode impedir clientes de resolver nomes de domínio.');
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO FINAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se o cliente consegue ping mas não consegue acessar sites:');
    console.log('   1. Problema de DNS - verificar configuração DNS');
    console.log('   2. Regra bloqueando HTTP/HTTPS - verificar regras de firewall');
    console.log('   3. NAT não está funcionando - verificar masquerade');
    console.log('');
    console.log('Se o cliente não consegue nem ping:');
    console.log('   1. Regra de firewall bloqueando - verificar regras');
    console.log('   2. Cliente não está na lista paid_clients');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

