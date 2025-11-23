#!/usr/bin/env node
// Script para verificar e configurar cliente pelo IP atual
// Uso: node verificar-cliente-ip-atual.js [mikId] [IP atual] [MAC (opcional)]

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
    const clienteMac = process.argv[4];
    
    if (!clienteIp) {
      console.log('📋 Uso: node verificar-cliente-ip-atual.js [mikId] <IP atual> [MAC opcional]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node verificar-cliente-ip-atual.js LOPESUL-HOTSPOT-06 192.168.88.248');
      console.log('   node verificar-cliente-ip-atual.js LOPESUL-HOTSPOT-06 192.168.88.248 D0:81:7A:C7:33:22');
      process.exit(1);
    }

    console.log('🔍 Verificando e configurando cliente pelo IP atual...');
    console.log(`   Roteador: ${mikIdOrIp}`);
    console.log(`   Cliente IP: ${clienteIp}`);
    if (clienteMac) {
      console.log(`   Cliente MAC: ${clienteMac}`);
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

    // Buscar pedido relacionado (pelo IP ou MAC)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ BUSCANDO PEDIDO RELACIONADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let pedido = null;
    if (clienteMac) {
      pedido = await prisma.pedido.findFirst({
        where: {
          status: 'PAID',
          OR: [
            { ip: clienteIp },
            { deviceMac: clienteMac.toUpperCase() },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      pedido = await prisma.pedido.findFirst({
        where: {
          status: 'PAID',
          ip: clienteIp,
        },
        orderBy: { createdAt: 'desc' },
      });
    }
    
    if (pedido) {
      console.log(`   ✅ Pedido encontrado: ${pedido.code}`);
      console.log(`      Status: ${pedido.status}`);
      console.log(`      Valor: R$ ${((pedido.amount || 0) / 100).toFixed(2)}`);
      console.log(`      IP original: ${pedido.ip || 'N/A'}`);
      console.log(`      MAC original: ${pedido.deviceMac || 'N/A'}`);
    } else {
      console.log('   ⚠️  Nenhum pedido pago encontrado para este IP/MAC');
      console.log('   Vou configurar mesmo assim usando o IP atual');
    }
    console.log('');

    // Verificar se está em paid_clients
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ VERIFICANDO PAID_CLIENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const paidList = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    let precisaAdicionarPaid = true;
    
    if (paidList.ok && Array.isArray(paidList.data)) {
      const cliente = paidList.data.find(item => 
        item.list === 'paid_clients' && item.address === clienteIp
      );
      
      if (cliente) {
        console.log(`   ✅ Cliente ${clienteIp} já está na lista paid_clients`);
        precisaAdicionarPaid = false;
      } else {
        console.log(`   ❌ Cliente ${clienteIp} NÃO está na lista paid_clients`);
      }
    }
    console.log('');

    // Verificar IP binding
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ VERIFICANDO IP BINDING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    let precisaAdicionarBinding = true;
    let macParaBinding = clienteMac || '00:00:00:00:00:00';
    
    if (ipBindings.ok && Array.isArray(ipBindings.data)) {
      const binding = ipBindings.data.find(b => 
        b.type === 'bypassed' && b.address === clienteIp
      );
      
      if (binding) {
        console.log(`   ✅ IP binding encontrado (ID: ${binding['.id']})`);
        console.log(`      MAC: ${binding['mac-address'] || 'N/A'}`);
        macParaBinding = binding['mac-address'] || macParaBinding;
        precisaAdicionarBinding = false;
      } else {
        console.log(`   ❌ IP binding não encontrado para ${clienteIp}`);
      }
    }
    console.log('');

    // Configurar se necessário
    if (precisaAdicionarPaid || precisaAdicionarBinding) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('4️⃣ CONFIGURANDO ACESSO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const comment = pedido ? `auto-liberado:${pedido.code}` : `auto-liberado:${Date.now()}`;
      
      if (precisaAdicionarPaid) {
        console.log(`   🔧 Adicionando ${clienteIp} à lista paid_clients...`);
        const addPaid = await execMikrotikCommand(
          host,
          user,
          pass,
          `/ip/firewall/address-list/add list=paid_clients address=${clienteIp} comment="${comment}"`
        );
        
        if (addPaid.ok) {
          console.log('   ✅ Adicionado à lista paid_clients');
        } else {
          console.log(`   ⚠️  Aviso: ${addPaid.error}`);
        }
      }
      
      if (precisaAdicionarBinding) {
        console.log(`   🔧 Criando IP binding para ${clienteIp}...`);
        const addBinding = await execMikrotikCommand(
          host,
          user,
          pass,
          `/ip/hotspot/ip-binding/add address=${clienteIp} mac-address=${macParaBinding} server=hotspot1 type=bypassed comment="${comment}"`
        );
        
        if (addBinding.ok) {
          console.log('   ✅ IP binding criado');
        } else {
          console.log(`   ⚠️  Aviso: ${addBinding.error}`);
        }
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CONFIGURAÇÃO COMPLETA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 Próximos passos:');
    console.log('   1. Peça ao cliente para fazer uma nova requisição HTTP');
    console.log('   2. Abrir navegador e tentar acessar qualquer site');
    console.log('   3. Isso fará o Mikrotik reconhecer o binding e liberar o acesso');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

