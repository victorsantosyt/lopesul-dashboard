#!/usr/bin/env node
// Script para verificar e corrigir regras de firewall do Mikrotik
// Uso: node verificar-firewall-mikrotik.js [mikId ou IP do roteador]

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
    
    console.log('🔍 Verificando regras de firewall do Mikrotik...');
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

    // 1. Verificar regras de firewall filter
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ REGRAS DE FIREWALL FILTER (chain=forward)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      const regrasPaidClients = filterRules.data.filter(r => 
        r['src-address-list'] === 'paid_clients' || 
        (r.comment && r.comment.includes('paid_clients'))
      );
      
      if (regrasPaidClients.length === 0) {
        console.log('   ❌ PROBLEMA CRÍTICO: Nenhuma regra encontrada para paid_clients!');
        console.log('');
        console.log('   💡 Precisa criar regra para permitir tráfego de clientes pagos');
        console.log('   Comando necessário:');
        console.log(`   /ip/firewall/filter/add chain=forward src-address-list=paid_clients action=accept comment="Liberar internet para clientes pagos"`);
      } else {
        console.log(`   ✅ ${regrasPaidClients.length} regra(s) encontrada(s) para paid_clients:`);
        regrasPaidClients.forEach((r, idx) => {
          console.log(`   ${idx + 1}. Chain: ${r.chain || 'N/A'}`);
          console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
          console.log(`      Action: ${r.action || 'N/A'}`);
          console.log(`      Comentário: ${r.comment || 'N/A'}`);
          console.log(`      Desabilitado: ${r.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
          console.log('');
        });
      }
    } else {
      console.log(`   ❌ Erro ao buscar regras: ${filterRules.error || 'Desconhecido'}`);
    }
    console.log('');

    // 2. Verificar regras NAT (redirecionamento)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ REGRAS DE FIREWALL NAT (redirecionamento HTTP)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const natRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/nat/print where chain=dstnat');
    if (natRules.ok && Array.isArray(natRules.data)) {
      const regrasRedirect = natRules.data.filter(r => 
        r['src-address-list'] && r['src-address-list'].includes('!paid_clients')
      );
      
      if (regrasRedirect.length > 0) {
        console.log(`   ✅ ${regrasRedirect.length} regra(s) de redirecionamento encontrada(s):`);
        regrasRedirect.forEach((r, idx) => {
          console.log(`   ${idx + 1}. Chain: ${r.chain || 'N/A'}`);
          console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
          console.log(`      Dst Port: ${r['dst-port'] || 'N/A'}`);
          console.log(`      Action: ${r.action || 'N/A'}`);
          console.log(`      To Addresses: ${r['to-addresses'] || 'N/A'}`);
          console.log(`      Comentário: ${r.comment || 'N/A'}`);
          console.log(`      Desabilitado: ${r.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
          console.log('');
        });
      } else {
        console.log('   ⚠️  Nenhuma regra de redirecionamento encontrada');
      }
    } else {
      console.log(`   ❌ Erro ao buscar regras NAT: ${natRules.error || 'Desconhecido'}`);
    }
    console.log('');

    // 3. Verificar DNS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ CONFIGURAÇÃO DNS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const dns = await execMikrotikCommand(host, user, pass, '/ip/dns/print');
    if (dns.ok && Array.isArray(dns.data) && dns.data.length > 0) {
      const dnsConfig = dns.data[0];
      console.log(`   Servidores DNS: ${dnsConfig.servers || 'N/A'}`);
      console.log(`   Permitir requisições remotas: ${dnsConfig['allow-remote-requests'] === 'true' ? 'Sim ✅' : 'Não ⚠️'}`);
    } else {
      console.log('   ⚠️  DNS não configurado ou erro ao buscar');
    }
    console.log('');

    // Diagnóstico final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se o cliente não consegue acessar sites externos:');
    console.log('   1. Verifique se há regra de firewall permitindo tráfego de paid_clients');
    console.log('   2. Verifique se a regra não está desabilitada');
    console.log('   3. Verifique se o DNS está configurado');
    console.log('   4. Verifique se há regra bloqueando o tráfego (deve estar DEPOIS da regra de permitir)');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

