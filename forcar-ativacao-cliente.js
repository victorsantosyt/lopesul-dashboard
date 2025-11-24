#!/usr/bin/env node
// Script para forçar ativação de cliente no Mikrotik
// Remove sessões antigas e recria ip-binding para garantir que funcione
// Uso: node forcar-ativacao-cliente.js <IP> <MAC> [mikId]

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
    const MAC = process.argv[3];
    const MIK_ID = process.argv[4] || null;
    
    if (!IP || !MAC) {
      console.log('📋 Uso: node forcar-ativacao-cliente.js <IP> <MAC> [mikId]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node forcar-ativacao-cliente.js 192.168.88.82 4A:CE:1D:DC:36:E3');
      console.log('   node forcar-ativacao-cliente.js 192.168.88.82 4A:CE:1D:DC:36:E3 LOPESUL-HOTSPOT-06');
      process.exit(1);
    }

    console.log('🔧 Forçando ativação de cliente...');
    console.log(`   IP: ${IP}`);
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
        where: {
          ipCliente: IP,
          macCliente: MAC,
        },
        include: {
          roteador: true,
        },
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

    console.log(`✅ Roteador encontrado: ${roteador.nome} (${roteador.ipLan})`);
    console.log('');

    const host = roteador.ipLan;
    const user = roteador.usuario;
    const pass = roteador.senhaHash;
    const comment = `FORCADO-${Date.now()}`;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 EXECUTANDO CORREÇÕES NO MIKROTIK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // 1. Remover sessões antigas do hotspot
    console.log('1️⃣ Removendo sessões antigas do hotspot...');
    const removeActive = await execMikrotikCommand(host, user, pass, 
      `/ip/hotspot/active/remove [find address="${IP}" or mac-address="${MAC}"]`
    );
    if (removeActive.ok) {
      console.log('   ✅ Sessões antigas removidas');
    } else {
      console.log(`   ⚠️  ${removeActive.error || 'Nenhuma sessão para remover (normal)'}`);
    }
    console.log('');

    // 2. Remover hosts antigos
    console.log('2️⃣ Removendo hosts antigos...');
    const removeHost = await execMikrotikCommand(host, user, pass, 
      `/ip/hotspot/host/remove [find mac-address="${MAC}"]`
    );
    if (removeHost.ok) {
      console.log('   ✅ Hosts antigos removidos');
    } else {
      console.log(`   ⚠️  ${removeHost.error || 'Nenhum host para remover (normal)'}`);
    }
    console.log('');

    // 3. Remover IP bindings antigos
    console.log('3️⃣ Removendo IP bindings antigos...');
    const removeBinding = await execMikrotikCommand(host, user, pass, 
      `/ip/hotspot/ip-binding/remove [find address="${IP}" or mac-address="${MAC}"]`
    );
    if (removeBinding.ok) {
      console.log('   ✅ IP bindings antigos removidos');
    } else {
      console.log(`   ⚠️  ${removeBinding.error || 'Nenhum binding para remover (normal)'}`);
    }
    console.log('');

    // 4. Garantir que está na lista paid_clients
    console.log('4️⃣ Garantindo que está na lista paid_clients...');
    const checkPaid = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    if (checkPaid.ok && Array.isArray(checkPaid.data)) {
      const jaEstaNaLista = checkPaid.data.find(c => c.address === IP && c.list === 'paid_clients');
      if (!jaEstaNaLista) {
        const addPaid = await execMikrotikCommand(host, user, pass, 
          `/ip/firewall/address-list/add list=paid_clients address=${IP} comment="${comment}"`
        );
        if (addPaid.ok) {
          console.log('   ✅ Adicionado à lista paid_clients');
        } else {
          console.log(`   ❌ Erro ao adicionar: ${addPaid.error}`);
        }
      } else {
        console.log('   ✅ Já está na lista paid_clients');
      }
    }
    console.log('');

    // 5. Recriar IP binding (bypassed)
    console.log('5️⃣ Recriando IP binding (bypassed)...');
    const createBinding = await execMikrotikCommand(host, user, pass, 
      `/ip/hotspot/ip-binding/add address=${IP} mac-address=${MAC} type=bypassed comment="${comment}"`
    );
    if (createBinding.ok) {
      console.log('   ✅ IP binding criado com sucesso');
    } else {
      if (createBinding.error?.includes('already exists')) {
        console.log('   ⚠️  IP binding já existe (normal)');
      } else {
        console.log(`   ❌ Erro ao criar: ${createBinding.error}`);
      }
    }
    console.log('');

    // 6. Remover conexões antigas do firewall
    console.log('6️⃣ Removendo conexões antigas do firewall...');
    const removeConn = await execMikrotikCommand(host, user, pass, 
      `/ip/firewall/connection/remove [find src-address~"${IP}" or dst-address~"${IP}"]`
    );
    if (removeConn.ok) {
      console.log('   ✅ Conexões antigas removidas');
    } else {
      console.log(`   ⚠️  ${removeConn.error || 'Nenhuma conexão para remover (normal)'}`);
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CORREÇÕES CONCLUÍDAS!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 PRÓXIMOS PASSOS:');
    console.log('   1. Peça para o cliente fazer uma nova requisição HTTP (abrir um site qualquer)');
    console.log('   2. O Mikrotik deve criar uma sessão ativa automaticamente');
    console.log('   3. Se ainda não funcionar, verifique as regras de firewall e NAT');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

