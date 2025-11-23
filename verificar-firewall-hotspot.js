#!/usr/bin/env node
// Script para verificar regras de firewall específicas do hotspot
// Uso: node verificar-firewall-hotspot.js [mikId]

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
    
    console.log('🔍 Verificando regras de firewall do HOTSPOT...');
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

    // 1. Verificar interfaces do hotspot
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ INTERFACES DO HOTSPOT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const hotspot = await execMikrotikCommand(host, user, pass, '/ip/hotspot/print');
    if (hotspot.ok && Array.isArray(hotspot.data) && hotspot.data.length > 0) {
      const hs = hotspot.data[0];
      console.log(`   Interface: ${hs['interface'] || 'N/A'}`);
      console.log(`   Server: ${hs.name || 'N/A'}`);
      console.log(`   Address Pool: ${hs['address-pool'] || 'N/A'}`);
      console.log('');
      
      const hotspotInterface = hs['interface'] || 'N/A';
      
      // 2. Verificar regras que afetam essa interface
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('2️⃣ REGRAS DE FIREWALL PARA INTERFACE DO HOTSPOT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
      if (filterRules.ok && Array.isArray(filterRules.data)) {
        // Regras que afetam a interface do hotspot
        const regrasHotspot = filterRules.data.filter(r => 
          r['in-interface'] === hotspotInterface || 
          r['out-interface'] === hotspotInterface ||
          (r['src-address'] && r['src-address'].includes('192.168.88'))
        );
        
        // Regras específicas para paid_clients
        const regrasPaidClients = filterRules.data.filter(r => 
          r['src-address-list'] === 'paid_clients'
        );
        
        console.log(`   Regras que afetam interface do hotspot: ${regrasHotspot.length}`);
        console.log(`   Regras para paid_clients: ${regrasPaidClients.length}`);
        console.log('');
        
        if (regrasPaidClients.length > 0) {
          console.log('   ✅ Regras para paid_clients:');
          regrasPaidClients.forEach((r, idx) => {
            console.log(`   ${idx + 1}. Action: ${r.action}`);
            console.log(`      In Interface: ${r['in-interface'] || 'N/A'}`);
            console.log(`      Out Interface: ${r['out-interface'] || 'N/A'}`);
            console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
            console.log(`      Desabilitado: ${r.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
            console.log('');
          });
        }
        
        // Verificar se há regras bloqueando a interface do hotspot
        const regrasBloqueio = filterRules.data.filter(r =>
          (r.action === 'drop' || r.action === 'reject') &&
          (r['in-interface'] === hotspotInterface || 
           r['out-interface'] === hotspotInterface ||
           (r['src-address'] && r['src-address'].includes('192.168.88')))
        );
        
        if (regrasBloqueio.length > 0) {
          console.log(`   ⚠️  ${regrasBloqueio.length} regra(s) bloqueando interface do hotspot:`);
          regrasBloqueio.forEach((r, idx) => {
            console.log(`   ${idx + 1}. ID: ${r['.id']} | Action: ${r.action}`);
            console.log(`      In Interface: ${r['in-interface'] || 'N/A'}`);
            console.log(`      Out Interface: ${r['out-interface'] || 'N/A'}`);
            console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
            console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
            console.log('');
          });
        }
      }
    }
    console.log('');

    // 3. Verificar NAT masquerade para interface do hotspot
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ NAT MASQUERADE PARA HOTSPOT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const natRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/nat/print where chain=srcnat');
    if (natRules.ok && Array.isArray(natRules.data)) {
      const masquerade = natRules.data.filter(r => r.action === 'masquerade');
      
      // Verificar se há masquerade para 192.168.88.0/24 ou paid_clients
      const masqueradeHotspot = masquerade.find(r => 
        r['src-address'] === '192.168.88.0/24' ||
        r['src-address-list'] === 'paid_clients' ||
        r['out-interface'] === 'ether1'
      );
      
      if (masqueradeHotspot) {
        console.log('   ✅ NAT masquerade encontrado:');
        console.log(`      Out Interface: ${masqueradeHotspot['out-interface'] || 'N/A'}`);
        console.log(`      Src Address: ${masqueradeHotspot['src-address'] || 'N/A'}`);
        console.log(`      Src Address List: ${masqueradeHotspot['src-address-list'] || 'N/A'}`);
        console.log(`      Desabilitado: ${masqueradeHotspot.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
      } else {
        console.log('   ⚠️  NAT masquerade pode não estar configurado para o hotspot');
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se a regra 38 é para outra interface (bridge/LAN), o problema pode ser:');
    console.log('   1. Regra bloqueando especificamente a interface do hotspot');
    console.log('   2. NAT masquerade não configurado para a interface do hotspot');
    console.log('   3. Regra de firewall bloqueando antes da regra de permitir paid_clients');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

