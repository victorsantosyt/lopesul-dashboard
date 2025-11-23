#!/usr/bin/env node
// Script para verificar TODAS as regras que podem estar bloqueando
// Uso: node verificar-todas-regras-bloqueio.js [mikId]

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
    
    console.log('🔍 Verificando TODAS as regras que podem estar bloqueando...');
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
    
    // Ordenar por ID
    regras.sort((a, b) => {
      const idA = parseInt(a['.id'] || '0', 16);
      const idB = parseInt(b['.id'] || '0', 16);
      return idA - idB;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 REGRAS QUE PODEM ESTAR BLOQUEANDO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Encontrar regra paid_clients
    const regraPaidClients = regras.find(r => 
      r['src-address-list'] === 'paid_clients' && r.action === 'accept'
    );
    const posicaoPaid = regraPaidClients ? regras.indexOf(regraPaidClients) : -1;

    // Encontrar TODAS as regras de bloqueio (drop/reject)
    const regrasBloqueio = regras.filter(r =>
      (r.action === 'drop' || r.action === 'reject') &&
      r.disabled !== 'true'
    );

    console.log(`🚫 ${regrasBloqueio.length} regra(s) de bloqueio encontrada(s):`);
    console.log('');

    let problemas = [];

    regrasBloqueio.forEach((r, idx) => {
      const posicao = regras.indexOf(r);
      const antesPaid = posicaoPaid !== -1 && posicao < posicaoPaid;
      const afetaHotspot = 
        r['in-interface'] === 'bridge' ||
        r['out-interface'] === 'bridge' ||
        r['src-address'] === '192.168.88.0/24' ||
        (r['src-address'] && r['src-address'].includes('192.168.88'));

      if (antesPaid || afetaHotspot) {
        problemas.push(r);
        
        console.log(`⚠️  ${idx + 1}. ID: ${r['.id']} | Posição: ${posicao + 1}`);
        console.log(`      Action: ${r.action}`);
        console.log(`      In Interface: ${r['in-interface'] || 'N/A'}`);
        console.log(`      Out Interface: ${r['out-interface'] || 'N/A'}`);
        console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
        console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
        console.log(`      Comentário: ${r.comment || 'N/A'}`);
        
        if (antesPaid) {
          console.log(`      ⚠️  PROBLEMA: Está ANTES da regra paid_clients (posição ${posicaoPaid + 1})!`);
        }
        if (afetaHotspot) {
          console.log(`      ⚠️  PROBLEMA: Afeta interface bridge ou rede 192.168.88.0/24!`);
        }
        console.log('');
      }
    });

    if (problemas.length === 0) {
      console.log('✅ Nenhuma regra problemática encontrada!');
      console.log('');
      console.log('💡 Se o cliente ainda não consegue acessar, pode ser:');
      console.log('   1. Cliente precisa reconectar ao Wi-Fi');
      console.log('   2. Cache do navegador');
      console.log('   3. Problema com DNS');
      console.log('   4. Regra de NAT bloqueando');
    } else {
      console.log(`⚠️  ${problemas.length} regra(s) problemática(s) encontrada(s)!`);
      console.log('');
      console.log('💡 SOLUÇÃO:');
      console.log('   - Desabilitar essas regras');
      console.log('   - Ou adicionar exceção para paid_clients');
      console.log('   - Ou mover regra paid_clients para antes delas');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

