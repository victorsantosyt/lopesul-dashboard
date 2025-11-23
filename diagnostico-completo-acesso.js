#!/usr/bin/env node
// Script para diagnóstico completo de acesso à internet
// Uso: node diagnostico-completo-acesso.js [mikId ou IP do roteador] [IP do cliente]

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
    
    console.log('🔍 Diagnóstico completo de acesso à internet...');
    console.log(`   Roteador: ${mikIdOrIp}`);
    if (clienteIp) {
      console.log(`   Cliente IP: ${clienteIp}`);
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

    // 1. Verificar NAT (masquerade)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ NAT (MASQUERADE) - Essencial para acesso à internet');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const natRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/nat/print where chain=srcnat');
    if (natRules.ok && Array.isArray(natRules.data)) {
      const masquerade = natRules.data.filter(r => r.action === 'masquerade');
      
      if (masquerade.length === 0) {
        console.log('   ❌ PROBLEMA CRÍTICO: Nenhuma regra de masquerade encontrada!');
        console.log('   Sem masquerade, os clientes não conseguem acessar a internet.');
        console.log('');
        console.log('   💡 Precisa criar regra:');
        console.log('   /ip/firewall/nat/add chain=srcnat action=masquerade out-interface=ether1');
      } else {
        console.log(`   ✅ ${masquerade.length} regra(s) de masquerade encontrada(s):`);
        masquerade.forEach((r, idx) => {
          console.log(`   ${idx + 1}. Out Interface: ${r['out-interface'] || 'N/A'}`);
          console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
          console.log(`      Desabilitado: ${r.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
          console.log(`      Comentário: ${r.comment || 'N/A'}`);
          console.log('');
        });
      }
    } else {
      console.log(`   ❌ Erro ao buscar NAT: ${natRules.error || 'Desconhecido'}`);
    }
    console.log('');

    // 2. Verificar rotas
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ ROTAS (Gateway padrão)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const routes = await execMikrotikCommand(host, user, pass, '/ip/route/print where dst-address=0.0.0.0/0');
    if (routes.ok && Array.isArray(routes.data)) {
      if (routes.data.length === 0) {
        console.log('   ❌ PROBLEMA: Nenhuma rota padrão (0.0.0.0/0) encontrada!');
      } else {
        console.log(`   ✅ ${routes.data.length} rota(s) padrão encontrada(s):`);
        routes.data.forEach((r, idx) => {
          console.log(`   ${idx + 1}. Gateway: ${r.gateway || 'N/A'}`);
          console.log(`      Interface: ${r['interface'] || 'N/A'}`);
          console.log(`      Desabilitado: ${r.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
          console.log('');
        });
      }
    } else {
      console.log(`   ❌ Erro ao buscar rotas: ${routes.error || 'Desconhecido'}`);
    }
    console.log('');

    // 3. Verificar interfaces
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ INTERFACES (Status)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const interfaces = await execMikrotikCommand(host, user, pass, '/interface/print');
    if (interfaces.ok && Array.isArray(interfaces.data)) {
      const wan = interfaces.data.find(i => i.name === 'ether1' || i.name?.includes('WAN'));
      const lan = interfaces.data.find(i => i.name === 'ether2' || i.name?.includes('LAN'));
      
      if (wan) {
        console.log(`   WAN (ether1): ${wan.running === 'true' ? '✅ Ativa' : '❌ Inativa'}`);
        console.log(`      Tipo: ${wan.type || 'N/A'}`);
      }
      if (lan) {
        console.log(`   LAN (ether2): ${lan.running === 'true' ? '✅ Ativa' : '❌ Inativa'}`);
        console.log(`      Tipo: ${lan.type || 'N/A'}`);
      }
    }
    console.log('');

    // 4. Verificar se cliente está na lista paid_clients
    if (clienteIp) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`4️⃣ VERIFICAÇÃO DO CLIENTE ${clienteIp}`);
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
        }
      }
      console.log('');
    }

    // Diagnóstico final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO FINAL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Para acesso à internet funcionar, precisa ter:');
    console.log('   1. ✅ Regra de firewall permitindo paid_clients (já tem)');
    console.log('   2. ✅ Regra de NAT masquerade (verificar acima)');
    console.log('   3. ✅ Rota padrão configurada (verificar acima)');
    console.log('   4. ✅ Interface WAN ativa (verificar acima)');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

