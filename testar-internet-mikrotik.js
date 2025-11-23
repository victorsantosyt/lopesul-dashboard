#!/usr/bin/env node
// Script para testar conectividade à internet do Mikrotik
// Uso: node testar-internet-mikrotik.js [mikId]

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
    
    console.log('🔍 Testando conectividade à internet do Mikrotik...');
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

    // Testar ping para 8.8.8.8
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ Testando ping do Mikrotik para 8.8.8.8 (Google DNS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ping = await execMikrotikCommand(host, user, pass, '/ping count=3 address=8.8.8.8');
    if (ping.ok) {
      console.log('   ✅ Mikrotik consegue acessar a internet!');
    } else {
      console.log(`   ❌ Mikrotik NÃO consegue acessar a internet!`);
      console.log(`   Erro: ${ping.error || 'Desconhecido'}`);
      console.log('');
      console.log('   💡 Se o Mikrotik não consegue acessar, os clientes também não conseguirão.');
      console.log('   Verifique:');
      console.log('   1. Interface WAN (ether1) está conectada?');
      console.log('   2. Gateway está correto?');
      console.log('   3. ISP está funcionando?');
    }
    console.log('');

    // Verificar IP da interface WAN
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ Verificando interface WAN (ether1)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const interfaces = await execMikrotikCommand(host, user, pass, '/ip/address/print where interface=ether1');
    if (interfaces.ok && Array.isArray(interfaces.data)) {
      if (interfaces.data.length > 0) {
        console.log(`   ✅ Interface WAN (ether1) tem ${interfaces.data.length} endereço(s) IP:`);
        interfaces.data.forEach((addr, idx) => {
          console.log(`   ${idx + 1}. ${addr.address || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️  Interface WAN (ether1) não tem endereço IP configurado');
      }
    }
    console.log('');

    // Verificar gateway
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ Verificando gateway');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const routes = await execMikrotikCommand(host, user, pass, '/ip/route/print');
    if (routes.ok && Array.isArray(routes.data)) {
      const defaultRoute = routes.data.find(r => 
        r['dst-address'] === '0.0.0.0/0' || r['dst-address'] === '0.0.0.0'
      );
      
      if (defaultRoute) {
        console.log(`   ✅ Gateway: ${defaultRoute.gateway || 'N/A'}`);
        console.log(`   Interface: ${defaultRoute['interface'] || 'N/A'}`);
        console.log(`   Desabilitado: ${defaultRoute.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
        
        // Testar ping para o gateway
        if (defaultRoute.gateway) {
          console.log('');
          console.log(`   Testando conectividade com o gateway ${defaultRoute.gateway}...`);
          const pingGateway = await execMikrotikCommand(host, user, pass, `/ping count=2 address=${defaultRoute.gateway}`);
          if (pingGateway.ok) {
            console.log(`   ✅ Gateway ${defaultRoute.gateway} está acessível`);
          } else {
            console.log(`   ❌ Gateway ${defaultRoute.gateway} NÃO está acessível!`);
            console.log(`   Isso pode ser o problema principal.`);
          }
        }
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se o Mikrotik não consegue acessar a internet:');
    console.log('   - Os clientes também não conseguirão');
    console.log('   - Verifique conexão física da WAN');
    console.log('   - Verifique configuração do ISP');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

