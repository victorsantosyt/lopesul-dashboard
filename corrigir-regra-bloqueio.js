#!/usr/bin/env node
// Script para corrigir regra que bloqueia paid_clients
// Uso: node corrigir-regra-bloqueio.js [mikId ou IP do roteador] [--dry-run]

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
    
    console.log('🔧 Corrigindo regra que bloqueia paid_clients...');
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

    // Buscar regras que bloqueiam 192.168.88.0/24
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (!filterRules.ok) {
      console.log(`❌ Erro ao buscar regras: ${filterRules.error}`);
      return;
    }

    const regras = filterRules.data || [];
    
    // Encontrar regras que bloqueiam 192.168.88.0/24
    const regrasBloqueio = regras.filter(r => 
      (r.action === 'drop' || r.action === 'reject') &&
      r['src-address'] === '192.168.88.0/24' &&
      (!r['src-address-list'] || r['src-address-list'] !== '!paid_clients')
    );

    if (regrasBloqueio.length === 0) {
      console.log('✅ Nenhuma regra problemática encontrada!');
      return;
    }

    console.log(`⚠️  ${regrasBloqueio.length} regra(s) bloqueando 192.168.88.0/24 sem exceção para paid_clients:`);
    console.log('');

    for (const regra of regrasBloqueio) {
      console.log(`   Regra ID: ${regra['.id']}`);
      console.log(`   Action: ${regra.action}`);
      console.log(`   Src Address: ${regra['src-address']}`);
      console.log(`   Comentário: ${regra.comment || 'N/A'}`);
      console.log('');

      if (!DRY_RUN) {
        // Modificar regra para excluir paid_clients
        const result = await execMikrotikCommand(
          host,
          user,
          pass,
          `/ip/firewall/filter/set .id=${regra['.id']} src-address-list=!paid_clients`
        );

        if (result.ok) {
          console.log(`   ✅ Regra modificada para excluir paid_clients!`);
        } else {
          console.log(`   ❌ Erro ao modificar regra: ${result.error}`);
          // Tentar método alternativo: adicionar src-address-list sem remover src-address
          console.log(`   Tentando método alternativo...`);
          const result2 = await execMikrotikCommand(
            host,
            user,
            pass,
            `/ip/firewall/filter/set .id=${regra['.id']} src-address-list=!paid_clients src-address=192.168.88.0/24`
          );
          if (result2.ok) {
            console.log(`   ✅ Regra modificada (método alternativo)!`);
          } else {
            console.log(`   ❌ Erro no método alternativo: ${result2.error}`);
          }
        }
      } else {
        console.log(`   🔍 Seria modificada para: src-address-list=!paid_clients (dry-run)`);
      }
      console.log('');
    }

    if (!DRY_RUN) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Correções aplicadas!');
      console.log('');
      console.log('💡 Agora os clientes pagos devem conseguir acessar a internet!');
      console.log('   Teste com o cliente agora.');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Para aplicar as correções, execute sem --dry-run:');
      console.log(`   node corrigir-regra-bloqueio.js ${mikIdOrIp}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

