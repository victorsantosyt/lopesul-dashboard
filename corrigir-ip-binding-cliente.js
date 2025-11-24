#!/usr/bin/env node
// Script para corrigir IP binding quando o IP do cliente mudou
// Remove bindings antigos e cria novo com o IP atual do DHCP
// Uso: node corrigir-ip-binding-cliente.js <MAC> [mikId]

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
    const MAC = process.argv[2];
    const MIK_ID = process.argv[3] || null;
    
    if (!MAC) {
      console.log('📋 Uso: node corrigir-ip-binding-cliente.js <MAC> [mikId]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node corrigir-ip-binding-cliente.js 4A:CE:1D:DC:36:E3');
      console.log('   node corrigir-ip-binding-cliente.js 4A:CE:1D:DC:36:E3 LOPESUL-HOTSPOT-06');
      process.exit(1);
    }

    console.log('🔧 Corrigindo IP binding para cliente...');
    console.log(`   MAC: ${MAC}`);
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
      // Buscar pela sessão
      const sessao = await prisma.sessaoAtiva.findFirst({
        where: { macCliente: MAC },
        include: { roteador: true },
        orderBy: { inicioEm: 'desc' },
      });
      
      if (sessao?.roteador) {
        roteador = sessao.roteador;
      }
    }

    if (!roteador) {
      console.log('❌ Roteador não encontrado!');
      console.log('   Use o parâmetro mikId para especificar o roteador.');
      return;
    }

    const host = roteador.ipLan;
    const user = roteador.usuario;
    const pass = roteador.senhaHash;

    console.log(`✅ Roteador: ${roteador.nome} (${host})`);
    console.log('');

    // 1. Buscar IP atual do DHCP
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ BUSCANDO IP ATUAL DO DHCP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const dhcpLeases = await execMikrotikCommand(host, user, pass, '/ip/dhcp-server/lease/print');
    if (!dhcpLeases.ok || !Array.isArray(dhcpLeases.data)) {
      console.log('❌ Erro ao buscar DHCP leases');
      return;
    }

    const lease = dhcpLeases.data.find(l => l['mac-address'] === MAC);
    if (!lease) {
      console.log('❌ DHCP lease não encontrado para este MAC');
      console.log('   O cliente pode não estar conectado no momento');
      return;
    }

    const ipAtual = lease.address;
    console.log(`✅ IP atual do DHCP: ${ipAtual}`);
    console.log(`   Status: ${lease.status || 'N/A'}`);
    console.log(`   Expires: ${lease['expires-after'] || 'N/A'}`);
    console.log('');

    // 2. Verificar IP bindings existentes
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ VERIFICANDO IP BINDINGS EXISTENTES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    if (!ipBindings.ok || !Array.isArray(ipBindings.data)) {
      console.log('❌ Erro ao buscar IP bindings');
      return;
    }

    const bindingsExistentes = ipBindings.data.filter(b => 
      b['mac-address'] === MAC && b.type === 'bypassed'
    );

    if (bindingsExistentes.length > 0) {
      console.log(`📋 ${bindingsExistentes.length} IP binding(s) encontrado(s):`);
      bindingsExistentes.forEach((b, idx) => {
        console.log(`   ${idx + 1}. IP: ${b.address}, MAC: ${b['mac-address']}, Tipo: ${b.type}`);
        if (b.address !== ipAtual) {
          console.log(`      ⚠️  IP diferente do DHCP atual!`);
        }
      });
    } else {
      console.log('⚠️  Nenhum IP binding encontrado');
    }
    console.log('');

    // 3. Remover bindings antigos (com IP diferente)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ REMOVENDO BINDINGS ANTIGOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let removidos = 0;
    for (const binding of bindingsExistentes) {
      if (binding.address !== ipAtual) {
        console.log(`🗑️  Removendo binding antigo: IP ${binding.address}`);
        const removeResult = await execMikrotikCommand(host, user, pass, 
          `/ip/hotspot/ip-binding/remove [find .id="${binding['.id']}"]`
        );
        if (removeResult.ok) {
          console.log(`   ✅ Removido`);
          removidos++;
        } else {
          console.log(`   ⚠️  ${removeResult.error || 'Erro ao remover'}`);
        }
      }
    }

    if (removidos === 0) {
      console.log('✅ Nenhum binding antigo para remover');
    }
    console.log('');

    // 4. Verificar se já existe binding com IP atual
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ VERIFICANDO/CRIANDO BINDING COM IP ATUAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const bindingAtual = bindingsExistentes.find(b => b.address === ipAtual);
    
    if (bindingAtual) {
      console.log(`✅ IP binding já existe com IP atual (${ipAtual})`);
      console.log(`   ID: ${bindingAtual['.id']}`);
    } else {
      console.log(`📝 Criando novo IP binding com IP atual (${ipAtual})...`);
      const comment = `CORRIGIDO-${Date.now()}`;
      const createResult = await execMikrotikCommand(host, user, pass, 
        `/ip/hotspot/ip-binding/add address=${ipAtual} mac-address=${MAC} type=bypassed comment="${comment}"`
      );
      
      if (createResult.ok) {
        console.log(`   ✅ IP binding criado com sucesso!`);
      } else {
        if (createResult.error?.includes('already exists')) {
          console.log(`   ⚠️  IP binding já existe (pode ter sido criado por outro processo)`);
        } else {
          console.log(`   ❌ Erro ao criar: ${createResult.error}`);
        }
      }
    }
    console.log('');

    // 5. Atualizar paid_clients com IP atual
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5️⃣ ATUALIZANDO LISTA PAID_CLIENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const addressList = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    if (addressList.ok && Array.isArray(addressList.data)) {
      const paidEntries = addressList.data.filter(a => 
        a.list === 'paid_clients' && a['mac-address'] === MAC
      );
      
      const entryComIpAtual = paidEntries.find(a => a.address === ipAtual);
      
      if (!entryComIpAtual) {
        console.log(`📝 Adicionando IP atual (${ipAtual}) à lista paid_clients...`);
        const comment = `CORRIGIDO-${Date.now()}`;
        const addResult = await execMikrotikCommand(host, user, pass, 
          `/ip/firewall/address-list/add list=paid_clients address=${ipAtual} comment="${comment}"`
        );
        
        if (addResult.ok) {
          console.log(`   ✅ Adicionado à lista paid_clients`);
        } else {
          console.log(`   ⚠️  ${addResult.error || 'Erro ao adicionar'}`);
        }
      } else {
        console.log(`✅ IP atual (${ipAtual}) já está na lista paid_clients`);
      }
    }
    console.log('');

    // 6. Atualizar sessão no banco
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('6️⃣ ATUALIZANDO SESSÃO NO BANCO DE DADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const sessao = await prisma.sessaoAtiva.findFirst({
      where: { macCliente: MAC },
      orderBy: { inicioEm: 'desc' },
    });

    if (sessao) {
      if (sessao.ipCliente !== ipAtual) {
        console.log(`📝 Atualizando IP da sessão: ${sessao.ipCliente} -> ${ipAtual}`);
        try {
          await prisma.sessaoAtiva.update({
            where: { id: sessao.id },
            data: { ipCliente: ipAtual },
          });
          console.log(`   ✅ Sessão atualizada no banco`);
        } catch (err) {
          console.log(`   ⚠️  Erro ao atualizar: ${err.message}`);
          console.log(`   💡 Pode ser que já exista outra sessão com este IP`);
        }
      } else {
        console.log(`✅ IP da sessão já está correto (${ipAtual})`);
      }
    } else {
      console.log('⚠️  Nenhuma sessão encontrada no banco para este MAC');
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CORREÇÃO CONCLUÍDA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 PRÓXIMOS PASSOS:');
    console.log('   1. Peça para o cliente fazer uma nova requisição HTTP (abrir um site)');
    console.log('   2. O Mikrotik deve criar uma sessão ativa automaticamente');
    console.log('   3. Se o problema persistir, verifique se há idle-timeout configurado');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

