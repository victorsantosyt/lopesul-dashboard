#!/usr/bin/env node
// Script para verificar regras de firewall e NAT que podem estar bloqueando o cliente
// Uso: node verificar-firewall-nat-cliente.js <IP> [mikId]

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
    const MIK_ID = process.argv[3] || null;
    
    if (!IP) {
      console.log('📋 Uso: node verificar-firewall-nat-cliente.js <IP> [mikId]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node verificar-firewall-nat-cliente.js 192.168.88.82');
      console.log('   node verificar-firewall-nat-cliente.js 192.168.88.82 LOPESUL-HOTSPOT-06');
      process.exit(1);
    }

    console.log('🔍 Verificando firewall e NAT para cliente...');
    console.log(`   IP: ${IP}`);
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

    // 1. Verificar regras de firewall que podem bloquear
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ REGRAS DE FIREWALL (FILTER)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print');
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      // Buscar regra paid_clients
      const paidRule = filterRules.data.find(r => 
        r['src-address-list'] && r['src-address-list'].includes('paid_clients')
      );
      
      if (paidRule) {
        console.log(`✅ Regra paid_clients encontrada:`);
        console.log(`   ID: ${paidRule['.id'] || 'N/A'}`);
        console.log(`   Action: ${paidRule.action || 'N/A'}`);
        console.log(`   Chain: ${paidRule.chain || 'N/A'}`);
        console.log(`   Src Address List: ${paidRule['src-address-list'] || 'N/A'}`);
        console.log(`   Desabilitado: ${paidRule.disabled === 'true' ? 'Sim ❌' : 'Não ✅'}`);
      } else {
        console.log('❌ Regra paid_clients NÃO encontrada!');
      }
      
      // Buscar regras que podem bloquear
      const blockingRules = filterRules.data.filter(r => 
        (r.action === 'drop' || r.action === 'reject') &&
        (r['src-address'] === IP || 
         (r['src-address'] && IP.startsWith(r['src-address'].split('/')[0])) ||
         (r['src-address-list'] && !r['src-address-list'].includes('paid_clients')))
      );
      
      if (blockingRules.length > 0) {
        console.log('');
        console.log(`⚠️  ${blockingRules.length} regra(s) que podem bloquear o cliente:`);
        blockingRules.slice(0, 5).forEach((r, idx) => {
          console.log(`   ${idx + 1}. ID: ${r['.id'] || 'N/A'}, Action: ${r.action}, Src: ${r['src-address'] || r['src-address-list'] || 'N/A'}`);
        });
      }
    }
    console.log('');

    // 2. Verificar NAT (masquerade)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ NAT (MASQUERADE)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const natRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/nat/print');
    if (natRules.ok && Array.isArray(natRules.data)) {
      const masquerade = natRules.data.find(r => r.action === 'masquerade');
      
      if (masquerade) {
        console.log('✅ NAT Masquerade encontrado:');
        console.log(`   ID: ${masquerade['.id'] || 'N/A'}`);
        console.log(`   Chain: ${masquerade.chain || 'N/A'}`);
        console.log(`   Out Interface: ${masquerade['out-interface'] || 'N/A'}`);
        console.log(`   Desabilitado: ${masquerade.disabled === 'true' ? 'Sim ❌' : 'Não ✅'}`);
      } else {
        console.log('❌ NAT Masquerade NÃO encontrado!');
        console.log('   ⚠️  PROBLEMA: Sem NAT, o cliente não consegue acessar a internet');
      }
    }
    console.log('');

    // 3. Verificar rotas
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ ROTAS (GATEWAY)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const routes = await execMikrotikCommand(host, user, pass, '/ip/route/print');
    if (routes.ok && Array.isArray(routes.data)) {
      const defaultRoute = routes.data.find(r => r['dst-address'] === '0.0.0.0/0');
      
      if (defaultRoute) {
        console.log('✅ Rota padrão (0.0.0.0/0) encontrada:');
        console.log(`   Gateway: ${defaultRoute.gateway || 'N/A'}`);
        console.log(`   Interface: ${defaultRoute['pref-src'] || defaultRoute['gateway-state'] || 'N/A'}`);
        console.log(`   Desabilitado: ${defaultRoute.disabled === 'true' ? 'Sim ❌' : 'Não ✅'}`);
      } else {
        console.log('❌ Rota padrão (0.0.0.0/0) NÃO encontrada!');
        console.log('   ⚠️  PROBLEMA: Sem rota padrão, o cliente não consegue acessar a internet');
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMENDAÇÕES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se tudo está configurado corretamente mas o cliente não tem acesso:');
    console.log('   1. Execute: node forcar-ativacao-cliente.js <IP> <MAC> <mikId>');
    console.log('   2. Peça para o cliente fazer uma nova requisição HTTP (abrir um site)');
    console.log('   3. Verifique se o cliente está conectado ao Wi-Fi correto');
    console.log('   4. Verifique se há problemas de conectividade física');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

