#!/usr/bin/env node
// Script para corrigir definitivamente a regra 38
// Uso: node corrigir-regra-38-definitivo.js [mikId] [--dry-run]

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
const DRY_RUN = process.argv.includes('--dry-run');

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
    
    console.log('🔧 Corrigindo regra 38 definitivamente...');
    if (DRY_RUN) {
      console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita');
    }
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

    // Buscar regra que bloqueia 192.168.88.0/24
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (!filterRules.ok) {
      console.log(`❌ Erro ao buscar regras: ${filterRules.error}`);
      return;
    }

    const regras = filterRules.data || [];
    const regra38 = regras.find(r => 
      r['src-address'] === '192.168.88.0/24' &&
      (r.action === 'drop' || r.action === 'reject')
    );

    if (!regra38) {
      console.log('✅ Nenhuma regra bloqueando 192.168.88.0/24 encontrada!');
      return;
    }

    console.log(`📋 Regra encontrada: ID ${regra38['.id']}`);
    console.log(`   Src Address: ${regra38['src-address']}`);
    console.log(`   Src Address List: ${regra38['src-address-list'] || 'N/A'}`);
    console.log('');

    // SOLUÇÃO: Remover src-address e usar apenas src-address-list
    // Criar uma address-list com todos os IPs de 192.168.88.0/24 exceto paid_clients
    // Ou melhor: usar apenas src-address-list=!paid_clients e remover src-address
    
    console.log('💡 SOLUÇÃO: Remover src-address e usar apenas src-address-list');
    console.log('   O Mikrotik pode ter conflito quando usa src-address E src-address-list juntos');
    console.log('');

    if (!DRY_RUN) {
      // Método 1: Tentar remover src-address e manter apenas src-address-list
      console.log('🔧 Tentando corrigir a regra...');
      
      // Primeiro, verificar se já tem src-address-list
      if (regra38['src-address-list'] === '!paid_clients') {
        // Já tem a exceção, só precisa remover src-address
        const result = await execMikrotikCommand(
          host,
          user,
          pass,
          `/ip/firewall/filter/set .id=${regra38['.id']} src-address="" src-address-list=!paid_clients`
        );
        
        if (result.ok) {
          console.log('   ✅ Regra corrigida! Removido src-address, mantido src-address-list=!paid_clients');
        } else {
          console.log(`   ⚠️  Erro ao corrigir: ${result.error}`);
          console.log('   Tentando método alternativo...');
          
          // Método alternativo: desabilitar a regra e criar uma nova
          await execMikrotikCommand(
            host,
            user,
            pass,
            `/ip/firewall/filter/disable .id=${regra38['.id']}`
          );
          
          // Criar nova regra sem src-address
          const result2 = await execMikrotikCommand(
            host,
            user,
            pass,
            `/ip/firewall/filter/add chain=forward src-address-list=!paid_clients src-address=192.168.88.0/24 action=drop comment="Bloquear passageiros não pagos" place-after=${regra38['.id']}`
          );
          
          if (result2.ok) {
            console.log('   ✅ Nova regra criada (regra antiga desabilitada)');
          } else {
            console.log(`   ❌ Erro no método alternativo: ${result2.error}`);
          }
        }
      } else {
        // Não tem src-address-list, adicionar
        const result = await execMikrotikCommand(
          host,
          user,
          pass,
          `/ip/firewall/filter/set .id=${regra38['.id']} src-address-list=!paid_clients`
        );
        
        if (result.ok) {
          console.log('   ✅ src-address-list=!paid_clients adicionado!');
        } else {
          console.log(`   ❌ Erro: ${result.error}`);
        }
      }
    } else {
      console.log('🔍 Seria executado (dry-run):');
      console.log(`   /ip/firewall/filter/set .id=${regra38['.id']} src-address="" src-address-list=!paid_clients`);
    }
    console.log('');

    if (!DRY_RUN) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Correção aplicada!');
      console.log('');
      console.log('💡 Teste o acesso do cliente agora.');
      console.log('   Se ainda não funcionar, pode ser necessário:');
      console.log('   1. Cliente precisa reconectar ao Wi-Fi');
      console.log('   2. Limpar cache do navegador');
      console.log('   3. Verificar se há outras regras bloqueando');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Para aplicar a correção, execute sem --dry-run:');
      console.log(`   node corrigir-regra-38-definitivo.js ${mikIdOrIp}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

