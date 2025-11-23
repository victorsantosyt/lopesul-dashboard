#!/usr/bin/env node
// Script para verificar a ordem das regras de firewall
// Uso: node verificar-ordem-firewall.js [mikId ou IP do roteador]

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
    
    console.log('🔍 Verificando ordem das regras de firewall...');
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

    // Buscar TODAS as regras de forward
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (!filterRules.ok) {
      console.log(`❌ Erro ao buscar regras: ${filterRules.error}`);
      return;
    }

    const regras = filterRules.data || [];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 TODAS AS REGRAS DE FIREWALL (chain=forward) - ${regras.length} regra(s)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (regras.length === 0) {
      console.log('⚠️  Nenhuma regra encontrada!');
      return;
    }

    // Ordenar por .id (ordem de processamento)
    regras.sort((a, b) => {
      const idA = parseInt(a['.id'] || '0');
      const idB = parseInt(b['.id'] || '0');
      return idA - idB;
    });

    let posicaoPaidClients = -1;
    let posicaoDrop = -1;

    regras.forEach((r, idx) => {
      const disabled = r.disabled === 'true' ? ' ⚠️ DESABILITADA' : '';
      const action = r.action || 'N/A';
      const srcList = r['src-address-list'] || 'N/A';
      const comment = r.comment || 'N/A';
      
      let emoji = '  ';
      if (srcList === 'paid_clients' && action === 'accept') {
        emoji = '✅';
        posicaoPaidClients = idx;
      } else if (action === 'drop' || action === 'reject') {
        emoji = '🚫';
        if (posicaoDrop === -1) {
          posicaoDrop = idx;
        }
      } else if (action === 'accept') {
        emoji = '✅';
      }

      console.log(`${emoji} ${idx + 1}. ID: ${r['.id'] || 'N/A'}${disabled}`);
      console.log(`      Action: ${action}`);
      console.log(`      Src Address List: ${srcList}`);
      console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
      console.log(`      Comentário: ${comment}`);
      console.log('');
    });

    // Diagnóstico
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNÓSTICO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (posicaoPaidClients === -1) {
      console.log('❌ Regra para paid_clients NÃO encontrada!');
    } else {
      console.log(`✅ Regra para paid_clients na posição ${posicaoPaidClients + 1}`);
      
      if (posicaoDrop !== -1 && posicaoDrop < posicaoPaidClients) {
        console.log(`⚠️  PROBLEMA: Regra de bloqueio (drop/reject) na posição ${posicaoDrop + 1}`);
        console.log(`   A regra de bloqueio está ANTES da regra de permitir paid_clients!`);
        console.log(`   Isso pode estar bloqueando o tráfego.`);
      } else if (posicaoDrop !== -1) {
        console.log(`✅ Regra de bloqueio na posição ${posicaoDrop + 1} (depois da regra de permitir)`);
        console.log(`   Ordem correta!`);
      } else {
        console.log(`✅ Nenhuma regra de bloqueio encontrada`);
      }
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

