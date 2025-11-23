#!/usr/bin/env node
// Script para forçar ativação do ip-binding fazendo o cliente fazer nova requisição
// Uso: node forcar-ativacao-binding.js [mikId] [IP do cliente]

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
      console.log('📋 Uso: node forcar-ativacao-binding.js [mikId] <IP do cliente>');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node forcar-ativacao-binding.js LOPESUL-HOTSPOT-06 192.168.88.199');
      process.exit(1);
    }

    console.log('🔧 Forçando ativação do ip-binding...');
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

    // 1. Remover e recriar ip-binding para forçar reconhecimento
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ REMOVENDO E RECRIANDO IP-BINDING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Buscar binding existente
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    if (ipBindings.ok && Array.isArray(ipBindings.data)) {
      const binding = ipBindings.data.find(b => 
        b.type === 'bypassed' && b.address === clienteIp
      );
      
      if (binding) {
        console.log(`   ✅ IP binding encontrado (ID: ${binding['.id']})`);
        console.log(`      MAC: ${binding['mac-address'] || 'N/A'}`);
        console.log(`      Comentário: ${binding.comment || 'N/A'}`);
        console.log('');
        
        // Remover binding
        console.log('   🔧 Removendo binding antigo...');
        const removeResult = await execMikrotikCommand(
          host, 
          user, 
          pass, 
          `/ip/hotspot/ip-binding/remove ${binding['.id']}`
        );
        
        if (removeResult.ok) {
          console.log('   ✅ Binding removido');
        } else {
          console.log(`   ⚠️  Aviso ao remover: ${removeResult.error}`);
        }
        
        // Recriar binding
        console.log('   🔧 Recriando binding...');
        const recreateResult = await execMikrotikCommand(
          host,
          user,
          pass,
          `/ip/hotspot/ip-binding/add address=${clienteIp} mac-address=${binding['mac-address'] || ''} server=hotspot1 type=bypassed comment="${binding.comment || 're-ativado'}"`
        );
        
        if (recreateResult.ok) {
          console.log('   ✅ Binding recriado com sucesso!');
        } else {
          console.log(`   ❌ Erro ao recriar: ${recreateResult.error}`);
        }
      } else {
        console.log(`   ⚠️  Nenhum IP binding encontrado para ${clienteIp}`);
      }
    }
    console.log('');

    // 2. Limpar conexões antigas
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ LIMPANDO CONEXÕES ANTIGAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const clearConnResult = await execMikrotikCommand(
      host,
      user,
      pass,
      `/ip/firewall/connection/remove [find src-address="${clienteIp}" or dst-address="${clienteIp}"]`
    );
    
    if (clearConnResult.ok) {
      console.log('   ✅ Conexões antigas removidas');
    } else {
      console.log(`   ⚠️  Aviso: ${clearConnResult.error}`);
    }
    console.log('');

    // 3. Remover sessão ativa antiga (se houver)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ REMOVENDO SESSÃO ATIVA ANTIGA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const clearSessionResult = await execMikrotikCommand(
      host,
      user,
      pass,
      `/ip/hotspot/active/remove [find address="${clienteIp}"]`
    );
    
    if (clearSessionResult.ok) {
      console.log('   ✅ Sessão ativa antiga removida');
    } else {
      console.log(`   ⚠️  Aviso: ${clearSessionResult.error}`);
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 PRÓXIMOS PASSOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. Peça ao cliente para fazer uma nova requisição HTTP:');
    console.log('   - Abrir um navegador');
    console.log('   - Tentar acessar qualquer site (ex: google.com)');
    console.log('   - Ou acessar: http://192.168.88.1');
    console.log('');
    console.log('2. Isso fará o Mikrotik reconhecer o ip-binding e liberar o acesso.');
    console.log('');
    console.log('3. Se ainda não funcionar, verifique as regras de firewall:');
    console.log('   node verificar-regras-http-https.js LOPESUL-HOTSPOT-06');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

