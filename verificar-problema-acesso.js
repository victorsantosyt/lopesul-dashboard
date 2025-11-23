#!/usr/bin/env node
// Script para verificar problema específico de acesso
// Uso: node verificar-problema-acesso.js [mikId] [IP do cliente]

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
    const clienteIp = process.argv[3] || '192.168.88.199';
    
    console.log('🔍 Verificando problema específico de acesso...');
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

    // 1. Verificar se cliente está em paid_clients
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ VERIFICANDO PAID_CLIENTS');
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

    // 2. Verificar regra paid_clients na chain forward
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ VERIFICANDO REGRA PAID_CLIENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      const regraPaid = filterRules.data.find(r => 
        r['src-address-list'] === 'paid_clients' && r.action === 'accept'
      );
      
      if (regraPaid) {
        console.log(`   ✅ Regra paid_clients encontrada (ID: ${regraPaid['.id']})`);
        console.log(`      Action: ${regraPaid.action}`);
        console.log(`      Src Address List: ${regraPaid['src-address-list']}`);
        console.log(`      In Interface: ${regraPaid['in-interface'] || 'N/A'}`);
        console.log(`      Out Interface: ${regraPaid['out-interface'] || 'N/A'}`);
        console.log(`      Desabilitado: ${regraPaid.disabled === 'true' ? 'Sim ❌' : 'Não ✅'}`);
        
        if (regraPaid.disabled === 'true') {
          console.log('   ❌ PROBLEMA: Regra está desabilitada!');
        }
      } else {
        console.log('   ❌ Regra paid_clients não encontrada!');
      }
    }
    console.log('');

    // 3. Verificar regras bloqueando HTTP/HTTPS especificamente
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ VERIFICANDO REGRAS BLOQUEANDO HTTP/HTTPS (80/443)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      const regrasBloqueioHTTP = filterRules.data.filter(r =>
        (r.action === 'drop' || r.action === 'reject') &&
        r.disabled !== 'true' &&
        (
          r['dst-port'] === '80' ||
          r['dst-port'] === '443' ||
          r['dst-port'] === '80,443' ||
          (r['dst-port'] && r['dst-port'].includes('80')) ||
          (r['dst-port'] && r['dst-port'].includes('443'))
        )
      );
      
      if (regrasBloqueioHTTP.length > 0) {
        console.log(`   ⚠️  ${regrasBloqueioHTTP.length} regra(s) bloqueando HTTP/HTTPS:`);
        regrasBloqueioHTTP.forEach((r, idx) => {
          console.log(`   ${idx + 1}. ID: ${r['.id']} | Action: ${r.action} | Dst Port: ${r['dst-port'] || 'N/A'}`);
        });
      } else {
        console.log('   ✅ Nenhuma regra bloqueando HTTP/HTTPS especificamente');
      }
    }
    console.log('');

    // 4. Verificar NAT masquerade
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ VERIFICANDO NAT MASQUERADE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const natRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/nat/print where chain=srcnat');
    if (natRules.ok && Array.isArray(natRules.data)) {
      const masquerade = natRules.data.filter(r => 
        r.action === 'masquerade' && r.disabled !== 'true'
      );
      
      if (masquerade.length > 0) {
        console.log(`   ✅ ${masquerade.length} regra(s) de masquerade encontrada(s):`);
        masquerade.forEach((r, idx) => {
          console.log(`   ${idx + 1}. Out Interface: ${r['out-interface'] || 'N/A'}`);
          console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
          console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
          console.log(`      Desabilitado: ${r.disabled === 'true' ? 'Sim ❌' : 'Não ✅'}`);
          console.log('');
        });
      } else {
        console.log('   ❌ Nenhuma regra de masquerade encontrada!');
        console.log('   Isso impede o acesso à internet!');
      }
    }
    console.log('');

    // 5. Verificar IP binding
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5️⃣ VERIFICANDO IP BINDING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    if (ipBindings.ok && Array.isArray(ipBindings.data)) {
      const binding = ipBindings.data.find(b => 
        b.type === 'bypassed' && b.address === clienteIp
      );
      
      if (binding) {
        console.log(`   ✅ IP binding encontrado (ID: ${binding['.id']})`);
        console.log(`      Tipo: ${binding.type}`);
        console.log(`      MAC: ${binding['mac-address'] || 'N/A'}`);
        console.log(`      Servidor: ${binding.server || 'N/A'}`);
        console.log(`      Comentário: ${binding.comment || 'N/A'}`);
        console.log(`      Desabilitado: ${binding.disabled === 'true' ? 'Sim ❌' : 'Não ✅'}`);
        
        if (binding.disabled === 'true') {
          console.log('   ❌ PROBLEMA: IP binding está desabilitado!');
        }
      } else {
        console.log(`   ⚠️  IP binding não encontrado para ${clienteIp}`);
        console.log('   Isso pode impedir o bypass do hotspot');
      }
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se tudo está ✅ mas o cliente ainda não acessa:');
    console.log('   1. Cliente precisa fazer nova requisição HTTP para ativar o binding');
    console.log('   2. Verificar se há regras bloqueando na chain OUTPUT');
    console.log('   3. Verificar se o gateway padrão está configurado');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

